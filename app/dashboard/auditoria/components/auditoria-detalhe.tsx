"use client";

import { useEffect, useRef } from "react";
import type { EventoAuditoria } from "@/lib/domain/auditoria/types";
import {
  paresAntesDepois,
  rotuloAcaoAuditoria,
  rotuloEntidadeAuditoria,
} from "@/lib/domain/auditoria/labels";
import { CARTAO } from "@/components/ui/visual-tokens";

type AuditoriaDetalheProps = {
  evento: EventoAuditoria;
  onFechar: () => void;
};

// Conversão determinística de ISO do banco (timestamptz) para "13/08/2026 · 09:31"
// — mesmo critério das retiradas: sem depender do fuso do navegador.
function formatarDataHora(iso: string): string {
  const [data, hora] = iso.split("T");
  const [ano, mes, dia] = (data ?? "").split("-");
  const hhmm = (hora ?? "").slice(0, 5);
  return ano && mes && dia ? `${dia}/${mes}/${ano} · ${hhmm}` : iso;
}

// Diálogo de detalhes de um evento de auditoria (Sprint 21). Modal acessível:
// foco entra no painel, ESC fecha e o foco retorna ao gatilho no fechamento.
export default function AuditoriaDetalhe({ evento, onFechar }: AuditoriaDetalheProps) {
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    painelRef.current?.focus();
    function aoTeclar(event: KeyboardEvent) {
      if (event.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const pares = paresAntesDepois(evento.entidadeTipo, evento.dadosAntes, evento.dadosDepois);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar detalhes"
        tabIndex={-1}
        onClick={onFechar}
        className="absolute inset-0 bg-zinc-900/40"
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`auditoria-detalhe-titulo-${evento.id}`}
        tabIndex={-1}
        className={`relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg p-5 outline-none ${CARTAO}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={`auditoria-detalhe-titulo-${evento.id}`}
              className="text-lg font-semibold text-brand-900"
            >
              {rotuloAcaoAuditoria(evento.acao)}
            </h2>
            <p className="text-sm text-zinc-500">
              {rotuloEntidadeAuditoria(evento.entidadeTipo)} · {formatarDataHora(evento.dataHora)}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            aria-label="Fechar detalhes"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <dl className="mt-4 grid gap-3 rounded-md bg-zinc-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">Ação</dt>
            <dd className="font-medium text-brand-900">{rotuloAcaoAuditoria(evento.acao)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Entidade</dt>
            <dd className="font-medium text-brand-900">
              {rotuloEntidadeAuditoria(evento.entidadeTipo)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500">ID da entidade</dt>
            <dd className="break-all font-medium text-brand-900">{evento.entidadeId}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Responsável</dt>
            <dd className="font-medium text-brand-900">{evento.responsavel?.nome ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Data e hora</dt>
            <dd className="font-medium text-brand-900">{formatarDataHora(evento.dataHora)}</dd>
          </div>
        </dl>

        <h3 className="mt-5 text-sm font-semibold text-brand-900">Dados do evento</h3>
        {pares.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Nenhum dado detalhado registrado para este evento.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Campo</th>
                  <th className="px-3 py-2 font-medium">Antes</th>
                  <th className="px-3 py-2 font-medium">Depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pares.map((par) => (
                  <tr key={par.campo}>
                    <td className="px-3 py-2 text-zinc-700">{par.rotulo}</td>
                    <td className="px-3 py-2 text-zinc-600">{par.antes ?? "—"}</td>
                    <td className="px-3 py-2 font-medium text-brand-900">
                      {par.depois ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
