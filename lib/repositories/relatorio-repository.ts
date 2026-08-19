import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import {
  POR_PAGINA_RELATORIO,
  type FiltrosRelatorio,
  type ResultadoListaRelatorio,
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

// Contrato usado pelos services (permite injeção de fakes nos testes).
export interface RelatorioRepository {
  listarLiberacoes(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
  listarRetiradas(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
  listarConsolidado(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
  listarHistorico(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio>;
}

// Colunas do paciente embutidas nos relatórios (nunca CPF — o contrato de
// relatório não exige; pacientes_com_cpf continua restrito ao Gestor).
const COLUNAS_PACIENTE = "id, gestor_sus, nome";

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
  private async resolverIdsPacientes(termo?: string): Promise<string[] | null> {
    if (!termo) return null;
    const { data: pacientes, error } = await this.client
      .from("v_pacientes")
      .select("id")
      .or(`nome.ilike.%${termo}%,gestor_sus.ilike.%${termo}%`)
      .limit(100);

    if (error) throw mapSupabaseError(error);
    return (pacientes ?? []).map((p: { id: string }) => p.id);
  }

  async listarLiberacoes(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    const porPagina = POR_PAGINA_RELATORIO;
    const offset = (filtros.pagina - 1) * porPagina;

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const tipoLiberacao = normalizarTermo(filtros.tipoLiberacao);
    const ids = await this.resolverIdsPacientes(normalizarTermo(filtros.busca));

    if (ids && ids.length === 0) {
      return {
        tipo: "liberacoes",
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
      };
    }

    let query = this.client
      .from("liberacoes")
      .select(
        `*, pacientes(${COLUNAS_PACIENTE}), autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey(id, nome), retiradas(quantidade)`,
        { count: "exact" }
      );

    if (de) query = query.gte("data_inicio", de);
    if (ate) query = query.lte("data_inicio", ate);
    if (tipoLiberacao) query = query.eq("tipo", tipoLiberacao);
    if (ids) query = query.in("paciente_id", ids);

    const { data, error, count } = await query
      .order("data_inicio", { ascending: false })
      .range(offset, offset + porPagina - 1);

    if (error) throw mapSupabaseError(error);

    return {
      tipo: "liberacoes",
      linhas: (data ?? []).map((linha) =>
        mapearLinhaLiberacoes(linha as LinhaLiberacaoBruta)
      ),
      total: count ?? 0,
      pagina: filtros.pagina,
      porPagina,
    };
  }

  async listarRetiradas(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    const porPagina = POR_PAGINA_RELATORIO;
    const offset = (filtros.pagina - 1) * porPagina;

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const ids = await this.resolverIdsPacientes(normalizarTermo(filtros.busca));

    if (ids && ids.length === 0) {
      return {
        tipo: "retiradas",
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
      };
    }

    let query = this.client
      .from("retiradas")
      .select(
        `*, pacientes(${COLUNAS_PACIENTE}), liberacoes(id, tipo, quantidade), recepcionista:usuarios!retiradas_recepcionista_id_fkey(id, nome)`,
        { count: "exact" }
      );

    if (de) query = query.gte("data_hora", de);
    if (ate) query = query.lte("data_hora", ate);
    if (ids) query = query.in("paciente_id", ids);

    const { data, error, count } = await query
      .order("data_hora", { ascending: false })
      .range(offset, offset + porPagina - 1);

    if (error) throw mapSupabaseError(error);

    return {
      tipo: "retiradas",
      linhas: (data ?? []).map((linha) =>
        mapearLinhaRetiradas(linha as LinhaRetiradaBruta)
      ),
      total: count ?? 0,
      pagina: filtros.pagina,
      porPagina,
    };
  }

  // Consolidado por liberação: autorizado (quantidade) vs. entregue (Σ
  // retiradas), com saldo derivado no servidor. Somente leitura via RLS.
  async listarConsolidado(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    const porPagina = POR_PAGINA_RELATORIO;
    const offset = (filtros.pagina - 1) * porPagina;

    const de = normalizarTermo(filtros.de);
    const ate = normalizarDataAte(filtros.ate);
    const tipoLiberacao = normalizarTermo(filtros.tipoLiberacao);
    const ids = await this.resolverIdsPacientes(normalizarTermo(filtros.busca));

    if (ids && ids.length === 0) {
      return {
        tipo: "consolidado",
        linhas: [],
        total: 0,
        pagina: filtros.pagina,
        porPagina,
      };
    }

    let query = this.client
      .from("liberacoes")
      .select(`*, pacientes(${COLUNAS_PACIENTE}), retiradas(quantidade)`, {
        count: "exact",
      });

    if (de) query = query.gte("data_inicio", de);
    if (ate) query = query.lte("data_inicio", ate);
    if (tipoLiberacao) query = query.eq("tipo", tipoLiberacao);
    if (ids) query = query.in("paciente_id", ids);

    const { data, error, count } = await query
      .order("data_inicio", { ascending: false })
      .range(offset, offset + porPagina - 1);

    if (error) throw mapSupabaseError(error);

    return {
      tipo: "consolidado",
      linhas: (data ?? []).map((linha) =>
        mapearLinhaConsolidado(linha as LinhaConsolidadoBruta)
      ),
      total: count ?? 0,
      pagina: filtros.pagina,
      porPagina,
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
    const { data: paciente, error: erroPaciente } = await this.client
      .from("v_pacientes")
      .select("id, gestor_sus, nome")
      .eq("id", pacienteId)
      .maybeSingle();

    if (erroPaciente) throw mapSupabaseError(erroPaciente);

    const pacienteResolvido = paciente as
      | { id: string; gestor_sus: string; nome: string }
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

    let query = this.client
      .from("liberacoes")
      .select(
        `*, autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey(id, nome), registrador:usuarios!liberacoes_registrado_por_id_fkey(id, nome), retiradas(data_hora, quantidade), origem:liberacoes!liberacoes_renovacao_de_id_fkey(id, data_inicio, tipo, quantidade)`,
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
}