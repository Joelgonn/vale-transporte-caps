"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TIPOS_LIBERACAO, STATUS_LIBERACAO, ROTULO_ORIGEM_PACIENTE } from "@/lib/domain/enums";
import { PatientSearch } from "@/components/ui/patient-search";
import type { FiltrosRelatorio, ItemHistorico, ResultadoListaRelatorio } from "@/lib/domain/relatorios/types";
import {
  descreverPeriodo,
  formatarDataHora,
  rotuloStatusLiberacao,
  rotuloTipoLiberacao,
} from "@/lib/domain/relatorios/rotulos";
import { rotuloOrigemLiberacao } from "@/lib/domain/relatorios/rotulos";
import {
  BADGE_ATENCAO,
  BADGE_INFO,
  BADGE_NEUTRO,
  BADGE_SUCESSO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CARTAO,
  CONTAINER,
} from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro } from "@/components/ui/feedback";

type Props = {
  filtros: FiltrosRelatorio;
  resultado: ResultadoListaRelatorio | null;
  erroInicial: string | null;
  candidatos?: { id: string; gestor_sus: string; nome: string; origem?: string | null }[];
};

const INPUT =
  "h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 transition-colors";

function construirUrl(filtros: FiltrosRelatorio, ajustes: Partial<FiltrosRelatorio>): string {
  const params = new URLSearchParams();
  const uniao = { ...filtros, ...ajustes } as FiltrosRelatorio;
  // historico sempre
  if (uniao.paciente) params.set("paciente", uniao.paciente);
  if (uniao.busca) params.set("busca", uniao.busca);
  if (uniao.de) params.set("de", uniao.de);
  if (uniao.ate) params.set("ate", uniao.ate);
  if (uniao.tipoLiberacao) params.set("tl", uniao.tipoLiberacao);
  if (uniao.status) params.set("status", uniao.status);
  if (uniao.origem) params.set("origem", uniao.origem);
  if (uniao.pagina > 1) params.set("pagina", String(uniao.pagina));
  const qs = params.toString();
  return qs ? `/dashboard/historico?${qs}` : "/dashboard/historico";
}

function badgeOrigem(origem?: string | null) {
  if (!origem) return null;
  const isEsporadico = origem === "esporadico";
  return (
    <span className={isEsporadico ? BADGE_ATENCAO : BADGE_INFO}>
      {isEsporadico ? ROTULO_ORIGEM_PACIENTE.esporadico : ROTULO_ORIGEM_PACIENTE.regular}
    </span>
  );
}

function badgeTipo(tipo: string) {
  const isContinua = tipo === TIPOS_LIBERACAO.CONTINUA;
  return (
    <span className={isContinua ? BADGE_INFO : BADGE_NEUTRO}>{rotuloTipoLiberacao(tipo)}</span>
  );
}

function badgeStatus(status: string) {
  if (status === STATUS_LIBERACAO.ATIVA) return <span className={BADGE_SUCESSO}>{rotuloStatusLiberacao(status)}</span>;
  if (status === STATUS_LIBERACAO.CANCELADA) return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{rotuloStatusLiberacao(status)}</span>;
  return <span className={BADGE_NEUTRO}>{rotuloStatusLiberacao(status)}</span>;
}

export default function HistoricoView({ filtros, resultado, erroInicial, candidatos }: Props) {
  const router = useRouter();
  const linhas = (resultado as Extract<ResultadoListaRelatorio, { tipo: "historico" }> | null)?.linhas ?? [];
  const paciente = (resultado as Extract<ResultadoListaRelatorio, { tipo: "historico" }> | null)?.paciente ?? null;
  const total = resultado?.total ?? 0;
  const porPagina = resultado?.porPagina ?? 20;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  // Resumo derivado — sem nova consulta
  const resumo =
    linhas.length > 0
      ? {
          total: linhas.length,
          previsto: linhas.reduce((a, l) => a + l.quantidade, 0),
          retirado: linhas.reduce((a, l) => a + l.quantidadeRetirada, 0),
          get diferenca() {
            return this.previsto - this.retirado;
          },
        }
      : null;

  const temFiltros =
    !!filtros.de || !!filtros.ate || !!filtros.tipoLiberacao || !!filtros.status || !!filtros.origem;

  return (
    <div className="flex flex-1 flex-col py-8">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader
          titulo="Histórico"
          descricao="Histórico operacional por paciente — autorizações, entregas e diferenças. Cada liberação mostra previsão, retiradas e eventos em ordem cronológica."
        />

        {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

        {/* Busca de paciente — quando nenhum selecionado */}
        {!paciente && (
          <>
            {candidatos && candidatos.length > 0 && (
              <>
                <p className="text-sm text-zinc-500">
                  {candidatos.length} paciente(s) encontrado(s). Selecione para ver o histórico.
                </p>
                <ul className={`${CARTAO} divide-y divide-zinc-100`}>
                  {candidatos.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-900">{c.nome}</p>
                        <p className="text-xs text-zinc-500">SUS {c.gestor_sus}</p>
                      </div>
                      <Link href={construirUrl(filtros, { paciente: c.id, busca: undefined, pagina: 1 })} className={BOTAO_PRIMARIO}>
                        Ver histórico
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {(!candidatos || candidatos.length === 0) && (
              <div className={`${CARTAO} p-4`}>
                <PatientSearch
                  id="historico-busca"
                  label="Buscar paciente"
                  placeholder="🔎 Nome ou Gestor SUS..."
                  onSelect={(p) => router.push(construirUrl(filtros, { paciente: p.id, busca: undefined, pagina: 1 }))}
                />
                <div className="mt-3 flex gap-2">
                  <Link href="/dashboard/historico" className={BOTAO_SECUNDARIO}>
                    Limpar
                  </Link>
                </div>
              </div>
            )}

            {!candidatos?.length && !erroInicial && (
              <EstadoVazio mensagem="Busque um paciente pelo nome ou Gestor SUS para ver o histórico operacional." />
            )}
          </>
        )}

        {/* Paciente selecionado — header + resumo + filtros + listagem */}
        {paciente && (
          <>
            <div className={`${CARTAO} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-brand-900">{paciente.nome}</h2>
                  {badgeOrigem((paciente as { origem?: string }).origem)}
                </div>
                <p className="text-sm text-zinc-500">SUS {paciente.gestor_sus} · ID {paciente.id.slice(0, 8)}</p>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard/historico" className={BOTAO_SECUNDARIO}>
                  Trocar paciente
                </Link>
                <Link href={construirUrl(filtros, { paciente: paciente.id, de: null, ate: null, tipoLiberacao: null, status: null, origem: null, pagina: 1 })} className={BOTAO_SECUNDARIO}>
                  Limpar filtros
                </Link>
              </div>
            </div>

            {resumo && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className={`${CARTAO} p-4`}>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Liberações</p>
                  <p className="mt-1 text-2xl font-semibold text-brand-900">{resumo.total}</p>
                  <p className="text-xs text-zinc-500">{total} no total</p>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Previsto</p>
                  <p className="mt-1 text-2xl font-semibold text-brand-900">{resumo.previsto}</p>
                  <p className="text-xs text-zinc-500">Autorizado no período</p>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Retirado</p>
                  <p className="mt-1 text-2xl font-semibold text-brand-900">{resumo.retirado}</p>
                  <p className="text-xs text-zinc-500">Entregue</p>
                </div>
                <div className={`${CARTAO} p-4`}>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Diferença</p>
                  <p className={`mt-1 text-2xl font-semibold ${resumo.diferenca < 0 ? "text-red-700" : resumo.diferenca > 0 ? "text-emerald-700" : "text-brand-900"}`}>
                    {resumo.diferenca}
                  </p>
                  <p className="text-xs text-zinc-500">{resumo.diferenca < 0 ? "Acima do previsto" : resumo.diferenca > 0 ? "Saldo positivo" : "Equilíbrio"}</p>
                </div>
              </div>
            )}

            {/* Filtros compactos */}
            <form method="get" action="/dashboard/historico" className={`${CARTAO} flex flex-col gap-3 p-4`}>
              <input type="hidden" name="paciente" value={paciente.id} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f-de" className="text-xs font-medium text-zinc-600">De</label>
                  <input id="f-de" name="de" type="date" defaultValue={filtros.de ?? ""} className={INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f-ate" className="text-xs font-medium text-zinc-600">Até</label>
                  <input id="f-ate" name="ate" type="date" defaultValue={filtros.ate ?? ""} className={INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f-tl" className="text-xs font-medium text-zinc-600">Tipo</label>
                  <select id="f-tl" name="tl" defaultValue={filtros.tipoLiberacao ?? ""} className={INPUT}>
                    <option value="">Todos</option>
                    <option value="continua">Contínua</option>
                    <option value="avulsa">Avulsa</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f-status" className="text-xs font-medium text-zinc-600">Status</label>
                  <select id="f-status" name="status" defaultValue={filtros.status ?? ""} className={INPUT}>
                    <option value="">Todos</option>
                    {Object.values(STATUS_LIBERACAO).map((s) => (
                      <option key={s} value={s}>{rotuloStatusLiberacao(s)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f-origem" className="text-xs font-medium text-zinc-600">Origem</label>
                  <select id="f-origem" name="origem" defaultValue={filtros.origem ?? ""} className={INPUT}>
                    <option value="">Todas</option>
                    <option value="original">Originais</option>
                    <option value="renovacao">Renovações</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={BOTAO_PRIMARIO}>Aplicar filtros</button>
                {temFiltros && (
                  <Link href={construirUrl(filtros, { de: null, ate: null, tipoLiberacao: null, status: null, origem: null, pagina: 1 })} className={BOTAO_SECUNDARIO}>
                    Limpar filtros
                  </Link>
                )}
                <span className="self-center text-xs text-zinc-500">{total} registro(s)</span>
              </div>
            </form>

            {linhas.length === 0 ? (
              <EstadoVazio
                mensagem={temFiltros ? "Nenhum registro corresponde aos filtros. Tente limpar os filtros." : "Este paciente ainda não possui liberações registradas."}
              />
            ) : (
              <>
                {/* Desktop — tabela premium */}
                <div className={`${CARTAO} hidden overflow-x-auto lg:block`}>
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50/60 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Liberação</th>
                        <th className="px-4 py-3 font-medium">Período</th>
                        <th className="px-4 py-3 font-medium text-right">Previsto</th>
                        <th className="px-4 py-3 font-medium text-right">Retirado</th>
                        <th className="px-4 py-3 font-medium text-right">Diferença</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Eventos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {linhas.map((l) => (
                        <tr key={l.id} className="hover:bg-brand-50/30">
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {badgeTipo(l.tipo)}
                                {l.renovacaoDeId ? <span className={BADGE_ATENCAO}>Renovação</span> : <span className={BADGE_NEUTRO}>Original</span>}
                              </div>
                              <p className="text-xs text-zinc-500">{rotuloOrigemLiberacao({ renovacaoDeId: l.renovacaoDeId, origem: l.origem })}</p>
                              <p className="text-xs text-zinc-400">ID {l.id.slice(0, 8)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{descreverPeriodo({ tipo: l.tipo, dataInicio: l.dataInicio, dataFim: l.dataFim })}</td>
                          <td className="px-4 py-3 text-right font-medium text-brand-900">{l.quantidade}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">
                            {l.quantidadeRetirada}
                            {l.numeroRetiradas > 0 && <span className="ml-1 text-xs text-zinc-500">· {l.numeroRetiradas}</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${l.saldo < 0 ? "text-red-700" : l.saldo > 0 ? "text-emerald-700" : "text-brand-900"}`}>{l.saldo}</span>
                          </td>
                          <td className="px-4 py-3">{badgeStatus(l.status)}</td>
                          <td className="px-4 py-3">
                            <TimelineCompact item={l} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile — cards verticais */}
                <ul className="flex flex-col gap-4 lg:hidden">
                  {linhas.map((l) => (
                    <li key={l.id} className={`${CARTAO} overflow-hidden`}>
                      <div className="flex items-start justify-between gap-3 p-4 pb-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {badgeTipo(l.tipo)}
                            {badgeStatus(l.status)}
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">{rotuloOrigemLiberacao({ renovacaoDeId: l.renovacaoDeId, origem: l.origem })} · {descreverPeriodo({ tipo: l.tipo, dataInicio: l.dataInicio, dataFim: l.dataFim })}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${l.saldo < 0 ? "bg-red-50 text-red-700" : l.saldo > 0 ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}`}>
                          {l.saldo >= 0 ? `+${l.saldo}` : l.saldo}
                        </span>
                      </div>

                      <dl className="grid grid-cols-3 gap-3 border-y border-zinc-100 bg-zinc-50/40 px-4 py-3">
                        <div className="text-center">
                          <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Previsto</dt>
                          <dd className="mt-1 text-lg font-semibold text-brand-900">{l.quantidade}</dd>
                        </div>
                        <div className="text-center border-x border-zinc-200">
                          <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Retirado</dt>
                          <dd className="mt-1 text-lg font-semibold text-brand-900">{l.quantidadeRetirada}</dd>
                          <dd className="text-xs text-zinc-500">{l.numeroRetiradas} retirada(s)</dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Diferença</dt>
                          <dd className={`mt-1 text-lg font-semibold ${l.saldo < 0 ? "text-red-700" : l.saldo > 0 ? "text-emerald-700" : "text-brand-900"}`}>{l.saldo}</dd>
                          <dd className="text-xs text-zinc-500">{l.saldo < 0 ? "Acima do previsto" : l.saldo > 0 ? "Saldo positivo" : "Equilíbrio"}</dd>
                        </div>
                      </dl>

                      <div className="p-4">
                        <TimelineCompact item={l} mobile />
                        <p className="mt-3 text-xs text-zinc-500">Autorizador: <span className="font-medium text-zinc-700">{l.autorizador?.nome ?? "—"}</span> · Registrado por: <span className="font-medium text-zinc-700">{l.registrador?.nome ?? "—"}</span></p>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Paginação */}
                <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">Página {filtros.pagina} de {totalPaginas}</p>
                  <div className="flex gap-2">
                    {filtros.pagina > 1 && <Link href={construirUrl(filtros, { pagina: filtros.pagina - 1 })} className={BOTAO_SECUNDARIO}>Anterior</Link>}
                    {filtros.pagina < totalPaginas && <Link href={construirUrl(filtros, { pagina: filtros.pagina + 1 })} className={BOTAO_SECUNDARIO}>Próxima</Link>}
                  </div>
                </nav>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TimelineCompact({ item, mobile }: { item: ItemHistorico; mobile?: boolean }) {
  const [expandido, setExpandido] = useState(false);
  const eventos: { label: string; data: string; detalhe?: string }[] = [
    { label: "Autorização", data: item.dataInicio, detalhe: `${rotuloTipoLiberacao(item.tipo)} · ${item.quantidade} previstos` },
    ...(item.retiradas ?? []).map((r) => ({ label: "Retirada", data: r.dataHora, detalhe: `${r.quantidade} vale(s)` })),
  ];
  if (item.ultimaRetirada && !eventos.some((e) => e.data === item.ultimaRetirada)) {
    eventos.push({ label: "Retirada", data: item.ultimaRetirada, detalhe: `${item.quantidadeRetirada} total` });
  }
  eventos.sort((a, b) => (a.data < b.data ? -1 : 1));

  const visiveis = expandido ? eventos : eventos.slice(0, 3);
  return (
    <div className={mobile ? "" : "min-w-[220px]"}>
      <ol className="relative border-l border-zinc-200 pl-4">
        {visiveis.map((ev, idx) => (
          <li key={idx} className="relative pb-3 last:pb-0">
            <span className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${ev.label === "Autorização" ? "bg-brand-600" : "bg-emerald-500"}`} />
            <p className="text-xs font-medium text-zinc-700">{ev.label}</p>
            <p className="text-xs text-zinc-500">{formatarDataHora(ev.data)}{ev.detalhe ? ` · ${ev.detalhe}` : ""}</p>
          </li>
        ))}
      </ol>
      {eventos.length > 3 && (
        <button type="button" onClick={() => setExpandido((v) => !v)} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
          {expandido ? "Ver menos" : `Ver +${eventos.length - 3} eventos`}
        </button>
      )}
      {!eventos.length && <p className="text-xs text-zinc-400">Sem eventos de retirada</p>}
    </div>
  );
}
