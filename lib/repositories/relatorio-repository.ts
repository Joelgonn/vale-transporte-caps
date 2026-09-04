import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import {
  POR_PAGINA_RELATORIO,
  type FiltrosRelatorio,
  type ResultadoListaRelatorio,
  type ResultadoResumoRelatorio,
} from "@/lib/domain/relatorios/types";
import {
  mapearLinhaConsolidado,
  mapearLinhaLiberacoes,
  mapearLinhaRetiradas,
  type LinhaConsolidadoBruta,
  type LinhaLiberacaoBruta,
  type LinhaRetiradaBruta,
} from "@/lib/domain/relatorios/mapeamento";
import {
  mapearItemHistorico,
  type LinhaHistoricoBruta,
} from "@/lib/domain/relatorios/historico";
import {
  agregarResumo,
  type LiberacaoResumoBruta,
  type RetiradaResumoBruta,
} from "@/lib/domain/relatorios/resumo";
import {
  agruparPorPaciente as agruparPorPacienteConsolidado,
  calcularContadores,
  calcularTotais,
  calcularTotaisPorTipo,
  filtrarPorSituacao,
} from "@/lib/domain/relatorios/consolidado";
import {
  calcularContadoresLiberacoes,
  calcularTotaisLiberacoes,
  filtrarPorSituacaoLiberacoes,
} from "@/lib/domain/relatorios/liberacoes";
import {
  calcularContadoresRetiradas,
  calcularTotaisRetiradas,
  filtrarPorSituacaoRetiradas,
} from "@/lib/domain/relatorios/retiradas";

// Contrato usado pelos services (permite injeção de fakes nos testes).
export interface RelatorioRepository {
  listarLiberacoes(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
  listarRetiradas(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
  listarConsolidado(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
  listarHistorico(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
  obterResumo(filtros: FiltrosRelatorio): Promise<ResultadoResumoRelatorio>;
}

// Colunas do paciente embutidas nos relatórios (nunca CPF — o contrato de
// relatório não exige; pacientes_com_cpf continua restrito ao Gestor).
const COLUNAS_PACIENTE = "id, gestor_sus, nome";
const COLUNAS_PACIENTE_LIBERACOES = "id, gestor_sus, nome, origem";

// Normaliza termos de filtro: remove bordas e limita tamanho. Como os filtros
// vão como parâmetros do PostgREST (eq/gte/lte), nunca há interpolação de SQL.
function normalizarTermo(valor?: string | null): string | undefined {
  const v = valor?.trim();
  return v ? v.slice(0, 100) : undefined;
}

// "2026-08-13" (input date) → fim do dia em UTC para o .lte() incluir o dia todo.
function normalizarDataAte(valor?: string | null): string | undefined {
  const v = normalizarTermo(valor);
  if (!v) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59.999` : v;
}

export class RelatorioRepositoryPostgres implements RelatorioRepository {
  constructor(private readonly client: SupabaseClient) {}

  // Busca por nome/Gestor SUS do PACIENTE (não são colunas de liberacoes/
  // retiradas). Segue o padrão seguro de Pacientes/Liberações: resolve os ids
  // via v_pacientes (sem CPF, RLS) e filtra por paciente_id.
  // Sprint 44 P1 — removido .limit(100) silencioso: agora pagina em chunks de
  // 1000 até esgotar, garantindo que 101/500 pacientes com mesmo termo não
  // produzam relatório incompleto sem aviso.
  private async resolverIdsPacientes(termo?: string): Promise<string[] | null> {
    if (!termo) return null;
    const tamanhoPagina = 1000;
    let offset = 0;
    const ids: string[] = [];
    while (true) {
      const { data: pacientes, error } = await this.client
        .from("v_pacientes")
        .select("id")
        .or(`nome.ilike.%${termo}%,gestor_sus.ilike.%${termo}%`)
        .range(offset, offset + tamanhoPagina - 1);
      if (error) throw mapSupabaseError(error);
      const pagina = (pacientes ?? []) as { id: string }[];
      ids.push(...pagina.map((p) => p.id));
      if (pagina.length < tamanhoPagina) break;
      offset += tamanhoPagina;
    }
    return ids;
  }

  // Sprint 54 — Liberações operacionais: busca chunked do conjunto base para
  // totais/contadores corretos (não apenas página). Filtro de situação em memória.
  async listarLiberacoes(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    const porPagina = POR_PAGINA_RELATORIO;

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const tipoLiberacao = normalizarTermo(filtros.tipoLiberacao);
    const statusFiltro = normalizarTermo(filtros.status);
    const situacao = normalizarTermo(filtros.situacaoLiberacoes);
    const pacienteId = normalizarTermo(filtros.paciente);
    const ids = pacienteId ? null : await this.resolverIdsPacientes(normalizarTermo(filtros.busca));

    if (ids && ids.length === 0) {
      const vaziaTotais = calcularTotaisLiberacoes([]);
      return {
        tipo: "liberacoes",
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
        totais: vaziaTotais,
        contadores: calcularContadoresLiberacoes([]),
      };
    }

    // Busca chunked do conjunto base (filtros de período/tipo/status/paciente)
    const tamanhoPagina = 1000;
    let offset = 0;
    const todasBrutas: unknown[] = [];
    while (true) {
      let query = this.client
        .from("liberacoes")
        .select(
          `id, paciente_id, tipo, quantidade, periodo_meses, data_inicio, data_fim, status, profissional_autorizador_id, renovacao_de_id, pacientes(${COLUNAS_PACIENTE_LIBERACOES}), autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey(id, nome), retiradas(quantidade)`
        );
      if (de) query = query.gte("data_inicio", de);
      if (ate) query = query.lte("data_inicio", ate);
      if (tipoLiberacao) query = query.eq("tipo", tipoLiberacao);
      if (statusFiltro) query = query.eq("status", statusFiltro);
      if (pacienteId) query = query.eq("paciente_id", pacienteId);
      else if (ids) query = query.in("paciente_id", ids);
      const { data, error } = await query
        .order("data_inicio", { ascending: false })
        .range(offset, offset + tamanhoPagina - 1);
      if (error) throw mapSupabaseError(error);
      const pagina = (data ?? []) as unknown[];
      todasBrutas.push(...pagina);
      if (pagina.length < tamanhoPagina) break;
      offset += tamanhoPagina;
    }

    const todasLinhas = todasBrutas.map((linha) => mapearLinhaLiberacoes(linha as LinhaLiberacaoBruta));

    const totaisBase = calcularTotaisLiberacoes(todasLinhas);
    const contadores = calcularContadoresLiberacoes(todasLinhas);
    // Totais refletem base (conjunto filtrado por período/tipo/status/paciente) — mesmo que contadores
    // Para situacao, filtramos e recalculamos totais sobre filtrado? Spec: indicadores devem refletir conjunto atual dos filtros (inclui status etc, mas não situação até clicar)
    // Quando situação ativa, tabela mostra filtrado, mas cards devem continuar do base? Sprint 53 fez cards do filtrado. Para Liberações, spec §4: indicadores devem representar conjunto atual dos filtros (inclui situação? diz se selecionar paciente período tipo status). Vamos manter totais como base, e quando situação ativa, tabela usa filtrado. Contadores sempre base.
    const filtradas = filtrarPorSituacaoLiberacoes(todasLinhas, situacao);
    const total = filtradas.length;
    const inicio = (filtros.pagina - 1) * porPagina;
    const linhasPaginadas = filtradas.slice(inicio, inicio + porPagina);

    // Se há filtro de situação, totais da camada de cards devem refletir filtrado ou base?
    // Spec §4: se selecionar paciente/status, indicadores refletem aquele paciente. Implica totais devem recalcular conforme filtros incluindo situação? Para consistência com Consolidado (totais sobre filtrado), se situação ativa, mostramos filtrado.
    // Vamos usar: se situação ativa, totais = calcular sobre filtrado; senão base.
    const totais = situacao ? calcularTotaisLiberacoes(filtradas) : totaisBase;

    return {
      tipo: "liberacoes",
      linhas: linhasPaginadas,
      total,
      pagina: filtros.pagina,
      porPagina,
      totais,
      contadores,
    };
  }

  // Sprint 55 — Retiradas operacionais: chunked + totais/contadores + tipo/situação
  async listarRetiradas(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    const porPagina = POR_PAGINA_RELATORIO;

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const tipoLiberacao = normalizarTermo(filtros.tipoLiberacao);
    const situacao = normalizarTermo(filtros.situacaoRetiradas);
    const pacienteId = normalizarTermo(filtros.paciente);
    const ids = pacienteId ? null : await this.resolverIdsPacientes(normalizarTermo(filtros.busca));

    if (ids && ids.length === 0) {
      const vazioTotais = calcularTotaisRetiradas([]);
      return {
        tipo: "retiradas",
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
        totais: vazioTotais,
        contadores: calcularContadoresRetiradas([]),
      };
    }

    // Chunked busca do conjunto base (filtros de período/paciente/tipo)
    const tamanhoPagina = 1000;
    let offset = 0;
    const todasBrutas: unknown[] = [];
    while (true) {
      // Para filtro por tipo, usamos !inner para que PostgREST filtre linhas de topo
      const selectTipo = tipoLiberacao ? "liberacoes!inner(id, tipo, quantidade, data_inicio, data_fim, status)" : "liberacoes(id, tipo, quantidade, data_inicio, data_fim, status)";
      let query = this.client
        .from("retiradas")
        .select(`*, pacientes(${COLUNAS_PACIENTE_LIBERACOES}), ${selectTipo}, recepcionista:usuarios!retiradas_recepcionista_id_fkey(id, nome)`);
      if (de) query = query.gte("data_hora", de);
      if (ate) query = query.lte("data_hora", ate);
      if (tipoLiberacao) query = query.eq("liberacoes.tipo", tipoLiberacao);
      if (pacienteId) query = query.eq("paciente_id", pacienteId);
      else if (ids) query = query.in("paciente_id", ids);
      const { data, error } = await query
        .order("data_hora", { ascending: false })
        .range(offset, offset + tamanhoPagina - 1);
      if (error) throw mapSupabaseError(error);
      const pagina = (data ?? []) as unknown[];
      todasBrutas.push(...pagina);
      if (pagina.length < tamanhoPagina) break;
      offset += tamanhoPagina;
    }

    const todasLinhas = todasBrutas.map((linha) => mapearLinhaRetiradas(linha as LinhaRetiradaBruta));

    const contadores = calcularContadoresRetiradas(todasLinhas);
    const filtradas = filtrarPorSituacaoRetiradas(todasLinhas, situacao);
    const totais = calcularTotaisRetiradas(filtradas);

    const total = filtradas.length;
    const inicio = (filtros.pagina - 1) * porPagina;
    const linhasPaginadas = filtradas.slice(inicio, inicio + porPagina);

    return {
      tipo: "retiradas",
      linhas: linhasPaginadas,
      total,
      pagina: filtros.pagina,
      porPagina,
      totais,
      contadores,
    };
  }

  // Consolidado por liberação: autorizado (quantidade) vs. entregue (Σ
  // retiradas), com saldo derivado no servidor. Somente leitura via RLS.
  // Sprint 53 — busca o CONJUNTO COMPLETO (chunk 1000) para calcular
  // contadores/totais de forma correta (não apenas a página). Filtro de
  // situação (estouro/sem_retirada/...) é aplicado em memória sobre o conjunto
  // base; paginação incide sobre o conjunto já filtrado por situação.
  async listarConsolidado(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    const porPagina = POR_PAGINA_RELATORIO;

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const tipoLiberacao = normalizarTermo(filtros.tipoLiberacao);
    const pacienteId = normalizarTermo(filtros.paciente);
    const situacao = normalizarTermo(filtros.situacaoConsolidado);
    const ids = pacienteId ? null : await this.resolverIdsPacientes(normalizarTermo(filtros.busca));

    if (ids && ids.length === 0) {
      const vazio = calcularTotais([]);
      return {
        tipo: "consolidado",
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
        totais: vazio,
        porTipo: calcularTotaisPorTipo([]),
        porPaciente: [],
        contadores: calcularContadores([]),
      };
    }

    // Busca chunked do conjunto base (sem paginação) para agregações corretas.
    const tamanhoPagina = 1000;
    let offset = 0;
    const todasBrutas: unknown[] = [];
    while (true) {
      let query = this.client
        .from("liberacoes")
        .select(
          `id, paciente_id, tipo, quantidade, data_inicio, data_fim, status, periodo_meses, pacientes(${COLUNAS_PACIENTE}), retiradas(quantidade)`
        );
      if (de) query = query.gte("data_inicio", de);
      if (ate) query = query.lte("data_inicio", ate);
      if (tipoLiberacao) query = query.eq("tipo", tipoLiberacao);
      if (pacienteId) query = query.eq("paciente_id", pacienteId);
      else if (ids) query = query.in("paciente_id", ids);
      const { data, error } = await query
        .order("data_inicio", { ascending: false })
        .range(offset, offset + tamanhoPagina - 1);
      if (error) throw mapSupabaseError(error);
      const pagina = (data ?? []) as unknown[];
      todasBrutas.push(...pagina);
      if (pagina.length < tamanhoPagina) break;
      offset += tamanhoPagina;
    }

    const todasLinhas = todasBrutas.map((linha) =>
      mapearLinhaConsolidado(linha as LinhaConsolidadoBruta)
    );

    const contadores = calcularContadores(todasLinhas);
    const filtradas = filtrarPorSituacao(todasLinhas, situacao);
    const totais = calcularTotais(filtradas);
    const porTipo = calcularTotaisPorTipo(filtradas);
    const porPaciente = agruparPorPacienteConsolidado(filtradas);

    // Paginação sobre o conjunto filtrado por situação
    const total = filtradas.length;
    const inicio = (filtros.pagina - 1) * porPagina;
    const linhasPaginadas = filtradas.slice(inicio, inicio + porPagina);

    return {
      tipo: "consolidado",
      linhas: linhasPaginadas,
      total,
      pagina: filtros.pagina,
      porPagina,
      totais,
      porTipo,
      porPaciente,
      contadores,
    };
  }

  async listarHistorico(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    const porPagina = POR_PAGINA_RELATORIO;
    const offset = (filtros.pagina - 1) * porPagina;

    const pacienteId = normalizarTermo(filtros.paciente);
    if (!pacienteId) {
      return {
        tipo: "historico",
        paciente: null,
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
      };
    }

    // Busca o paciente no v_pacientes (sem CPF, RLS-safe) para o cabeçalho.
    // Sprint 46 — inclui origem para badge Regular/Esporádico no header premium.
    // Sprint 56 — inclui created_at para evento de cadastro na timeline.
    const { data: paciente, error: erroPaciente } = await this.client
      .from("v_pacientes")
      .select("id, gestor_sus, nome, origem, created_at")
      .eq("id", pacienteId)
      .maybeSingle();

    if (erroPaciente) throw mapSupabaseError(erroPaciente);

    const pacienteResolvido = paciente as
      | { id: string; gestor_sus: string; nome: string; origem: string | null; created_at: string | null }
      | null;

    if (!pacienteResolvido) {
      return {
        tipo: "historico",
        paciente: null,
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
      };
    }

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const tipoLiberacao = normalizarTermo(filtros.tipoLiberacao);
    const status = normalizarTermo(filtros.status);
    const origem = normalizarTermo(filtros.origem);

    // Hotfix — remover self-join liberacoes→liberacoes (schema cache). Origem não é necessária;
    // renovação é determinada por renovacao_de_id (ehRenovacao/ehOriginal).
    let query = this.client
      .from("liberacoes")
      .select(
        `*, autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey(id, nome), registrador:usuarios!liberacoes_registrado_por_id_fkey(id, nome), retiradas(data_hora, quantidade)`,
        { count: "exact" }
      )
      .eq("paciente_id", pacienteId);

    if (de) query = query.gte("data_inicio", de);
    if (ate) query = query.lte("data_inicio", ate);
    if (tipoLiberacao) query = query.eq("tipo", tipoLiberacao);
    if (status) query = query.eq("status", status);
    if (origem === "original") query = query.is("renovacao_de_id", null);
    if (origem === "renovacao") {
      query = query.not("renovacao_de_id", "is", null);
    }

    const { data, error, count } = await query
      .order("data_inicio", { ascending: true })
      .range(offset, offset + porPagina - 1);

    if (error) throw mapSupabaseError(error);

    return {
      tipo: "historico",
      paciente: pacienteResolvido,
      linhas: (data ?? []).map((linha) =>
        mapearItemHistorico(linha as LinhaHistoricoBruta)
      ),
      total: count ?? 0,
      pagina: filtros.pagina,
      porPagina,
    };
  }

  // Resumo gerencial de vales (Sprint 40) — agregação de dados já existentes.
  //
  // SEMÂNTICA DO PERÍODO (as duas consultas são independentes, sem N+1):
  //   Consulta A — liberações com data_inicio no período (+ tipo + paciente):
  //     alimenta totalLiberacoes, vales autorizados, contínuas/avulsas e a
  //     coluna "Autorizado" da tabela por paciente;
  //   Consulta B — retiradas com data_hora no período (+ paciente):
  //     alimenta vales retirados e a coluna "Retirado".
  // Uma retirada feita no período contra liberação anterior ao período entra
  // normalmente (por isso a consulta B é separada). Saldo = autorizado −
  // retirado, derivado em agregarResumo() — nunca armazenado.
  async obterResumo(filtros: FiltrosRelatorio): Promise<ResultadoResumoRelatorio> {
    const pacienteId = normalizarTermo(filtros.paciente);
    const ids = pacienteId ? null : await this.resolverIdsPacientes(normalizarTermo(filtros.busca));

    if (ids && ids.length === 0) {
      return {
        totalPacientes: 0,
        totalLiberacoes: 0,
        totalValesAutorizados: 0,
        totalValesRetirados: 0,
        saldoTotal: 0,
        totalLiberacoesContinuas: 0,
        totalLiberacoesAvulsas: 0,
        linhas: [],
      };
    }

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const tipoLiberacao = normalizarTermo(filtros.tipoLiberacao);

    let queryLiberacoes = this.client
      .from("liberacoes")
      .select("paciente_id, tipo, quantidade, pacientes(id, gestor_sus, nome)");
    if (de) queryLiberacoes = queryLiberacoes.gte("data_inicio", de);
    if (ate) queryLiberacoes = queryLiberacoes.lte("data_inicio", ate);
    if (tipoLiberacao) queryLiberacoes = queryLiberacoes.eq("tipo", tipoLiberacao);
    if (pacienteId) queryLiberacoes = queryLiberacoes.eq("paciente_id", pacienteId);
    else if (ids) queryLiberacoes = queryLiberacoes.in("paciente_id", ids);

    let queryRetiradas = this.client
      .from("retiradas")
      .select(
        "paciente_id, quantidade, pacientes(id, gestor_sus, nome), liberacoes!inner(tipo)"
      );
    if (de) queryRetiradas = queryRetiradas.gte("data_hora", de);
    if (ate) queryRetiradas = queryRetiradas.lte("data_hora", ate);
    // Filtro de tipo propagado pela RELAÇÃO (retiradas.liberacao_id →
    // liberacoes.tipo) direto no PostgREST — sem filtragem em memória e sem
    // N+1. O embed usa !inner porque filtro por relação SEM !inner afeta
    // apenas o conteúdo do embed, NÃO as linhas de topo (semântica PostgREST).
    // Com !inner, a consulta B passa a INNER JOIN e exclui retiradas cuja
    // liberação não é do tipo filtrado. Sem filtro, permanecem retiradas de
    // ambos os tipos — seguro pois retiradas.liberacao_id é NOT NULL (o join
    // nunca descarta linha quando não há filtro).
    if (tipoLiberacao) {
      queryRetiradas = queryRetiradas.eq("liberacoes.tipo", tipoLiberacao);
    }
    if (pacienteId) queryRetiradas = queryRetiradas.eq("paciente_id", pacienteId);
    else if (ids) queryRetiradas = queryRetiradas.in("paciente_id", ids);

    // As duas consultas são independentes — executam em paralelo.
    const [liberacoesResultado, retiradasResultado] = await Promise.all([
      queryLiberacoes.order("data_inicio", { ascending: false }),
      queryRetiradas,
    ]);

    if (liberacoesResultado.error) throw mapSupabaseError(liberacoesResultado.error);
    if (retiradasResultado.error) throw mapSupabaseError(retiradasResultado.error);

    return agregarResumo(
      (liberacoesResultado.data ?? []) as unknown as LiberacaoResumoBruta[],
      (retiradasResultado.data ?? []) as unknown as RetiradaResumoBruta[]
    );
  }
}