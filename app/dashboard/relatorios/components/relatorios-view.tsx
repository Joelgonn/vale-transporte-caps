"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";
import { PatientSearch } from "@/components/ui/patient-search";
import {
  TIPOS_RELATORIO,
  type FiltrosRelatorio,
  type ResultadoListaRelatorio,
  type ResultadoResumoRelatorio,
} from "@/lib/domain/relatorios/types";
import {
  ROTULO_TIPO_RELATORIO,
  descreverPeriodo,
  formatarData,
  formatarDataHora,
  rotuloStatusLiberacao,
  rotuloTipoLiberacao,
} from "@/lib/domain/relatorios/rotulos";
import {
  BOTAO_SECUNDARIO,
  CARTAO,
  CONTAINER,
} from "@/components/ui/visual-tokens";
import { STATUS_LIBERACAO } from "@/lib/domain/enums";
import { rotuloOrigemLiberacao } from "@/lib/domain/relatorios/rotulos";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro } from "@/components/ui/feedback";

import {
  ItemHistorico,
} from "@/lib/domain/relatorios/types";
import {
  textoVencimento,
  isProximoVencimento,
} from "@/lib/domain/relatorios/consolidado";
import {
  textoVencimentoLiberacoes,
  isProximoVencimentoLiberacoes,
  calcularPacientesMultiplasAtivas,
} from "@/lib/domain/relatorios/liberacoes";
import { ROTULO_ORIGEM_PACIENTE } from "@/lib/domain/enums";

// Sprint 56 — tooltips curtos para cada aba
const TOOLTIP_TIPO_RELATORIO: Record<string, string> = {
  resumo: "Visão geral dos principais indicadores de vales autorizados e retirados no período.",
  liberacoes: "Consulte as liberações autorizadas, seus períodos, tipos, status e situações que merecem atenção.",
  retiradas: "Consulte as retiradas realmente realizadas, quando ocorreram, quanto foi retirado e a qual liberação pertencem.",
  consolidado: "Compare o previsto com o realizado e identifique liberações sem retirada, próximas do vencimento ou acima da previsão.",
  historico: "Consulte a trajetória de um paciente e acompanhe liberações e retiradas em ordem cronológica.",
};

type RelatoriosViewProps = {
  filtros: FiltrosRelatorio;
  resultado: ResultadoListaRelatorio | null;
  resumo?: ResultadoResumoRelatorio | null;
  erroInicial: string | null;
  candidatos?: { id: string; gestor_sus: string; nome: string }[];
  pacienteSelecionado?: { id: string; gestor_sus: string; nome: string } | null;
};

// URL com os filtros atuais + ajustes (troca de tipo/paginação/limpar).
// Mantém o tipo selecionado e os filtros do usuário ao navegar.
// Para o histórico por paciente, `paciente`, `status` e `origem` são
// incluídos na URL e limpos ao trocar de tipo de relatório.
function construirUrl(filtros: FiltrosRelatorio, ajustes: Partial<FiltrosRelatorio>): string {
  const params = new URLSearchParams();
  const uniao = { ...filtros, ...ajustes };
  params.set("tipo", uniao.tipo);
  if (uniao.de) params.set("de", uniao.de);
  if (uniao.ate) params.set("ate", uniao.ate);
  if (uniao.busca) params.set("busca", uniao.busca);
  if (uniao.tipoLiberacao) params.set("tl", uniao.tipoLiberacao);
  if (uniao.paciente) params.set("paciente", uniao.paciente);
  if (uniao.status) params.set("status", uniao.status);
  if (uniao.origem) params.set("origem", uniao.origem);
  const sit = uniao.situacaoRetiradas ?? uniao.situacaoLiberacoes ?? uniao.situacaoConsolidado;
  if (sit) params.set("sit", sit);
  if (uniao.pagina > 1) params.set("pagina", String(uniao.pagina));
  return `/dashboard/relatorios?${params.toString()}`;
}

const INPUT =
  "h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 motion-reduce:transition-none";

// Barra de navegação unificada dos relatórios — desktop: linha única; mobile: scroll horizontal
function NavAbas({ filtros }: { filtros: FiltrosRelatorio }) {
  return (
    <div className="-mx-4 px-4 lg:mx-0 lg:px-0 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
      <nav
        aria-label="Tipo de relatório"
        className="flex w-max min-w-full lg:w-full lg:min-w-0 items-center gap-1 rounded-xl border border-zinc-200/70 bg-zinc-100/60 p-1.5"
      >
        {TIPOS_RELATORIO.map((tipo) => {
          const ativo = filtros.tipo === tipo;
          return (
            <Link
              key={tipo}
              title={TOOLTIP_TIPO_RELATORIO[tipo] ?? ""}
              href={construirUrl(filtros, {
                tipo,
                pagina: 1,
                paciente: null,
                status: null,
                origem: null,
                situacaoConsolidado: null,
                situacaoLiberacoes: null,
                situacaoRetiradas: null,
              })}
              aria-current={ativo ? "page" : undefined}
              className={
                ativo
                  ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  : "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-4 text-sm font-medium text-zinc-600 hover:bg-white hover:text-zinc-900 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              }
            >
              {ROTULO_TIPO_RELATORIO[tipo]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function RelatoriosView(props: RelatoriosViewProps) {
  const { filtros, resultado, resumo, erroInicial, candidatos: _candidatos, pacienteSelecionado } = props;
  void _candidatos;
  const router = useRouter();

  const ehHistorico = filtros.tipo === "historico";
  const total = resultado?.total ?? 0;
  const porPagina = resultado?.porPagina ?? 20;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const semFiltros =
    !filtros.de && !filtros.ate && !filtros.busca && !filtros.paciente && !filtros.tipoLiberacao;
  const mostraFiltroTipo =
    filtros.tipo === "liberacoes" ||
    filtros.tipo === "consolidado" ||
    filtros.tipo === "resumo";
  let temFiltrosAdicionais = false;

  // ---------------------------------------------------------------
  // Ramificação RESUMO gerencial (Sprint 40)
  // ---------------------------------------------------------------
  if (filtros.tipo === "resumo") {
    return (
      <div className="flex flex-1 flex-col py-6">
        <div className={`${CONTAINER} flex flex-col gap-6`}>
          <PageHeader
            titulo="Relatórios"
            descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
          />

          {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

          {/* Seletor de tipo (compartilhado com as demais abas). */}
          <NavAbas filtros={filtros} />

          {pacienteSelecionado ? (
            <div className={`${CARTAO} flex items-center justify-between gap-3 p-4`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-900">{pacienteSelecionado.nome}</p>
                <p className="text-xs text-zinc-500">SUS {pacienteSelecionado.gestor_sus}</p>
              </div>
              <button type="button" onClick={() => router.push(construirUrl(filtros, { paciente: null, pagina: 1 }))} className={BOTAO_SECUNDARIO}>
                Limpar
              </button>
            </div>
          ) : (
            <div className={`${CARTAO} p-4`}>
              <PatientSearch
                id="relatorios-resumo-patient"
                label="Paciente (nome ou Gestor SUS)"
                placeholder="🔎 Nome ou Gestor SUS..."
                onSelect={(p) => router.push(construirUrl(filtros, { paciente: p.id, busca: null, pagina: 1 }))}
              />
            </div>
          )}

          {/* Filtros — mesmos campos das demais abas, aplicados no servidor. */}
          <form
            method="get"
            action="/dashboard/relatorios"
            aria-label="Filtros do resumo"
            className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-end ${CARTAO}`}
          >
            <input type="hidden" name="tipo" value="resumo" />
            {filtros.paciente && <input type="hidden" name="paciente" value={filtros.paciente} />}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-resumo-tipo" className="text-xs font-medium text-zinc-600">
                Tipo de liberação
              </label>
              <select
                id="relatorios-resumo-tipo"
                name="tl"
                defaultValue={filtros.tipoLiberacao ?? ""}
                className={INPUT}
              >
                <option value="">Todos</option>
                {Object.values(TIPOS_LIBERACAO).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {rotuloTipoLiberacao(tipo)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-resumo-de" className="text-xs font-medium text-zinc-600">
                De
              </label>
              <input
                id="relatorios-resumo-de"
                name="de"
                type="date"
                defaultValue={filtros.de ?? ""}
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-resumo-ate" className="text-xs font-medium text-zinc-500">
                Até
              </label>
              <input
                id="relatorios-resumo-ate"
                name="ate"
                type="date"
                defaultValue={filtros.ate ?? ""}
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-1.5 lg:ml-1 lg:flex-row">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-md bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Filtrar
              </button>
              <Link
                href={construirUrl(filtros, {
                  de: null,
                  ate: null,
                  busca: null,
                  tipoLiberacao: null,
                  pagina: 1,
                  paciente: null,
                  status: null,
                  origem: null,
                })}
                className={BOTAO_SECUNDARIO}
              >
                Limpar
              </Link>
            </div>
          </form>

          {/* Semântica do período — explícita para não misturar interpretações. */}
          {resumo && resumo.totalPacientes > 0 && !erroInicial && (
            <p className="text-xs text-zinc-500" aria-live="polite">
              Vales previstos: previsão administrativa das liberações iniciadas no
              período — não limita a retirada. Vales
              retirados: retiradas realizadas no período.
            </p>
          )}

          {!erroInicial && (!resumo || resumo.totalPacientes === 0) && (
            <EstadoVazio mensagem="Nenhum dado encontrado para os filtros selecionados." />
          )}

          {!erroInicial && resumo && resumo.totalPacientes > 0 && (
            <>
              {/* Cards principais. */}
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { rotulo: "Pacientes", valor: resumo.totalPacientes },
                  { rotulo: "Liberações", valor: resumo.totalLiberacoes },
                  { rotulo: "Vales previstos", valor: resumo.totalValesAutorizados },
                  { rotulo: "Vales retirados", valor: resumo.totalValesRetirados },
                  { rotulo: "Diferença", valor: resumo.saldoTotal },
                ].map((card) => (
                  <div key={card.rotulo} className={`${CARTAO} p-4`}>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500">
                      {card.rotulo}
                    </dt>
                    <dd
                      className={`mt-1 text-2xl font-semibold ${
                        card.rotulo === "Diferença" && card.valor < 0
                          ? "text-red-700"
                          : "text-brand-900"
                      }`}
                    >
                      {card.valor}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Distribuição por tipo. */}
              <p className="text-sm text-zinc-600">
                Liberações contínuas:{" "}
                <span className="font-medium text-brand-900">
                  {resumo.totalLiberacoesContinuas}
                </span>{" "}
                · Liberações avulsas:{" "}
                <span className="font-medium text-brand-900">
                  {resumo.totalLiberacoesAvulsas}
                </span>
              </p>

              {/* Tabela por paciente — desktop + cards mobile. */}
              <PainelResumoPacientes linhas={resumo.linhas} />
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Ramificação HISTÓRICO POR PACIENTE (Sprint 38, corrigido Sprint 56)
  // ---------------------------------------------------------------
  if (ehHistorico) {
    // Etapa de busca: nenhum paciente selecionado — PatientSearch sempre visível.
    if (!resultado) {
      return (
        <div className="flex flex-1 flex-col py-6">
          <div className={`${CONTAINER} flex flex-col gap-6`}>
            <PageHeader
              titulo="Relatórios"
              descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
            />
            {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

            <NavAbas filtros={filtros} />

            <div className={`${CARTAO} p-4`}>
              <PatientSearch
                id="relatorios-historico-patient"
                label="Paciente (nome ou Gestor SUS)"
                placeholder="Nome ou Gestor SUS..."
                onSelect={(p) => router.push(construirUrl({ ...filtros, tipo: "historico", pagina: 1 }, { paciente: p.id, busca: null }))}
              />
              <p className="mt-2 text-xs text-zinc-500">Digite o nome ou Gestor SUS para localizar um paciente.</p>
            </div>
          </div>
        </div>
      );
    }

    // Garantia de tipo: quando ehHistorico, o resultado é SEMPRE a variante
    // "historico" (o servidor só devolve histórico para tipo=historico). Esta
    // guarda restaura o narrowing perdido para os campos do histórico.
    if (resultado.tipo !== "historico") {
      return null;
    }

    // Etapa de histórico: paciente selecionado, renderizar linha do tempo.
    // resultado.paciente pode ser null (patient not found).
    if (ehHistorico && resultado && ((resultado as { paciente?: unknown }).paciente == null)) {
      return (
        <div className="flex flex-1 flex-col py-6">
          <div className={`${CONTAINER} flex flex-col gap-6`}>
            <PageHeader
              titulo="Relatórios"
              descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
            />
            <FeedbackErro>Paciente não encontrado.</FeedbackErro>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center rounded-md bg-brand-900 px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Buscar outro paciente
            </button>
          </div>
        </div>
      );
    }

    // Histórico com itens — renderizar linha do tempo.
    if (ehHistorico && resultado && resultado.linhas.length > 0) {
      const paciente = ((resultado as { paciente?: { id: string; gestor_sus: string; nome: string; origem?: string | null; created_at?: string | null } | null }).paciente!);
      const total = resultado.total;
      const porPagina = resultado.porPagina;
      const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

      // Determina se há filtros ativos além do paciente.
      const filtroStatusAtivo = !!filtros.status;
      const filtroOrigemAtiva = !!filtros.origem;
      temFiltrosAdicionais = filtroStatusAtivo || filtroOrigemAtiva || !!filtros.de || !!filtros.ate || !!filtros.tipoLiberacao;

      return (
        <div className="flex flex-1 flex-col py-6">
          <div className={`${CONTAINER} flex flex-col gap-6`}>
            <PageHeader
              titulo="Relatórios"
              descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
            />

            <NavAbas filtros={filtros} />

            {/* Cabeçalho do paciente */}
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium text-brand-900">{paciente.nome}</p>
                <p className="text-xs text-zinc-500">
                  SUS {paciente.gestor_sus} {paciente.origem ? `· ${ROTULO_ORIGEM_PACIENTE[paciente.origem as keyof typeof ROTULO_ORIGEM_PACIENTE] ?? paciente.origem}` : ""}
                </p>
              </div>
              <Link
                href={construirUrl(filtros, { paciente: null, busca: null, status: null, origem: null, tipoLiberacao: null, de: null, ate: null, pagina: 1 })}
                className={BOTAO_SECUNDARIO}
              >
                Trocar paciente
              </Link>
            </div>

            {/* Contador e estado vazio */}
            {total > 0 && (
              <p className="text-sm text-zinc-500" aria-live="polite">
                {total} {total === 1 ? "registro" : "registros"} encontrado
                {total === 1 ? "" : "s"}.
              </p>
            )}

            {!total && !erroInicial && (
              <EstadoVazio
                mensagem={
                  temFiltrosAdicionais
                    ? "O paciente não possui liberações para os filtros."
                    : "O paciente não possui liberações registradas."
                }
              />
            )}

            {/* Filtros aplicados (status + origem) — apenas para histórico */}
            {temFiltrosAdicionais && (
              <form
                method="get"
                action="/dashboard/relatorios"
                aria-label="Filtros adicionais do histórico"
                className={`${CONTAINER} flex flex-col gap-3 p-4 lg:flex-row lg:items-end ${CARTAO}`}
              >
                <input type="hidden" name="tipo" value="historico" />
                <input type="hidden" name="paciente" value={paciente.id} />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="historico-filtro-status" className="text-xs font-medium text-zinc-600">
                    Status
                  </label>
                  <select
                    id="historico-filtro-status"
                    name="status"
                    defaultValue={filtros.status ?? ""}
                    className={INPUT}
                  >
                    <option value="">Todos</option>
                    {Object.values(STATUS_LIBERACAO).map((s) => (
                      <option key={s} value={s}>
                        {rotuloStatusLiberacao(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="historico-filtro-origem" className="text-xs font-medium text-zinc-600">
                    Origem
                  </label>
                  <select
                    id="historico-filtro-origem"
                    name="origem"
                    defaultValue={filtros.origem ?? ""}
                    className={INPUT}
                  >
                    <option value="">Todos</option>
                    <option value="original">Somente originais</option>
                    <option value="renovacao">Somente renovações</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 lg:ml-1 lg:flex-row">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-md bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    Aplicar
                  </button>
                  <Link
                    href={construirUrl(filtros, {
                      paciente: paciente.id,
                      status: null,
                      origem: null,
                      tipoLiberacao: null,
                      de: null,
                      ate: null,
                      pagina: 1,
                    })}
                    className={BOTAO_SECUNDARIO}
                  >
                    Limpar
                  </Link>
                </div>
              </form>
            )}

            {/* Linha do tempo funcional — eventos reais ordenados cronologicamente (mais recente primeiro) */}
            <HistoricoTimeline linhas={resultado.linhas} paciente={paciente} />

            {/* Paginação preservando paciente e filtros */}
            {total > 0 && (
              <nav
                aria-label="Paginação"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p className="text-sm text-zinc-500">
                  Página {filtros.pagina} de {totalPaginas}
                </p>
                <div className="flex gap-2">
                  {filtros.pagina > 1 && (
                    <Link
                      href={construirUrl(filtros, {
                        paciente: paciente.id,
                        status: filtroStatusAtivo ? filtros.status : null,
                        origem: filtroOrigemAtiva ? filtros.origem : null,
                        tipoLiberacao: null,
                        de: null,
                        ate: null,
                        pagina: filtros.pagina - 1,
                      })}
                      className={BOTAO_SECUNDARIO}
                    >
                      Anterior
                    </Link>
                  )}
                  {filtros.pagina < totalPaginas && (
                    <Link
                      href={construirUrl(filtros, {
                        paciente: paciente.id,
                        status: filtroStatusAtivo ? filtros.status : null,
                        origem: filtroOrigemAtiva ? filtros.origem : null,
                        tipoLiberacao: null,
                        de: null,
                        ate: null,
                        pagina: filtros.pagina + 1,
                      })}
                      className={BOTAO_SECUNDARIO}
                    >
                      Próxima
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </div>
        </div>
      );
    }

    // Histórico com zero itens (paciente selecionado mas sem liberações).
    if (resultado && resultado.linhas.length === 0 && resultado.paciente != null) {
      return (
        <div className="flex flex-1 flex-col py-6">
          <div className={`${CONTAINER} flex flex-col gap-6`}>
            <PageHeader
              titulo="Relatórios"
              descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
            />
            <NavAbas filtros={filtros} />
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium text-brand-900">{resultado.paciente!.nome}</p>
                <p className="text-xs text-zinc-500">SUS {resultado.paciente!.gestor_sus}</p>
              </div>
              <Link
                href={construirUrl(filtros, { paciente: null, busca: null, status: null, origem: null, tipoLiberacao: null, de: null, ate: null, pagina: 1 })}
                className={BOTAO_SECUNDARIO}
              >
                Trocar paciente
              </Link>
            </div>
            <EstadoVazio mensagem="Não há movimentações históricas registradas para este paciente." />
           </div>
         </div>
       );
     }

      // Fallback caso resultado exista mas linhas tenham sido removidas inesperadamente.
      if (resultado && resultado.linhas.length === 0) {
        return (
          <div className="flex flex-1 flex-col py-6">
            <div className={`${CONTAINER} flex flex-col gap-6`}>
              <PageHeader
                titulo="Relatórios"
                descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
              />
              <NavAbas filtros={filtros} />
              <EstadoVazio mensagem="Não há movimentações históricas registradas para este paciente." />
          </div>
        </div>
      );
    }
  }

  // ---------------------------------------------------------------
  // Fluxo CONSOLIDADO OPERACIONAL (Sprint 53) — ferramenta de conferência
  // ---------------------------------------------------------------
  if (filtros.tipo === "consolidado") {
    const consolidado =
      resultado && resultado.tipo === "consolidado"
        ? (resultado as Extract<ResultadoListaRelatorio, { tipo: "consolidado" }>)
        : null;
    const situacao = filtros.situacaoConsolidado ?? null;
    const temConsolidado = !!consolidado;
    const totalConsolidado = consolidado?.total ?? 0;
    const porPaginaConsolidado = consolidado?.porPagina ?? 20;
    const totalPaginasConsolidado = Math.max(1, Math.ceil(totalConsolidado / porPaginaConsolidado));
    const totais = consolidado?.totais ?? { previsto: 0, retirado: 0, diferenca: 0, liberacoes: 0 };
    const porTipo = consolidado?.porTipo ?? {
      continua: { previsto: 0, retirado: 0, diferenca: 0, liberacoes: 0 },
      avulsa: { previsto: 0, retirado: 0, diferenca: 0, liberacoes: 0 },
    };
    const porPaciente = consolidado?.porPaciente ?? [];
    const contadores = consolidado?.contadores ?? {
      estouros: 0,
      semRetirada: 0,
      proximoVencimento: 0,
      expiradaSemUso: 0,
    };
    const semFiltrosConsolidado =
      !filtros.de && !filtros.ate && !filtros.busca && !filtros.paciente && !filtros.tipoLiberacao && !situacao;

    return (
      <div className="flex flex-1 flex-col py-6">
        <div className={`${CONTAINER} flex flex-col gap-6`}>
          <PageHeader
            titulo="Relatórios"
            descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
          />

          {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

          {/* Seletor de tipo */}
          <NavAbas filtros={filtros} />

          {pacienteSelecionado ? (
            <div className={`${CARTAO} flex items-center justify-between gap-3 p-4`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-900">{pacienteSelecionado.nome}</p>
                <p className="text-xs text-zinc-500">SUS {pacienteSelecionado.gestor_sus}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push(construirUrl(filtros, { paciente: null, pagina: 1 }))}
                className={BOTAO_SECUNDARIO}
              >
                Limpar
              </button>
            </div>
          ) : (
            <div className={`${CARTAO} p-4`}>
              <PatientSearch
                id="relatorios-patient"
                label="Paciente (nome ou Gestor SUS)"
                placeholder="🔎 Nome ou Gestor SUS..."
                onSelect={(p) => router.push(construirUrl(filtros, { paciente: p.id, busca: null, pagina: 1 }))}
              />
            </div>
          )}

          {/* Filtros — aplicados no servidor (GET). */}
          <form
            method="get"
            action="/dashboard/relatorios"
            aria-label="Filtros de relatórios"
            className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-end ${CARTAO}`}
          >
            <input type="hidden" name="tipo" value={filtros.tipo} />
            {filtros.paciente && <input type="hidden" name="paciente" value={filtros.paciente} />}
            {situacao && <input type="hidden" name="sit" value={situacao} />}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-tipo" className="text-xs font-medium text-zinc-600">
                Tipo de liberação
              </label>
              <select
                id="relatorios-filtro-tipo"
                name="tl"
                defaultValue={filtros.tipoLiberacao ?? ""}
                className={INPUT}
              >
                <option value="">Todos</option>
                {Object.values(TIPOS_LIBERACAO).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {rotuloTipoLiberacao(tipo)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-de" className="text-xs font-medium text-zinc-600">
                De
              </label>
              <input
                id="relatorios-filtro-de"
                name="de"
                type="date"
                defaultValue={filtros.de ?? ""}
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-ate" className="text-xs font-medium text-zinc-500">
                Até
              </label>
              <input
                id="relatorios-filtro-ate"
                name="ate"
                type="date"
                defaultValue={filtros.ate ?? ""}
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-1.5 lg:ml-1 lg:flex-row">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-md bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Filtrar
              </button>
              <Link
                href={construirUrl(filtros, {
                  de: null,
                  ate: null,
                  busca: null,
                  tipoLiberacao: null,
                  pagina: 1,
                  paciente: null,
                  status: null,
                  origem: null,
                  situacaoConsolidado: null,
                  situacaoLiberacoes: null,
                })}
                className={BOTAO_SECUNDARIO}
              >
                Limpar
              </Link>
            </div>
          </form>

          {/* Glossário curto */}
          <div className={`${CARTAO} p-4`}>
            <p className="text-xs leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-700">Previsto</span> = quantidade autorizada na liberação.{" "}
              <span className="font-medium text-zinc-700">Retirado</span> = quantidade efetivamente registrada nas
              retiradas. <span className="font-medium text-zinc-700">Diferença</span> = previsto − retirado. Valor
              negativo indica retirada acima da previsão — isso é permitido e não bloqueia novas retiradas (RN31).
            </p>
          </div>

          {!erroInicial && !temConsolidado && (
            <p className="text-sm text-zinc-500" aria-live="polite">
              Carregando consolidado...
            </p>
          )}

          {!erroInicial && temConsolidado && totalConsolidado === 0 && !semFiltrosConsolidado && situacao && (
            <EstadoVazio mensagem="Não há liberações nesta situação." />
          )}

          {!erroInicial && temConsolidado && totalConsolidado === 0 && (!situacao || semFiltrosConsolidado) && (
            <EstadoVazio
              mensagem={
                semFiltrosConsolidado
                  ? "Não há liberações para os filtros selecionados."
                  : "Não há liberações para os filtros selecionados."
              }
            />
          )}

          {!erroInicial && temConsolidado && totalConsolidado > 0 && (
            <>
              {/* NÍVEL 1 — RESUMO OPERACIONAL */}
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Previsto</dt>
                  <dd className="mt-1 text-2xl font-semibold text-brand-900">{totais.previsto}</dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Retirado</dt>
                  <dd className="mt-1 text-2xl font-semibold text-brand-900">{totais.retirado}</dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Diferença</dt>
                  <dd className={`mt-1 text-2xl font-semibold ${totais.diferenca < 0 ? "text-red-700" : "text-brand-900"}`}>
                    {totais.diferenca > 0 ? `+${totais.diferenca}` : `${totais.diferenca}`}
                  </dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Liberações</dt>
                  <dd className="mt-1 text-2xl font-semibold text-brand-900">{totais.liberacoes}</dd>
                </div>
              </dl>

              {/* Contadores secundários quando aplicável */}
              {(contadores.estouros > 0 ||
                contadores.semRetirada > 0 ||
                contadores.proximoVencimento > 0 ||
                contadores.expiradaSemUso > 0) && (
                <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {contadores.estouros > 0 && (
                    <div className={`${CARTAO} border-l-4 border-l-red-500 p-4`}>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Estouros</dt>
                      <dd className="mt-1 text-xl font-semibold text-red-700">{contadores.estouros}</dd>
                    </div>
                  )}
                  {contadores.semRetirada > 0 && (
                    <div className={`${CARTAO} border-l-4 border-l-amber-400 p-4`}>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Sem uso</dt>
                      <dd className="mt-1 text-xl font-semibold text-amber-700">{contadores.semRetirada}</dd>
                    </div>
                  )}
                  {contadores.proximoVencimento > 0 && (
                    <div className={`${CARTAO} border-l-4 border-l-orange-400 p-4`}>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Próximas do vencimento</dt>
                      <dd className="mt-1 text-xl font-semibold text-orange-700">{contadores.proximoVencimento}</dd>
                    </div>
                  )}
                  {contadores.expiradaSemUso > 0 && (
                    <div className={`${CARTAO} border-l-4 border-l-zinc-400 p-4`}>
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">Expiradas sem uso</dt>
                      <dd className="mt-1 text-xl font-semibold text-zinc-700">{contadores.expiradaSemUso}</dd>
                    </div>
                  )}
                </dl>
              )}

              {/* NÍVEL 2 — SITUAÇÕES QUE MERECEM ATENÇÃO */}
              <div className={`${CARTAO} p-4`}>
                <h3 className="text-sm font-semibold text-brand-900">Situações que merecem atenção</h3>
                <p className="mt-1 text-xs text-zinc-500">Alertas operacionais — não indicam erro automático.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={construirUrl(filtros, { situacaoConsolidado: null, situacaoLiberacoes: null, pagina: 1 })}
                    className={
                      !situacao
                        ? "inline-flex h-8 items-center rounded-full bg-brand-900 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-zinc-300 bg-white px-3.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
                    }
                  >
                    Todos {totais.liberacoes > 0 ? `· ${totais.liberacoes}` : ""}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoConsolidado: "estouro", situacaoLiberacoes: "estouro", pagina: 1 })}
                    className={
                      situacao === "estouro"
                        ? "inline-flex h-8 items-center rounded-full bg-red-600 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-red-200 bg-red-50 px-3.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    }
                  >
                    🔴 Estouro · {contadores.estouros}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoConsolidado: "sem_retirada", situacaoLiberacoes: "sem_retirada", pagina: 1 })}
                    className={
                      situacao === "sem_retirada"
                        ? "inline-flex h-8 items-center rounded-full bg-amber-500 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    }
                  >
                    🟡 Sem retirada · {contadores.semRetirada}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoConsolidado: "proximo_vencimento", situacaoLiberacoes: "proximo_vencimento", pagina: 1 })}
                    className={
                      situacao === "proximo_vencimento"
                        ? "inline-flex h-8 items-center rounded-full bg-orange-500 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-orange-200 bg-orange-50 px-3.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                    }
                  >
                    🟠 Próximo do vencimento · {contadores.proximoVencimento}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoConsolidado: "expirada_sem_uso", situacaoLiberacoes: "expirada_sem_uso", pagina: 1 })}
                    className={
                      situacao === "expirada_sem_uso"
                        ? "inline-flex h-8 items-center rounded-full bg-zinc-700 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-zinc-300 bg-zinc-50 px-3.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    }
                  >
                    ⚪ Expirada sem uso · {contadores.expiradaSemUso}
                  </Link>
                </div>
              </div>

              {/* Total por tipo */}
              <div className={`${CARTAO} p-4`}>
                <h3 className="text-sm font-semibold text-brand-900">Total por tipo</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Contínuas</p>
                    <p className="mt-1 text-sm text-zinc-700">
                      Previsto <span className="font-semibold text-brand-900">{porTipo.continua.previsto}</span> · Retirado{" "}
                      <span className="font-semibold text-brand-900">{porTipo.continua.retirado}</span> · Diferença{" "}
                      <span className={`font-semibold ${porTipo.continua.diferenca < 0 ? "text-red-700" : "text-brand-900"}`}>
                        {porTipo.continua.diferenca > 0 ? `+${porTipo.continua.diferenca}` : porTipo.continua.diferenca}
                      </span>{" "}
                      <span className="text-xs text-zinc-500">({porTipo.continua.liberacoes} liberações)</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Avulsas</p>
                    <p className="mt-1 text-sm text-zinc-700">
                      Previsto <span className="font-semibold text-brand-900">{porTipo.avulsa.previsto}</span> · Retirado{" "}
                      <span className="font-semibold text-brand-900">{porTipo.avulsa.retirado}</span> · Diferença{" "}
                      <span className={`font-semibold ${porTipo.avulsa.diferenca < 0 ? "text-red-700" : "text-brand-900"}`}>
                        {porTipo.avulsa.diferenca > 0 ? `+${porTipo.avulsa.diferenca}` : porTipo.avulsa.diferenca}
                      </span>{" "}
                      <span className="text-xs text-zinc-500">({porTipo.avulsa.liberacoes} liberações)</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Total por paciente (agrupado) */}
              {porPaciente.length > 0 && (
                <div className={`${CARTAO} p-4`}>
                  <h3 className="text-sm font-semibold text-brand-900">Total por paciente</h3>
                  <p className="mt-1 text-xs text-zinc-500">Acumulado das liberações selecionadas.</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {porPaciente.slice(0, 20).map((p) => (
                      <li key={p.pacienteId} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-brand-900">{p.nome}</p>
                          <p className="text-xs text-zinc-500">SUS {p.gestorSus} · {p.liberacoes} liberação{p.liberacoes !== 1 ? "ões" : ""}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-zinc-500">Previsto {p.previsto} · Retirado {p.retirado}</p>
                          <p className={`text-sm font-semibold ${p.diferenca < 0 ? "text-red-700" : "text-brand-900"}`}>
                            Dif. {p.diferenca > 0 ? `+${p.diferenca}` : p.diferenca}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {porPaciente.length > 20 && (
                    <p className="mt-2 text-xs text-zinc-500">Mostrando 20 de {porPaciente.length} pacientes.</p>
                  )}
                </div>
              )}

              {/* Tabela */}
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-500" aria-live="polite">
                  {totalConsolidado} {totalConsolidado === 1 ? "liberação" : "liberações"} encontrada
                  {totalConsolidado === 1 ? "" : "s"}
                  {situacao ? ` — filtro: ${situacao}` : ""}.
                </p>
                <TabelaConsolidado linhas={consolidado.linhas} filtros={filtros} />
              </div>

              {/* Paginação */}
              {totalConsolidado > 0 && (
                <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">
                    Página {filtros.pagina} de {totalPaginasConsolidado}
                  </p>
                  <div className="flex gap-2">
                    {filtros.pagina > 1 && (
                      <Link
                        href={construirUrl(filtros, { pagina: filtros.pagina - 1 })}
                        className={BOTAO_SECUNDARIO}
                      >
                        Anterior
                      </Link>
                    )}
                    {filtros.pagina < totalPaginasConsolidado && (
                      <Link
                        href={construirUrl(filtros, { pagina: filtros.pagina + 1 })}
                        className={BOTAO_SECUNDARIO}
                      >
                        Próxima
                      </Link>
                    )}
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Fluxo LIBERAÇÕES OPERACIONAIS (Sprint 54)
  // ---------------------------------------------------------------
  if (filtros.tipo === "liberacoes") {
    const liberacoes =
      resultado && resultado.tipo === "liberacoes"
        ? (resultado as Extract<ResultadoListaRelatorio, { tipo: "liberacoes" }>)
        : null;
    const sitLib = filtros.situacaoLiberacoes ?? null;
    const totaisLib = liberacoes?.totais ?? {
      total: 0,
      ativas: 0,
      continuas: 0,
      avulsas: 0,
      proximasVencimento: 0,
      semRetirada: 0,
    };
    const contadoresLib = liberacoes?.contadores ?? {
      proximasVencimento: 0,
      semRetirada: 0,
      expiradaSemUso: 0,
      multiplasAtivas: 0,
      multiplasAtivasLiberacoes: 0,
    };
    const totalLib = liberacoes?.total ?? 0;
    const porPaginaLib = liberacoes?.porPagina ?? 20;
    const totalPaginasLib = Math.max(1, Math.ceil(totalLib / porPaginaLib));
    const semFiltrosLib =
      !filtros.de && !filtros.ate && !filtros.busca && !filtros.paciente && !filtros.tipoLiberacao && !filtros.status && !sitLib;
    return (
      <div className="flex flex-1 flex-col py-6">
        <div className={`${CONTAINER} flex flex-col gap-6`}>
          <PageHeader
            titulo="Relatórios"
            descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
          />

          {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

          <NavAbas filtros={filtros} />

          {pacienteSelecionado ? (
            <div className={`${CARTAO} flex items-center justify-between gap-3 p-4`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-900">{pacienteSelecionado.nome}</p>
                <p className="text-xs text-zinc-500">SUS {pacienteSelecionado.gestor_sus}</p>
              </div>
              <button type="button" onClick={() => router.push(construirUrl(filtros, { paciente: null, pagina: 1 }))} className={BOTAO_SECUNDARIO}>
                Limpar
              </button>
            </div>
          ) : (
            <div className={`${CARTAO} p-4`}>
              <PatientSearch
                id="relatorios-patient"
                label="Paciente (nome ou Gestor SUS)"
                placeholder="🔎 Nome ou Gestor SUS..."
                onSelect={(p) => router.push(construirUrl(filtros, { paciente: p.id, busca: null, pagina: 1 }))}
              />
            </div>
          )}

          <form
            method="get"
            action="/dashboard/relatorios"
            aria-label="Filtros de relatórios"
            className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-end ${CARTAO}`}
          >
            <input type="hidden" name="tipo" value={filtros.tipo} />
            {filtros.paciente && <input type="hidden" name="paciente" value={filtros.paciente} />}
            {sitLib && <input type="hidden" name="sit" value={sitLib} />}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-tipo" className="text-xs font-medium text-zinc-600">
                Tipo de liberação
              </label>
              <select id="relatorios-filtro-tipo" name="tl" defaultValue={filtros.tipoLiberacao ?? ""} className={INPUT}>
                <option value="">Todos</option>
                {Object.values(TIPOS_LIBERACAO).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {rotuloTipoLiberacao(tipo)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-status" className="text-xs font-medium text-zinc-600">
                Status
              </label>
              <select id="relatorios-filtro-status" name="status" defaultValue={filtros.status ?? ""} className={INPUT}>
                <option value="">Todos</option>
                {Object.values(STATUS_LIBERACAO).map((s) => (
                  <option key={s} value={s}>
                    {rotuloStatusLiberacao(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-de" className="text-xs font-medium text-zinc-600">
                De
              </label>
              <input id="relatorios-filtro-de" name="de" type="date" defaultValue={filtros.de ?? ""} className={INPUT} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-ate" className="text-xs font-medium text-zinc-500">
                Até
              </label>
              <input id="relatorios-filtro-ate" name="ate" type="date" defaultValue={filtros.ate ?? ""} className={INPUT} />
            </div>

            <div className="flex flex-col gap-1.5 lg:ml-1 lg:flex-row">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-md bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Filtrar
              </button>
              <Link
                href={construirUrl(filtros, {
                  de: null,
                  ate: null,
                  busca: null,
                  tipoLiberacao: null,
                  pagina: 1,
                  paciente: null,
                  status: null,
                  origem: null,
                  situacaoConsolidado: null,
                  situacaoLiberacoes: null,
                })}
                className={BOTAO_SECUNDARIO}
              >
                Limpar
              </Link>
            </div>
          </form>

          {!erroInicial && !liberacoes && (
            <p className="text-sm text-zinc-500" aria-live="polite">
              Carregando liberações...
            </p>
          )}

          {!erroInicial && liberacoes && totalLib === 0 && sitLib && (
            <EstadoVazio mensagem="Não há liberações nesta situação." />
          )}

          {!erroInicial && liberacoes && totalLib === 0 && !sitLib && (
            <EstadoVazio
              mensagem={
                semFiltrosLib ? "Não há liberações para os filtros selecionados." : "Não há liberações para os filtros selecionados."
              }
            />
          )}

          {!erroInicial && liberacoes && totalLib > 0 && (
            <>
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Liberações</dt>
                  <dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisLib.total}</dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Ativas</dt>
                  <dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisLib.ativas}</dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Próximas do vencimento</dt>
                  <dd className="mt-1 text-2xl font-semibold text-orange-700">{totaisLib.proximasVencimento}</dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Contínuas</dt>
                  <dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisLib.continuas}</dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Avulsas</dt>
                  <dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisLib.avulsas}</dd>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Sem retirada</dt>
                  <dd className="mt-1 text-2xl font-semibold text-amber-700">{totaisLib.semRetirada}</dd>
                </div>
              </dl>

              <div className={`${CARTAO} p-4`}>
                <h3 className="text-sm font-semibold text-brand-900">Situações que merecem atenção</h3>
                <p className="mt-1 text-xs text-zinc-500">Alertas operacionais — não indicam erro automático.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={construirUrl(filtros, { situacaoLiberacoes: null, situacaoConsolidado: null, pagina: 1 })}
                    className={
                      !sitLib
                        ? "inline-flex h-8 items-center rounded-full bg-brand-900 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-zinc-300 bg-white px-3.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
                    }
                  >
                    Todos · {totaisLib.total}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoLiberacoes: "proximo_vencimento", situacaoConsolidado: "proximo_vencimento", pagina: 1 })}
                    className={
                      sitLib === "proximo_vencimento"
                        ? "inline-flex h-8 items-center rounded-full bg-orange-500 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-orange-200 bg-orange-50 px-3.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                    }
                  >
                    🟠 Próximas do vencimento · {contadoresLib.proximasVencimento}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoLiberacoes: "sem_retirada", situacaoConsolidado: "sem_retirada", pagina: 1 })}
                    className={
                      sitLib === "sem_retirada"
                        ? "inline-flex h-8 items-center rounded-full bg-amber-500 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    }
                  >
                    🟡 Sem retirada · {contadoresLib.semRetirada}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoLiberacoes: "expirada_sem_uso", situacaoConsolidado: "expirada_sem_uso", pagina: 1 })}
                    className={
                      sitLib === "expirada_sem_uso"
                        ? "inline-flex h-8 items-center rounded-full bg-zinc-700 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-zinc-300 bg-zinc-50 px-3.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    }
                  >
                    ⚪ Expiradas sem uso · {contadoresLib.expiradaSemUso}
                  </Link>
                  <Link
                    href={construirUrl(filtros, { situacaoLiberacoes: "multiplas_ativas", situacaoConsolidado: "multiplas_ativas", pagina: 1 })}
                    className={
                      sitLib === "multiplas_ativas"
                        ? "inline-flex h-8 items-center rounded-full bg-sky-600 px-3.5 text-xs font-medium text-white"
                        : "inline-flex h-8 items-center rounded-full border border-sky-200 bg-sky-50 px-3.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
                    }
                  >
                    🔵 Múltiplas ativas · {contadoresLib.multiplasAtivas} {contadoresLib.multiplasAtivasLiberacoes > 0 ? `· ${contadoresLib.multiplasAtivasLiberacoes} liberações` : ""}
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-500" aria-live="polite">
                  {totalLib} {totalLib === 1 ? "liberação" : "liberações"} encontrada{totalLib === 1 ? "" : "s"}
                  {sitLib ? ` — filtro: ${sitLib}` : ""}.
                </p>
                <TabelaLiberacoes linhas={liberacoes.linhas} filtros={filtros} />
              </div>

              {totalLib > 0 && (
                <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">
                    Página {filtros.pagina} de {totalPaginasLib}
                  </p>
                  <div className="flex gap-2">
                    {filtros.pagina > 1 && (
                      <Link href={construirUrl(filtros, { pagina: filtros.pagina - 1 })} className={BOTAO_SECUNDARIO}>
                        Anterior
                      </Link>
                    )}
                    {filtros.pagina < totalPaginasLib && (
                      <Link href={construirUrl(filtros, { pagina: filtros.pagina + 1 })} className={BOTAO_SECUNDARIO}>
                        Próxima
                      </Link>
                    )}
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Fluxo RETIRADAS operacionais (Sprint 55)
  // ---------------------------------------------------------------
  if (filtros.tipo === "retiradas") {
    const retiradas =
      resultado && resultado.tipo === "retiradas"
        ? (resultado as Extract<ResultadoListaRelatorio, { tipo: "retiradas" }>)
        : null;
    const sitRet = filtros.situacaoRetiradas ?? null;
    const totaisRet = retiradas?.totais ?? { registros: 0, valesRetirados: 0, pacientesDistintos: 0, avulsas: 0, continuas: 0 };
    const contadoresRet = retiradas?.contadores ?? { acimaPrevisao: 0, foraVigencia: 0 };
    const totalRet = retiradas?.total ?? 0;
    const porPaginaRet = retiradas?.porPagina ?? 20;
    const totalPaginasRet = Math.max(1, Math.ceil(totalRet / porPaginaRet));
    const semFiltrosRet = !filtros.de && !filtros.ate && !filtros.busca && !filtros.paciente && !filtros.tipoLiberacao && !sitRet;
    return (
      <div className="flex flex-1 flex-col py-6">
        <div className={`${CONTAINER} flex flex-col gap-6`}>
          <PageHeader titulo="Relatórios" descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor." />
          {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}
          <NavAbas filtros={filtros} />
          {pacienteSelecionado ? (
            <div className={`${CARTAO} flex items-center justify-between gap-3 p-4`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-900">{pacienteSelecionado.nome}</p>
                <p className="text-xs text-zinc-500">SUS {pacienteSelecionado.gestor_sus}</p>
              </div>
              <button type="button" onClick={() => router.push(construirUrl(filtros, { paciente: null, pagina: 1 }))} className={BOTAO_SECUNDARIO}>
                Limpar
              </button>
            </div>
          ) : (
            <div className={`${CARTAO} p-4`}>
              <PatientSearch id="relatorios-patient" label="Paciente (nome ou Gestor SUS)" placeholder="🔎 Nome ou Gestor SUS..." onSelect={(p) => router.push(construirUrl(filtros, { paciente: p.id, busca: null, pagina: 1 }))} />
            </div>
          )}
          <form method="get" action="/dashboard/relatorios" aria-label="Filtros de relatórios" className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-end ${CARTAO}`}>
            <input type="hidden" name="tipo" value={filtros.tipo} />
            {filtros.paciente && <input type="hidden" name="paciente" value={filtros.paciente} />}
            {sitRet && <input type="hidden" name="sit" value={sitRet} />}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-tipo" className="text-xs font-medium text-zinc-600">Tipo de liberação</label>
              <select id="relatorios-filtro-tipo" name="tl" defaultValue={filtros.tipoLiberacao ?? ""} className={INPUT}>
                <option value="">Todos</option>
                {Object.values(TIPOS_LIBERACAO).map((tipo) => (
                  <option key={tipo} value={tipo}>{rotuloTipoLiberacao(tipo)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-de" className="text-xs font-medium text-zinc-600">De</label>
              <input id="relatorios-filtro-de" name="de" type="date" defaultValue={filtros.de ?? ""} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-ate" className="text-xs font-medium text-zinc-500">Até</label>
              <input id="relatorios-filtro-ate" name="ate" type="date" defaultValue={filtros.ate ?? ""} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1.5 lg:ml-1 lg:flex-row">
              <button type="submit" className="inline-flex h-11 items-center justify-center rounded-md bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">Filtrar</button>
              <Link href={construirUrl(filtros, { de: null, ate: null, busca: null, tipoLiberacao: null, pagina: 1, paciente: null, status: null, origem: null, situacaoConsolidado: null, situacaoLiberacoes: null, situacaoRetiradas: null })} className={BOTAO_SECUNDARIO}>Limpar</Link>
            </div>
          </form>
          {!erroInicial && !retiradas && <p className="text-sm text-zinc-500" aria-live="polite">Carregando retiradas...</p>}
          {!erroInicial && retiradas && totalRet === 0 && sitRet && <EstadoVazio mensagem="Não há retiradas nesta situação." />}
          {!erroInicial && retiradas && totalRet === 0 && !sitRet && <EstadoVazio mensagem={semFiltrosRet ? "Não há retiradas para os filtros selecionados." : "Não há retiradas para os filtros selecionados."} />}
          {!erroInicial && retiradas && totalRet > 0 && (
            <>
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className={`${CARTAO} p-4`}><dt className="text-xs uppercase tracking-wide text-zinc-500">Retiradas</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisRet.registros}</dd></div>
                <div className={`${CARTAO} p-4`}><dt className="text-xs uppercase tracking-wide text-zinc-500">Vales retirados</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisRet.valesRetirados}</dd></div>
                <div className={`${CARTAO} p-4`}><dt className="text-xs uppercase tracking-wide text-zinc-500">Pacientes atendidos</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisRet.pacientesDistintos}</dd></div>
                <div className={`${CARTAO} p-4`}><dt className="text-xs uppercase tracking-wide text-zinc-500">Retiradas avulsas</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisRet.avulsas}</dd></div>
                <div className={`${CARTAO} p-4`}><dt className="text-xs uppercase tracking-wide text-zinc-500">Retiradas contínuas</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{totaisRet.continuas}</dd></div>
                <div className={`${CARTAO} p-4`}><dt className="text-xs uppercase tracking-wide text-zinc-500">Acima da previsão</dt><dd className="mt-1 text-2xl font-semibold text-red-700">{contadoresRet.acimaPrevisao}</dd></div>
              </dl>
              {(contadoresRet.acimaPrevisao > 0 || contadoresRet.foraVigencia > 0) && (
                <div className={`${CARTAO} p-4`}>
                  <h3 className="text-sm font-semibold text-brand-900">Situações que merecem atenção</h3>
                  <p className="mt-1 text-xs text-zinc-500">Indicadores operacionais — não indicam erro automático.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={construirUrl(filtros, { situacaoRetiradas: null, situacaoConsolidado: null, situacaoLiberacoes: null, pagina: 1 })} className={!sitRet ? "inline-flex h-8 items-center rounded-full bg-brand-900 px-3.5 text-xs font-medium text-white" : "inline-flex h-8 items-center rounded-full border border-zinc-300 bg-white px-3.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"}>Todos · {totaisRet.registros}</Link>
                    <Link href={construirUrl(filtros, { situacaoRetiradas: "acima_previsao", situacaoConsolidado: "acima_previsao", situacaoLiberacoes: "acima_previsao", pagina: 1 })} className={sitRet === "acima_previsao" ? "inline-flex h-8 items-center rounded-full bg-red-600 px-3.5 text-xs font-medium text-white" : "inline-flex h-8 items-center rounded-full border border-red-200 bg-red-50 px-3.5 text-xs font-medium text-red-700 hover:bg-red-100"}>🔴 Acima da previsão · {contadoresRet.acimaPrevisao}</Link>
                    {contadoresRet.foraVigencia > 0 && (
                      <Link href={construirUrl(filtros, { situacaoRetiradas: "fora_vigencia", situacaoConsolidado: "fora_vigencia", situacaoLiberacoes: "fora_vigencia", pagina: 1 })} className={sitRet === "fora_vigencia" ? "inline-flex h-8 items-center rounded-full bg-orange-500 px-3.5 text-xs font-medium text-white" : "inline-flex h-8 items-center rounded-full border border-orange-200 bg-orange-50 px-3.5 text-xs font-medium text-orange-700 hover:bg-orange-100"}>🟠 Fora da vigência · {contadoresRet.foraVigencia}</Link>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-500" aria-live="polite">{totalRet} {totalRet === 1 ? "retirada" : "retiradas"} encontrada{totalRet === 1 ? "" : "s"}{sitRet ? ` — filtro: ${sitRet}` : ""}.</p>
                <TabelaRetiradas linhas={retiradas.linhas} filtros={filtros} />
              </div>
              {totalRet > 0 && (
                <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">Página {filtros.pagina} de {totalPaginasRet}</p>
                  <div className="flex gap-2">
                    {filtros.pagina > 1 && <Link href={construirUrl(filtros, { pagina: filtros.pagina - 1 })} className={BOTAO_SECUNDARIO}>Anterior</Link>}
                    {filtros.pagina < totalPaginasRet && <Link href={construirUrl(filtros, { pagina: filtros.pagina + 1 })} className={BOTAO_SECUNDARIO}>Próxima</Link>}
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Fallback (não deve ocorrer)
  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader
          titulo="Relatórios"
          descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
        />

        {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

        {/* Seletor de tipo — troca o relatório preservando filtros. */}
        <NavAbas filtros={filtros} />

        {pacienteSelecionado ? (
          <div className={`${CARTAO} flex items-center justify-between gap-3 p-4`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-900">{pacienteSelecionado.nome}</p>
              <p className="text-xs text-zinc-500">SUS {pacienteSelecionado.gestor_sus}</p>
            </div>
            <button type="button" onClick={() => router.push(construirUrl(filtros, { paciente: null, pagina: 1 }))} className={BOTAO_SECUNDARIO}>
              Limpar
            </button>
          </div>
        ) : (
          <div className={`${CARTAO} p-4`}>
            <PatientSearch
              id="relatorios-patient"
              label="Paciente (nome ou Gestor SUS)"
              placeholder="🔎 Nome ou Gestor SUS..."
              onSelect={(p) => router.push(construirUrl(filtros, { paciente: p.id, busca: null, pagina: 1 }))}
            />
          </div>
        )}

        {/* Filtros — aplicados no servidor (GET). */}
        <form
          method="get"
          action="/dashboard/relatorios"
          aria-label="Filtros de relatórios"
          className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-end ${CARTAO}`}
        >
          <input type="hidden" name="tipo" value={filtros.tipo} />
          {filtros.paciente && <input type="hidden" name="paciente" value={filtros.paciente} />}

          {mostraFiltroTipo && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="relatorios-filtro-tipo" className="text-xs font-medium text-zinc-600">
                Tipo de liberação
              </label>
              <select
                id="relatorios-filtro-tipo"
                name="tl"
                defaultValue={filtros.tipoLiberacao ?? ""}
                className={INPUT}
              >
                <option value="">Todos</option>
                {Object.values(TIPOS_LIBERACAO).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {rotuloTipoLiberacao(tipo)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="relatorios-filtro-de" className="text-xs font-medium text-zinc-600">
              De
            </label>
            <input
              id="relatorios-filtro-de"
              name="de"
              type="date"
              defaultValue={filtros.de ?? ""}
              className={INPUT}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="relatorios-filtro-ate" className="text-xs font-medium text-zinc-500">
              Até
            </label>
            <input
              id="relatorios-filtro-ate"
              name="ate"
              type="date"
              defaultValue={filtros.ate ?? ""}
              className={INPUT}
            />
          </div>

          <div className="flex flex-col gap-1.5 lg:ml-1 lg:flex-row">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-md bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Filtrar
            </button>
            <Link
              href={construirUrl(filtros, {
                de: null,
                ate: null,
                busca: null,
                tipoLiberacao: null,
                pagina: 1,
                paciente: null,
                status: null,
                origem: null,
                situacaoConsolidado: null,
              })}
              className={BOTAO_SECUNDARIO}
            >
              Limpar
            </Link>
          </div>
        </form>

        {!erroInicial && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            {total} {total === 1 ? "registro" : "registros"} encontrado
            {total === 1 ? "" : "s"}.
          </p>
        )}

        {!erroInicial && resultado && resultado.linhas.length === 0 && (
          <EstadoVazio
            mensagem={
              total === 0
                ? semFiltros
                  ? "Nenhum registro encontrado ainda."
                  : "Nenhum registro encontrado para os filtros."
                : "Nenhum registro nesta página."
            }
          />
        )}

        {!erroInicial && resultado && resultado.linhas.length > 0 && (
          <TabelaRelatorio resultado={resultado} filtros={filtros} />
        )}

        {!erroInicial && total > 0 && (
          <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Página {filtros.pagina} de {totalPaginas}
            </p>
            <div className="flex gap-2">
              {filtros.pagina > 1 && (
                <Link
                  href={construirUrl(filtros, { pagina: filtros.pagina - 1 })}
                  className={BOTAO_SECUNDARIO}
                >
                  Anterior
                </Link>
              )}
              {filtros.pagina < totalPaginas && (
                <Link
                  href={construirUrl(filtros, { pagina: filtros.pagina + 1 })}
                  className={BOTAO_SECUNDARIO}
                >
                  Próxima
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

// Tabela desktop + cards mobile do RESUMO por paciente (Sprint 40).
// Ordenação padrão: maior quantidade autorizada primeiro (definida no
// agregador puro agregarResumo — a view não reordena).
function PainelResumoPacientes({
  linhas,
}: {
  linhas: ResultadoResumoRelatorio["linhas"];
}) {
  return (
    <>
      <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <CabecalhoTabela
            colunas={["Paciente", "Gestor SUS", "Liberações", "Previsto", "Retirado", "Diferença"]}
          />
          <tbody className="divide-y divide-zinc-100">
            {linhas.map((linha) => (
              <tr key={linha.pacienteId} className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none">
                <td className="px-4 py-3">
                  <p className="font-medium text-brand-900">{linha.nomePaciente}</p>
                </td>
                <td className="px-4 py-3 text-zinc-600">SUS {linha.gestorSus}</td>
                <td className="px-4 py-3 text-zinc-700">{linha.quantidadeLiberacoes}</td>
                <td className="px-4 py-3 text-zinc-700">{linha.quantidadeAutorizada}</td>
                <td className="px-4 py-3 text-zinc-700">{linha.quantidadeRetirada}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      linha.saldo < 0
                        ? "font-semibold text-red-700"
                        : "font-semibold text-brand-900"
                    }
                  >
                    {linha.saldo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {linhas.map((linha) => (
          <li key={linha.pacienteId} className={`${CARTAO} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-brand-900">
                  {linha.nomePaciente}
                </p>
                <p className="text-xs text-zinc-500">SUS {linha.gestorSus}</p>
              </div>
              <p
                className={`shrink-0 text-sm font-semibold ${
                  linha.saldo < 0 ? "text-red-700" : "text-brand-900"
                }`}
              >
                Diferença {linha.saldo}
              </p>
            </div>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-zinc-500">Liberações</dt>
                <dd className="font-medium text-brand-900">{linha.quantidadeLiberacoes}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-zinc-500">Previsto</dt>
                <dd className="font-medium text-brand-900">{linha.quantidadeAutorizada}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-zinc-500">Retirado</dt>
                <dd className="font-medium text-brand-900">{linha.quantidadeRetirada}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

// Tabela desktop + cards mobile conforme o tipo de relatório selecionado.
function TabelaRelatorio({
  resultado,
  filtros,
}: {
  resultado: ResultadoListaRelatorio;
  filtros: FiltrosRelatorio;
}) {
  if (resultado.tipo === "retiradas") {
    return <TabelaRetiradas linhas={resultado.linhas} filtros={filtros} />;
  }
  if (resultado.tipo === "consolidado") {
    return <TabelaConsolidado linhas={resultado.linhas} filtros={filtros} />;
  }
  if (resultado.tipo === "historico") {
    return null;
  }
  return <TabelaLiberacoes linhas={resultado.linhas} filtros={filtros} />;
}
// O TypeScript já garante que o histórico é renderizado antes da tabela;
//  esta função é chamada apenas após a validação do tipo.

function CabecalhoTabela({ colunas }: { colunas: string[] }) {
  return (
    <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
      <tr>
        {colunas.map((coluna) => (
          <th key={coluna} className="px-4 py-3 font-medium">
            {coluna}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TabelaLiberacoes({
  linhas,
  filtros,
}: {
  linhas: Extract<ResultadoListaRelatorio, { tipo: "liberacoes" }>["linhas"];
  filtros: FiltrosRelatorio;
}) {
  void filtros;
  // Para múltiplas ativas, destacamos pacientes com >1 ativa na página (best-effort)
  const multiplas = calcularPacientesMultiplasAtivas(linhas);
  return (
    <>
      <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <CabecalhoTabela
            colunas={["Paciente", "Origem", "Tipo", "Previsto", "Retirado", "Período", "Status", "Autorizador"]}
          />
          <tbody className="divide-y divide-zinc-100">
            {linhas.map((linha) => {
              const semRetirada = linha.totalRetirado === 0;
              const expiradaSemUso = linha.status === STATUS_LIBERACAO.EXPIRADA && semRetirada;
              const proximo = isProximoVencimentoLiberacoes(linha);
              const venc = textoVencimentoLiberacoes(linha.dataFim);
              const ehRenovacao = !!linha.renovacaoDeId;
              const ehMultipla = multiplas.has(linha.paciente?.id ?? "");
              return (
                <tr
                  key={linha.id}
                  className={`transition-colors duration-150 motion-reduce:transition-none ${
                    expiradaSemUso
                      ? "bg-zinc-50 hover:bg-zinc-100"
                      : semRetirada
                        ? "bg-amber-50/30 hover:bg-amber-50/50"
                        : proximo
                          ? "bg-orange-50/30 hover:bg-orange-50/50"
                          : ehMultipla
                            ? "bg-sky-50/40 hover:bg-sky-50/60"
                            : "hover:bg-brand-50/40"
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-900">{linha.paciente?.nome ?? "—"}</p>
                    <p className="text-xs text-zinc-500">SUS {linha.paciente?.gestor_sus ?? "—"}</p>
                    {ehRenovacao && (
                      <span className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                        Renovação
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {linha.paciente?.origem ? (ROTULO_ORIGEM_PACIENTE[linha.paciente.origem as keyof typeof ROTULO_ORIGEM_PACIENTE] ?? linha.paciente.origem) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <span className="inline-flex items-center gap-1.5">
                      {rotuloTipoLiberacao(linha.tipo)}
                      {ehRenovacao && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{linha.quantidade}</td>
                  <td className="px-4 py-3 text-zinc-700">{linha.totalRetirado}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    <span>{descreverPeriodo(linha)}</span>
                    {venc && <span className="ml-1 text-xs font-medium text-orange-700">· {venc}</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <span className="inline-flex items-center gap-1.5">
                      {rotuloStatusLiberacao(linha.status)}
                      {semRetirada && <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />}
                      {proximo && <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden />}
                      {ehMultipla && <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{linha.autorizador?.nome ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {linhas.map((linha) => {
          const venc = textoVencimentoLiberacoes(linha.dataFim);
          const ehRenovacao = !!linha.renovacaoDeId;
          return (
            <li key={linha.id} className={`${CARTAO} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-brand-900">
                    {linha.paciente?.nome ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {rotuloTipoLiberacao(linha.tipo)} · {rotuloStatusLiberacao(linha.status)}
                    {ehRenovacao ? " · Renovação" : ""}
                  </p>
                  {linha.paciente?.origem && (
                    <p className="text-xs text-zinc-500">{ROTULO_ORIGEM_PACIENTE[linha.paciente.origem as keyof typeof ROTULO_ORIGEM_PACIENTE] ?? linha.paciente.origem}</p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-medium text-zinc-700">
                  {linha.quantidade} vale(s)
                </p>
              </div>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-zinc-500">Período</dt>
                  <dd className="font-medium text-brand-900">{descreverPeriodo(linha)}</dd>
                </div>
                {venc && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-zinc-500">Vencimento</dt>
                    <dd className="font-medium text-orange-700">{venc}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-zinc-500">Previsto</dt>
                  <dd className="font-medium text-brand-900">{linha.quantidade}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-zinc-500">Retirado</dt>
                  <dd className="font-medium text-brand-900">{linha.totalRetirado}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-zinc-500">Autorizador</dt>
                  <dd className="font-medium text-brand-900">{linha.autorizador?.nome ?? "—"}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TabelaRetiradas({
  linhas,
  filtros,
}: {
  linhas: Extract<ResultadoListaRelatorio, { tipo: "retiradas" }>["linhas"];
  filtros: FiltrosRelatorio;
}) {
  void filtros;
  // Mapa para situação "Acima da previsão" (total por liberação na página — best-effort)
  const mapa = new Map<string, { previsto: number; total: number }>();
  for (const l of linhas) {
    const id = l.liberacao?.id;
    if (!id) continue;
    const previsto = l.liberacao?.quantidade ?? 0;
    const cur = mapa.get(id) ?? { previsto, total: 0 };
    cur.total += l.quantidade;
    mapa.set(id, cur);
  }
  return (
    <>
      <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <CabecalhoTabela colunas={["Paciente", "Origem", "Tipo", "Data/Hora", "Retirado", "Previsto", "Situação", "Registrado por"]} />
          <tbody className="divide-y divide-zinc-100">
            {linhas.map((linha) => {
              const prevista = linha.liberacao?.quantidade ?? null;
              const foraVig =
                (linha.liberacao as unknown as { data_inicio?: string; data_fim?: string } | null)?.data_inicio &&
                (linha.liberacao as unknown as { data_inicio?: string; data_fim?: string } | null)?.data_fim
                  ? linha.dataHora < (linha.liberacao as unknown as { data_inicio: string }).data_inicio ||
                    linha.dataHora > (linha.liberacao as unknown as { data_fim: string }).data_fim
                  : false;
              const acima = (() => {
                const id = linha.liberacao?.id;
                if (!id) return false;
                const entry = mapa.get(id);
                return entry ? entry.total > (entry.previsto ?? 0) : false;
              })();
              const situacao = foraVig ? "Fora da vigência" : acima ? "Acima da previsão" : "Normal";
              return (
                <tr
                  key={linha.id}
                  className={`transition-colors duration-150 motion-reduce:transition-none ${acima ? "bg-red-50/40 hover:bg-red-50/60" : foraVig ? "bg-orange-50/30 hover:bg-orange-50/50" : "hover:bg-brand-50/40"}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-900">{linha.paciente?.nome ?? "—"}</p>
                    <p className="text-xs text-zinc-500">SUS {linha.paciente?.gestor_sus ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {linha.paciente?.origem ? (ROTULO_ORIGEM_PACIENTE[linha.paciente.origem as keyof typeof ROTULO_ORIGEM_PACIENTE] ?? linha.paciente.origem) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{linha.liberacao ? rotuloTipoLiberacao(linha.liberacao.tipo) : "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatarDataHora(linha.dataHora)}</td>
                  <td className="px-4 py-3 font-medium text-brand-900">{linha.quantidade}</td>
                  <td className="px-4 py-3 text-zinc-700">{prevista ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${acima ? "text-red-700" : foraVig ? "text-orange-700" : "text-zinc-600"}`}>
                      {situacao}
                      {acima && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />}
                      {foraVig && <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{linha.recepcionista?.nome ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {linhas.map((linha) => {
          const prevista = linha.liberacao?.quantidade ?? null;
          const foraVig =
            (linha.liberacao as unknown as { data_inicio?: string; data_fim?: string } | null)?.data_inicio &&
            (linha.liberacao as unknown as { data_inicio?: string; data_fim?: string } | null)?.data_fim
              ? linha.dataHora < (linha.liberacao as unknown as { data_inicio: string }).data_inicio ||
                linha.dataHora > (linha.liberacao as unknown as { data_fim: string }).data_fim
              : false;
          const acima = (() => {
            const id = linha.liberacao?.id;
            if (!id) return false;
            const entry = mapa.get(id);
            return entry ? entry.total > (entry.previsto ?? 0) : false;
          })();
          return (
            <li key={linha.id} className={`${CARTAO} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-brand-900">{linha.paciente?.nome ?? "—"}</p>
                  <p className="text-xs text-zinc-500">{formatarDataHora(linha.dataHora)} · {linha.liberacao ? rotuloTipoLiberacao(linha.liberacao.tipo) : "—"}</p>
                  {linha.paciente?.origem && <p className="text-xs text-zinc-500">{ROTULO_ORIGEM_PACIENTE[linha.paciente.origem as keyof typeof ROTULO_ORIGEM_PACIENTE] ?? linha.paciente.origem}</p>}
                </div>
                <p className={`shrink-0 text-sm font-semibold ${acima ? "text-red-700" : "text-brand-900"}`}>{linha.quantidade} vale(s)</p>
              </div>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3"><dt className="text-xs text-zinc-500">Previsto</dt><dd className="font-medium text-brand-900">{prevista ?? "—"}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-xs text-zinc-500">Situação</dt><dd className={`font-medium ${acima ? "text-red-700" : foraVig ? "text-orange-700" : "text-zinc-700"}`}>{foraVig ? "Fora da vigência" : acima ? "Acima da previsão" : "Normal"}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-xs text-zinc-500">Registrado por</dt><dd className="font-medium text-brand-900">{linha.recepcionista?.nome ?? "—"}</dd></div>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function HistoricoTimeline({
  linhas,
  paciente,
}: {
  linhas: ItemHistorico[];
  paciente?: { id: string; gestor_sus: string; nome: string; origem?: string | null; created_at?: string | null } | null;
}) {
  type Evento =
    | { id: string; dataHora: string; tipo: "liberacao"; liberacao: ItemHistorico }
    | { id: string; dataHora: string; tipo: "retirada"; retirada: { dataHora: string; quantidade: number; recepcionistaNome?: string | null }; liberacao: ItemHistorico }
    | { id: string; dataHora: string; tipo: "paciente"; paciente: { nome: string; created_at: string } };

  const eventos: Evento[] = [];
  if (paciente?.created_at) {
    eventos.push({ id: `pac-${paciente.id}`, dataHora: paciente.created_at, tipo: "paciente", paciente: { nome: paciente.nome, created_at: paciente.created_at } });
  }
  for (const lib of linhas) {
    const criacao = lib.createdAt ?? lib.dataInicio;
    eventos.push({ id: `lib-${lib.id}`, dataHora: criacao, tipo: "liberacao", liberacao: lib });
    for (const r of lib.retiradas ?? []) {
      eventos.push({ id: `ret-${lib.id}-${r.dataHora}-${r.quantidade}`, dataHora: r.dataHora, tipo: "retirada", retirada: r, liberacao: lib });
    }
  }
  // Mais recente primeiro
  eventos.sort((a, b) => (a.dataHora < b.dataHora ? 1 : a.dataHora > b.dataHora ? -1 : 0));

  if (eventos.length === 0) {
    return <EstadoVazio mensagem="Não há movimentações históricas registradas para este paciente." />;
  }

  // Agrupamento por data (Hoje/Ontem/Data)
  const hoje = new Date().toISOString().slice(0, 10);
  const ontemDate = new Date();
  ontemDate.setDate(ontemDate.getDate() - 1);
  const ontem = ontemDate.toISOString().slice(0, 10);
  function rotuloData(iso: string): string {
    const d = iso.slice(0, 10);
    if (d === hoje) return "Hoje";
    if (d === ontem) return "Ontem";
    return formatarData(iso);
  }
  const grupos = new Map<string, Evento[]>();
  for (const ev of eventos) {
    const k = ev.dataHora.slice(0, 10);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(ev);
  }

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-sm font-semibold text-brand-900">Histórico do paciente — eventos reais em ordem cronológica</h3>
      {[...grupos.entries()].map(([dataKey, evs]) => (
        <div key={dataKey} className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{rotuloData(dataKey)}</h4>
          <ol className="relative border-l border-zinc-200 pl-6">
            {evs.map((ev) => {
              if (ev.tipo === "paciente") {
                return (
                  <li key={ev.id} className="relative pb-6 last:pb-0">
                    <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-zinc-400" />
                    <div className={`${CARTAO} p-4`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 border-zinc-200">PACIENTE CADASTRADO</span>
                        <span className="text-xs text-zinc-500">{formatarDataHora(ev.dataHora)}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-brand-900">Paciente {ev.paciente.nome} cadastrado no sistema</p>
                    </div>
                  </li>
                );
              }
              const isLiberacao = ev.tipo === "liberacao";
              const lib = ev.liberacao;
              const dotClass = isLiberacao ? "bg-brand-600" : "bg-emerald-500";
              const badgeClass = isLiberacao ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";
              const titulo = isLiberacao ? (lib.renovacaoDeId ? "LIBERAÇÃO RENOVADA" : "LIBERAÇÃO CRIADA") : "RETIRADA";
              const dataFmt = isLiberacao ? formatarDataHora(ev.dataHora) : formatarDataHora(ev.dataHora);
              const saldo = lib.saldo;
              const acima = saldo < 0;
              return (
                <li key={ev.id} className="relative pb-6 last:pb-0">
                  <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${dotClass}`} />
                  <div className={`${CARTAO} p-4`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}>{titulo}</span>
                      <span className="text-xs text-zinc-500">{dataFmt}</span>
                    </div>
                    {isLiberacao ? (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-brand-900">
                          {rotuloTipoLiberacao(lib.tipo)} · {lib.quantidade} vales previstos · Período: {descreverPeriodo(lib)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {rotuloOrigemLiberacao(lib)} · Status: {rotuloStatusLiberacao(lib.status)} · Previsto: {lib.quantidade} · Retirado: {lib.quantidadeRetirada} · Diferença: <span className={acima ? "font-semibold text-red-700" : "font-semibold text-brand-900"}>{saldo > 0 ? `+${saldo}` : saldo}{acima ? " · Acima da previsão" : ""}</span>
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Autorizada por: {lib.autorizador?.nome ?? "—"} {lib.registrador?.nome && lib.registrador.nome !== lib.autorizador?.nome ? `· Registrada por: ${lib.registrador.nome}` : ""}
                        </p>
                        {lib.retiradas && lib.retiradas.length > 0 && (
                          <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
                            <p className="text-xs font-medium text-zinc-700">Retiradas desta liberação</p>
                            <ul className="mt-1 flex flex-col gap-1">
                              {lib.retiradas.map((rr, idx) => (
                                <li key={idx} className="text-xs text-zinc-600">
                                  {formatarDataHora(rr.dataHora)} · {rr.quantidade} vale(s) {rr.recepcionistaNome ? `· ${rr.recepcionistaNome}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-brand-900">{ev.retirada.quantidade} vales retirados</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Liberação: {rotuloTipoLiberacao(lib.tipo)} · {descreverPeriodo(lib)} · {lib.quantidade} previstos
                          {ev.retirada.recepcionistaNome ? ` · Registrado por: ${ev.retirada.recepcionistaNome}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function TabelaConsolidado({
  linhas,
  filtros,
}: {
  linhas: Extract<ResultadoListaRelatorio, { tipo: "consolidado" }>["linhas"];
  filtros: FiltrosRelatorio;
}) {
  void filtros;
  return (
    <>
      <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <CabecalhoTabela
            colunas={["Paciente", "Tipo", "Previsto", "Retirado", "Diferença", "Período", "Status"]}
          />
          <tbody className="divide-y divide-zinc-100">
            {linhas.map((linha) => {
              const ehEstouro = linha.saldo < 0;
              const ehSemRetirada = linha.quantidadeRetirada === 0;
              const vencimento = textoVencimento(linha.dataFim);
              const proximo = isProximoVencimento(linha);
              return (
                <tr
                  key={linha.liberacaoId}
                  className={`transition-colors duration-150 motion-reduce:transition-none ${
                    ehEstouro
                      ? "bg-red-50/40 hover:bg-red-50/60"
                      : ehSemRetirada
                        ? "bg-amber-50/30 hover:bg-amber-50/50"
                        : proximo
                          ? "bg-orange-50/30 hover:bg-orange-50/50"
                          : "hover:bg-brand-50/40"
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-900">{linha.paciente?.nome ?? "—"}</p>
                    <p className="text-xs text-zinc-500">SUS {linha.paciente?.gestor_sus ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{rotuloTipoLiberacao(linha.tipo)}</td>
                  <td className="px-4 py-3 text-zinc-700">{linha.quantidadeAutorizada}</td>
                  <td className="px-4 py-3 text-zinc-700">{linha.quantidadeRetirada}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        ehEstouro ? "font-semibold text-red-700" : "font-semibold text-brand-900"
                      }
                    >
                      {ehEstouro ? `${linha.saldo} · ESTOURO` : linha.saldo > 0 ? `+${linha.saldo}` : `${linha.saldo}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    <span>{descreverPeriodo({ tipo: linha.tipo, dataInicio: linha.dataInicio, dataFim: linha.dataFim })}</span>
                    {vencimento && <span className="ml-1 text-xs font-medium text-orange-700">· {vencimento}</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <span className="inline-flex items-center gap-1.5">
                      {rotuloStatusLiberacao(linha.status)}
                      {ehSemRetirada && <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />}
                      {ehEstouro && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />}
                      {proximo && <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {linhas.map((linha) => {
          const ehEstouro = linha.saldo < 0;
          const ehSemRetirada = linha.quantidadeRetirada === 0;
          const vencimento = textoVencimento(linha.dataFim);
          return (
            <li key={linha.liberacaoId} className={`${CARTAO} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-brand-900">
                    {linha.paciente?.nome ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {rotuloTipoLiberacao(linha.tipo)} · {rotuloStatusLiberacao(linha.status)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold ${ehEstouro ? "text-red-700" : "text-brand-900"}`}
                >
                  {ehEstouro ? `${linha.saldo} ESTOURO` : linha.saldo > 0 ? `+${linha.saldo}` : `${linha.saldo}`}
                </p>
              </div>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-zinc-500">Previsto</dt>
                  <dd className="font-medium text-brand-900">{linha.quantidadeAutorizada}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-zinc-500">Retirado</dt>
                  <dd className="font-medium text-brand-900">{linha.quantidadeRetirada}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-zinc-500">Período</dt>
                  <dd className="font-medium text-brand-900">
                    {descreverPeriodo({ tipo: linha.tipo, dataInicio: linha.dataInicio, dataFim: linha.dataFim })}
                  </dd>
                </div>
                {vencimento && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-zinc-500">Vencimento</dt>
                    <dd className="font-medium text-orange-700">{vencimento}</dd>
                  </div>
                )}
                {ehSemRetirada && (
                  <p className="text-xs font-medium text-amber-700">Sem retirada</p>
                )}
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}