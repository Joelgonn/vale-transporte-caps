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
  if (uniao.pagina > 1) params.set("pagina", String(uniao.pagina));
  return `/dashboard/relatorios?${params.toString()}`;
}

const INPUT =
  "h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 motion-reduce:transition-none";

export default function RelatoriosView(props: RelatoriosViewProps) {
  const { filtros, resultado, resumo, erroInicial, candidatos, pacienteSelecionado } = props;
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
          <nav aria-label="Tipo de relatório" className="flex flex-wrap gap-2">
            {TIPOS_RELATORIO.map((tipo) => {
              const ativo = filtros.tipo === tipo;
              return (
                <Link
                  key={tipo}
                  href={construirUrl(filtros, {
                    tipo,
                    pagina: 1,
                    paciente: null,
                    status: null,
                    origem: null,
                  })}
                  aria-current={ativo ? "page" : undefined}
                  className={
                    ativo
                      ? "inline-flex h-10 items-center rounded-md bg-brand-900 px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      : "inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:border-brand-300 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none"
                  }
                >
                  {ROTULO_TIPO_RELATORIO[tipo]}
                </Link>
              );
            })}
          </nav>

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
  // Ramificação HISTÓRICO POR PACIENTE (Sprint 38)
  // ---------------------------------------------------------------
  if (ehHistorico) {
    // Etapa de busca: nenhum paciente selecionado ainda.
    if (!resultado) {
      return (
        <div className="flex flex-1 flex-col py-6">
          <div className={`${CONTAINER} flex flex-col gap-6`}>
            <PageHeader
              titulo="Relatórios"
              descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
            />
            {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

            {candidatos && candidatos.length > 0 && (
              <>
                <p className="text-sm text-zinc-500">
                  Encontrado(s) {candidatos.length} paciente(s). Selecione um para visualizar o histórico.
                </p>
                <ul className="flex flex-col gap-2">
                  {candidatos.map((c) => (
                    <li key={c.id} className="flex items-center gap-3">
                      <Link
                        href={construirUrl(filtros, { paciente: c.id, busca: null, pagina: 1 })}
                        className="font-medium text-brand-900 underline"
                      >
                        {c.nome}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        SUS {c.gestor_sus}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!candidatos || candidatos.length === 0 && (erroInicial || true) && (
              <EstadoVazio
                mensagem={
                  !erroInicial
                    ? "Busque um paciente pelo nome ou Gestor SUS para visualizar o histórico."
                    : erroInicial
                }
              />
            )}

            {!candidatos && !erroInicial && (
              <div className={`${CARTAO} p-4`}>
                <PatientSearch
                  id="relatorios-historico-patient"
                  label="Paciente (nome ou Gestor SUS)"
                  placeholder="🔎 Nome ou Gestor SUS..."
                  onSelect={(p) => router.push(construirUrl({ ...filtros, tipo: "historico", pagina: 1 }, { paciente: p.id, busca: null }))}
                />
                <div className="mt-3">
                  <Link href={construirUrl(filtros, { tipo: "historico", pagina: 1 })} className={BOTAO_SECUNDARIO}>
                    Limpar
                  </Link>
                </div>
              </div>
            )}

            {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}
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
      const paciente = ((resultado as { paciente?: { id: string; gestor_sus: string; nome: string } | null }).paciente!);
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

            {/* Cabeçalho do paciente */}
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium text-brand-900">{paciente.nome}</p>
                <p className="text-xs text-zinc-500">SUS {paciente.gestor_sus}</p>
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

            {/* Linha do tempo — tabela desktop + cards mobile */}
            {ehHistorico && resultado && resultado.linhas.length > 0 && (
              <>
                <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                        <th className="px-4 py-3 font-medium">Liberação</th>
                        <th className="px-4 py-3 font-medium">Período</th>
                        <th className="px-4 py-3 font-medium">Autorizado</th>
                        <th className="px-4 py-3 font-medium">Retirado</th>
                        <th className="px-4 py-3 font-medium">Última retirada</th>
                        <th className="px-4 py-3 font-medium">Diferença</th>
                        <th className="px-4 py-3 font-medium">Autorizador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
{resultado.linhas.map((item: ItemHistorico) => (
                        <tr
                          key={item.id}
                          className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-brand-900">
                              {rotuloTipoLiberacao(item.tipo)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {rotuloOrigemLiberacao({
                                renovacaoDeId: item.renovacaoDeId,
                                origem: item.origem,
                              })}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {descreverPeriodo({
                              tipo: item.tipo,
                              dataInicio: item.dataInicio,
                              dataFim: item.dataFim,
                            })}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{item.quantidade}</td>
                          <td className="px-4 py-3 text-zinc-700">
                            {item.quantidadeRetirada}
                            {item.numeroRetiradas > 0 && (
                              <span className="text-xs text-zinc-500">
                                ({item.numeroRetiradas} retirada(s))
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {item.ultimaRetirada
                              ? formatarDataHora(item.ultimaRetirada)
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                item.saldo < 0
                                  ? "font-semibold text-red-700"
                                  : "font-semibold text-brand-900"
                              }
                            >
                              {item.saldo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {item.autorizador?.nome ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="flex flex-col gap-3 md:hidden">
                  {resultado.linhas.map((item: ItemHistorico) => (
                    <li key={item.id} className={`${CARTAO} p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-brand-900">
                            {rotuloTipoLiberacao(item.tipo)} {rotuloOrigemLiberacao({
                              renovacaoDeId: item.renovacaoDeId,
                              origem: item.origem,
                            })}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {descreverPeriodo({
                              tipo: item.tipo,
                              dataInicio: item.dataInicio,
                              dataFim: item.dataFim,
                            })}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-medium text-zinc-700">
                          {item.quantidade} vale(s)
                        </p>
                        <dl className="mt-3 flex flex-col gap-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-zinc-500">Período</dt>
                            <dd className="font-medium text-brand-900">
                              {descreverPeriodo({
                                tipo: item.tipo,
                                dataInicio: item.dataInicio,
                                dataFim: item.dataFim,
                              })}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-zinc-500">Retirado</dt>
                            <dd className="font-medium text-brand-900">
                              {item.quantidadeRetirada}
                              {item.numeroRetiradas > 0 && (
                                <span>{item.numeroRetiradas} retirada(s)</span>
                              )}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-zinc-500">Última retirada</dt>
                            <dd className="font-medium text-brand-900">
                              {item.ultimaRetirada
                                ? formatarDataHora(item.ultimaRetirada)
                                : "—"}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-zinc-500">Diferença</dt>
                            <dd className={item.saldo < 0 ? "font-semibold text-red-700" : "font-semibold text-brand-900"}>
                              {item.saldo}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-zinc-500">Autorizador</dt>
                            <dd className="font-medium text-brand-900">
                              {item.autorizador?.nome ?? "—"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

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
            <EstadoVazio
              mensagem={
                temFiltrosAdicionais
                  ? "O paciente não possui liberações para os filtros."
                  : "O paciente não possui liberações registradas."
              }
            />
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
            <EstadoVazio
              mensagem="O paciente não possui liberações registradas."
            />
          </div>
        </div>
      );
    }
  }

  // ---------------------------------------------------------------
  // Fluxo PADRÃO (liberacoes / retiradas / consolidado)
  // ---------------------------------------------------------------
  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader
          titulo="Relatórios"
          descricao="Consultas de liberações, retiradas e consolidado — exclusivas do Gestor."
        />

        {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

        {/* Seletor de tipo — troca o relatório preservando filtros. */}
        <nav aria-label="Tipo de relatório" className="flex flex-wrap gap-2">
          {TIPOS_RELATORIO.map((tipo) => {
            const ativo = filtros.tipo === tipo;
            return (
              <Link
                key={tipo}
                href={construirUrl(filtros, {
                  tipo,
                  pagina: 1,
                  paciente: null,
                  status: null,
                  origem: null,
                })}
                aria-current={ativo ? "page" : undefined}
                className={
                  ativo
                    ? "inline-flex h-10 items-center rounded-md bg-brand-900 px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    : "inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:border-brand-300 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none"
                }
              >
                {ROTULO_TIPO_RELATORIO[tipo]}
              </Link>
            );
          })}
        </nav>

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
  return (
    <>
      <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <CabecalhoTabela
            colunas={["Paciente", "Tipo", "Previsto", "Período", "Status", "Autorizador", "Retirado"]}
          />
          <tbody className="divide-y divide-zinc-100">
            {linhas.map((linha) => (
              <tr key={linha.id} className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none">
                <td className="px-4 py-3">
                  <p className="font-medium text-brand-900">{linha.paciente?.nome ?? "—"}</p>
                  <p className="text-xs text-zinc-500">SUS {linha.paciente?.gestor_sus ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-zinc-700">{rotuloTipoLiberacao(linha.tipo)}</td>
                <td className="px-4 py-3 text-zinc-700">{linha.quantidade}</td>
                <td className="px-4 py-3 text-zinc-600">{descreverPeriodo(linha)}</td>
                <td className="px-4 py-3 text-zinc-700">{rotuloStatusLiberacao(linha.status)}</td>
                <td className="px-4 py-3 text-zinc-700">{linha.autorizador?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-700">{linha.totalRetirado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {linhas.map((linha) => (
          <li key={linha.id} className={`${CARTAO} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-brand-900">
                  {linha.paciente?.nome ?? "—"}
                </p>
                <p className="text-xs text-zinc-500">
                  {rotuloTipoLiberacao(linha.tipo)} · {rotuloStatusLiberacao(linha.status)}
                </p>
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
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-zinc-500">Total retirado</dt>
                <dd className="font-medium text-brand-900">{linha.totalRetirado}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-zinc-500">Autorizador</dt>
                <dd className="font-medium text-brand-900">{linha.autorizador?.nome ?? "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
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
  return (
    <>
      <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
        <table className="w-full text-left text-sm">
          <CabecalhoTabela
            colunas={["Data e hora", "Paciente", "Liberação", "Quantidade", "Recepcionista"]}
          />
          <tbody className="divide-y divide-zinc-100">
            {linhas.map((linha) => (
              <tr key={linha.id} className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none">
                <td className="px-4 py-3 text-zinc-600">{formatarDataHora(linha.dataHora)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-brand-900">{linha.paciente?.nome ?? "—"}</p>
                  <p className="text-xs text-zinc-500">SUS {linha.paciente?.gestor_sus ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {linha.liberacao ? `${rotuloTipoLiberacao(linha.liberacao.tipo)} · ${linha.liberacao.quantidade}` : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-700">{linha.quantidade}</td>
                <td className="px-4 py-3 text-zinc-600">{linha.recepcionista?.nome ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {linhas.map((linha) => (
          <li key={linha.id} className={`${CARTAO} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-brand-900">
                  {linha.paciente?.nome ?? "—"}
                </p>
                <p className="text-xs text-zinc-500">{formatarDataHora(linha.dataHora)}</p>
              </div>
              <p className="shrink-0 text-sm font-medium text-zinc-700">{linha.quantidade}</p>
            </div>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-zinc-500">Liberação</dt>
                <dd className="font-medium text-brand-900">
                  {linha.liberacao ? `${rotuloTipoLiberacao(linha.liberacao.tipo)} · ${linha.liberacao.quantidade}` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-zinc-500">Recepcionista</dt>
                <dd className="font-medium text-brand-900">{linha.recepcionista?.nome ?? "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
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
            colunas={["Paciente", "Tipo", "Previsto", "Retirado", "Diferença"]}
          />
          <tbody className="divide-y divide-zinc-100">
            {linhas.map((linha) => (
              <tr key={linha.liberacaoId} className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none">
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
          <li key={linha.liberacaoId} className={`${CARTAO} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-brand-900">
                  {linha.paciente?.nome ?? "—"}
                </p>
                <p className="text-xs text-zinc-500">{rotuloTipoLiberacao(linha.tipo)}</p>
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