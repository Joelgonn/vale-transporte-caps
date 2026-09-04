"use client";

import Link from "next/link";
import { ROTULO_TIPO_LIBERACAO } from "@/lib/domain/enums";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";
import { LiberacaoStatus } from "./liberacao-status";
import {
  BOTAO_AVISO,
  CARTAO,
} from "@/components/ui/visual-tokens";

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function periodoTexto(lib: LiberacaoComPaciente): string {
  return `${formatarData(lib.data_inicio)} – ${formatarData(lib.data_fim)}`;
}

interface LiberacaoCardProps {
  liberacao: LiberacaoComPaciente;
  permissoes: {
    podeEditar: boolean;
    podeAlterarStatus: boolean;
    podeRenovar: boolean;
  };
  onEditar: (lib: LiberacaoComPaciente) => void;
  onRenovar: (lib: LiberacaoComPaciente) => void;
  showPacienteInfo?: boolean;
}

export default function LiberacaoCard({
  liberacao,
  permissoes,
  onEditar,
  onRenovar,
  showPacienteInfo = false,
}: LiberacaoCardProps) {
  const valesPorDia = (liberacao as unknown as { vales_por_dia?: number | null }).vales_por_dia;
  const isAtiva = liberacao.status === "ativa";
  const tipoLabel = ROTULO_TIPO_LIBERACAO[liberacao.tipo];

  return (
    <article
      id={`lib-${liberacao.id}`}
      className={`${CARTAO} p-4 md:p-5 flex flex-col gap-4`}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800 uppercase tracking-wide">
            {tipoLabel}
          </span>
          <LiberacaoStatus status={liberacao.status} />
        </div>
        {showPacienteInfo && liberacao.paciente && (
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-brand-900">{liberacao.paciente.nome}</p>
            <p className="text-xs text-zinc-500">Gestor SUS {liberacao.paciente.gestor_sus}</p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Previsto</dt>
          <dd className="text-xl font-bold text-brand-900">{liberacao.quantidade} vales</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Vigência</dt>
          <dd className="text-sm font-medium text-brand-900 whitespace-nowrap">{periodoTexto(liberacao)}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Quantidade diária</dt>
          <dd className="text-sm font-medium text-brand-900">
            {valesPorDia !== undefined && valesPorDia !== null
              ? `${valesPorDia} vales/dia`
              : "Não informada"}
          </dd>
        </div>
      </div>

      <footer className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-100">
        {(permissoes.podeEditar || permissoes.podeAlterarStatus) && (
          <button
            type="button"
            onClick={() => onEditar(liberacao)}
            className="inline-flex items-center justify-center rounded-full h-10 px-4 text-sm font-medium text-zinc-700 ring-1 ring-zinc-900/10 transition-colors hover:bg-zinc-50 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 whitespace-nowrap flex-1"
          >
            Editar
          </button>
        )}
        {isAtiva && (
          <Link
            href={`/dashboard/atendimento?paciente=${liberacao.paciente_id}`}
            className="inline-flex items-center justify-center rounded-full h-10 px-4 text-sm font-semibold text-brand-900 ring-1 ring-zinc-900/10 transition-colors hover:bg-brand-50/60 hover:text-brand-700 hover:ring-brand-900/15 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 whitespace-nowrap flex-1"
          >
            Registrar retirada
          </Link>
        )}
        {permissoes.podeRenovar && isAtiva && (
          <button
            type="button"
            onClick={() => onRenovar(liberacao)}
            className={`${BOTAO_AVISO} h-10 whitespace-nowrap flex-1`}
          >
            Renovar
          </button>
        )}
      </footer>
    </article>
  );
}