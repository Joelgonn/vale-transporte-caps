"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import {
  ACOES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  ROTULO_ACAO_AUDITORIA,
  ROTULO_ENTIDADE_AUDITORIA,
  rotuloAcaoAuditoria,
  rotuloEntidadeAuditoria,
} from "@/lib/domain/auditoria/labels";
import type {
  EventoAuditoria,
  FiltrosAuditoria,
} from "@/lib/domain/auditoria/types";
import {
  BADGE_NEUTRO,
  BOTAO_SECUNDARIO,
  CARTAO,
  CONTAINER,
} from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro } from "@/components/ui/feedback";
import AuditoriaDetalhe from "./auditoria-detalhe";

type AuditoriaViewProps = {
  filtros: FiltrosAuditoria;
  eventos: EventoAuditoria[];
  total: number;
  porPagina: number;
  erroInicial: string | null;
  responsaveis: { id: string; nome: string }[];
};

// Conversão determinística de ISO do banco (timestamptz) — mesmo critério das
// retiradas: sem depender do fuso local do navegador/servidor.
function formatarDataHora(iso: string): string {
  const [data, hora] = iso.split("T");
  const [ano, mes, dia] = (data ?? "").split("-");
  const hhmm = (hora ?? "").slice(0, 5);
  return ano && mes && dia ? `${dia}/${mes}/${ano} · ${hhmm}` : iso;
}

// URL com os filtros atuais + ajustes (paginação/limpar). Usada nos links de
// paginação — mantém os filtros do usuário ao trocar de página.
function construirUrl(filtros: FiltrosAuditoria, ajustes: Partial<FiltrosAuditoria>): string {
  const params = new URLSearchParams();
  const uniao = { ...filtros, ...ajustes };
  if (uniao.acao) params.set("acao", uniao.acao);
  if (uniao.entidadeTipo) params.set("entidade", uniao.entidadeTipo);
  if (uniao.dataDe) params.set("de", uniao.dataDe);
  if (uniao.dataAte) params.set("ate", uniao.dataAte);
  if (uniao.usuarioId) params.set("usuario", uniao.usuarioId);
  if (uniao.pagina > 1) params.set("pagina", String(uniao.pagina));
  const query = params.toString();
  return `/dashboard/auditoria${query ? `?${query}` : ""}`;
}

export default function AuditoriaView(props: AuditoriaViewProps) {
  const { filtros, eventos, total, porPagina, erroInicial } = props;
  const [detalhe, setDetalhe] = useState<EventoAuditoria | null>(null);
  const gatilhoRef = useRef<HTMLButtonElement | null>(null);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const semFiltros =
    !filtros.acao &&
    !filtros.entidadeTipo &&
    !filtros.dataDe &&
    !filtros.dataAte &&
    !filtros.usuarioId;

  function abrirDetalhe(evento: EventoAuditoria, event: MouseEvent<HTMLButtonElement>) {
    gatilhoRef.current = event.currentTarget;
    setDetalhe(evento);
  }

  // Resumo operacional derivado dos eventos já filtrados (sem nova query)
  const usuariosDistintos = new Set(eventos.map((e) => e.usuarioId)).size;
  const entidadesDistintas = new Set(eventos.map((e) => e.entidadeTipo)).size;

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader titulo="Auditoria" descricao="Consulte as ações registradas no sistema." />

        {erroInicial && <FeedbackErro>{erroInicial}</FeedbackErro>}

        {/* Resumo operacional — só quando há dados, respeitando filtros */}
        {!erroInicial && total > 0 && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={`${CARTAO} p-4`}>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Eventos no período</dt>
              <dd className="mt-2 text-2xl font-semibold text-brand-900">{total}</dd>
            </div>
            <div className={`${CARTAO} p-4`}>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Responsáveis</dt>
              <dd className="mt-2 text-2xl font-semibold text-brand-900">{usuariosDistintos}</dd>
            </div>
            <div className={`${CARTAO} p-4`}>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Tipos de entidade</dt>
              <dd className="mt-2 text-2xl font-semibold text-brand-900">{entidadesDistintas}</dd>
            </div>
          </dl>
        )}

        {/* Filtros — aplicados no servidor (GET). Composição final em card único, sem excesso de altura. */}
        <form
          method="get"
          action="/dashboard/auditoria"
          aria-label="Filtros de auditoria"
          className={`flex flex-col gap-4 p-4 sm:p-5 ${CARTAO}`}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.15fr_1fr_1.5fr]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auditoria-filtro-acao" className="text-xs font-medium text-zinc-600">
                Ação
              </label>
              <select
                id="auditoria-filtro-acao"
                name="acao"
                defaultValue={filtros.acao ?? ""}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 motion-reduce:transition-none"
              >
                <option value="">Todas</option>
                {ACOES_AUDITORIA.map((acao) => (
                  <option key={acao} value={acao}>
                    {ROTULO_ACAO_AUDITORIA[acao]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="auditoria-filtro-entidade" className="text-xs font-medium text-zinc-600">
                Entidade
              </label>
              <select
                id="auditoria-filtro-entidade"
                name="entidade"
                defaultValue={filtros.entidadeTipo ?? ""}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 motion-reduce:transition-none"
              >
                <option value="">Todas</option>
                {ENTIDADES_AUDITORIA.map((entidade) => (
                  <option key={entidade} value={entidade}>
                    {ROTULO_ENTIDADE_AUDITORIA[entidade]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="auditoria-filtro-usuario" className="text-xs font-medium text-zinc-600">
                Responsável
              </label>
              <select
                id="auditoria-filtro-usuario"
                name="usuario"
                defaultValue={filtros.usuarioId ?? ""}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 motion-reduce:transition-none"
              >
                <option value="">Todos</option>
                {props.responsaveis.map((resp) => (
                  <option key={resp.id} value={resp.id}>
                    {resp.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[200px_200px_auto] lg:items-end border-t border-zinc-100 pt-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auditoria-filtro-de" className="text-xs font-medium text-zinc-600">
                  De
                </label>
                <input
                  id="auditoria-filtro-de"
                  name="de"
                  type="date"
                  defaultValue={filtros.dataDe ?? ""}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 motion-reduce:transition-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="auditoria-filtro-ate" className="text-xs font-medium text-zinc-600">
                  Até
                </label>
                <input
                  id="auditoria-filtro-ate"
                  name="ate"
                  type="date"
                  defaultValue={filtros.dataAte ?? ""}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition-colors duration-150 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 motion-reduce:transition-none"
                />
              </div>

              <div className="flex gap-2 self-end sm:col-span-2 lg:col-span-1 lg:justify-start">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Filtrar
                </button>
                <Link
                  href={construirUrl(filtros, { acao: null, entidadeTipo: null, dataDe: null, dataAte: null, usuarioId: null, pagina: 1 })}
                  className={BOTAO_SECUNDARIO}
                >
                  Limpar
                </Link>
              </div>
            </div>
        </form>

        {!erroInicial && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            {total} {total === 1 ? "evento" : "eventos"} encontrado{total === 1 ? "" : "s"}.
          </p>
        )}

        {eventos.length === 0 ? (
          <EstadoVazio
            mensagem={
              total === 0
                ? semFiltros
                  ? "Nenhum evento de auditoria registrado ainda."
                  : "Nenhum evento encontrado para os filtros."
                : "Nenhum evento nesta página."
            }
          />
        ) : (
          <>
            {/* Desktop — tabela */}
            <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ação</th>
                    <th className="px-4 py-3 font-medium">Entidade</th>
                    <th className="px-4 py-3 font-medium">Data e hora</th>
                    <th className="px-4 py-3 font-medium">Responsável</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Detalhes</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {eventos.map((evento) => (
                    <tr
                      key={evento.id}
                      className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3">
                        <span className={BADGE_NEUTRO}>{rotuloAcaoAuditoria(evento.acao)}</span>
                        <p className="mt-1 text-xs text-zinc-500">#{evento.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={BADGE_NEUTRO}>{rotuloEntidadeAuditoria(evento.entidadeTipo)}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatarDataHora(evento.dataHora)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {evento.responsavel?.nome ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => abrirDetalhe(evento, e)}
                          title="Exibe os dados registrados antes e depois da ação"
                          className="group inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-accent-700 underline underline-offset-2 transition-colors duration-150 hover:text-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none"
                        >
                          Detalhes
                          <span
                            aria-hidden="true"
                            className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                          >
                            →
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — cards */}
            <ul className="flex flex-col gap-3 md:hidden">
              {eventos.map((evento) => (
                <li key={evento.id} className={`${CARTAO} p-4`}>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={BADGE_NEUTRO}>{rotuloAcaoAuditoria(evento.acao)}</span>
                      <span className={BADGE_NEUTRO}>{rotuloEntidadeAuditoria(evento.entidadeTipo)}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {formatarDataHora(evento.dataHora)} · #{evento.id}
                    </p>
                  </div>
                  <dl className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-zinc-500">Responsável</dt>
                      <dd className="font-medium text-brand-900">
                        {evento.responsavel?.nome ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={(e) => abrirDetalhe(evento, e)}
                    title="Exibe os dados registrados antes e depois da ação"
                    className="group mt-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-accent-700 underline underline-offset-2 transition-colors duration-150 hover:text-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none"
                  >
                    Ver detalhes
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    >
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
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

        {detalhe && (
          <AuditoriaDetalhe
            evento={detalhe}
            onFechar={() => {
              setDetalhe(null);
              gatilhoRef.current?.focus();
            }}
          />
        )}
      </div>
    </div>
  );
}
