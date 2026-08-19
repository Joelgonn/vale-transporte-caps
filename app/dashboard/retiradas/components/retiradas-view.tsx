"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ROTULO_TIPO_LIBERACAO, type PerfilUsuario } from "@/lib/domain/enums";
import { permissoesRetiradas } from "@/lib/domain/regras";
import type { RetiradaComDetalhes } from "@/lib/domain/retiradas/types";
import { BOTAO_PRIMARIO, CARTAO, CONTAINER } from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro, FeedbackSucesso } from "@/components/ui/feedback";
import RetiradaForm from "./retirada-form";

type RetiradasViewProps = {
  perfil: PerfilUsuario;
  statusAtivo: boolean;
  retiradasIniciais: RetiradaComDetalhes[];
  erroInicial: string | null;
};

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Fatia direto do ISO retornado pelo banco (timestamptz) — determinístico,
  // sem depender do fuso local do navegador/servidor.
  const [data, hora] = iso.split("T");
  const [ano, mes, dia] = (data ?? "").split("-");
  const hhmm = (hora ?? "").slice(0, 5);
  return ano && mes && dia ? `${dia}/${mes}/${ano} ${hhmm}` : iso;
}

function liberacaoTexto(ret: RetiradaComDetalhes): string {
  if (!ret.liberacao) return "—";
  const tipo = ROTULO_TIPO_LIBERACAO[ret.liberacao.tipo] ?? ret.liberacao.tipo;
  return `${tipo} · ${ret.liberacao.quantidade}`;
}

function periodoLiberacao(ret: RetiradaComDetalhes): string {
  if (!ret.liberacao) return "—";
  return `${formatarData(ret.liberacao.data_inicio)} – ${formatarData(ret.liberacao.data_fim)}`;
}

export default function RetiradasView(props: RetiradasViewProps) {
  const router = useRouter();
  const permissoes = permissoesRetiradas(props.perfil, props.statusAtivo);
  const [formAberto, setFormAberto] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Feedback pós-salvar (Sprint 20): banner transitório após registrar.
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const vazio = props.retiradasIniciais.length === 0;

  const descricao =
    props.perfil === "gestor"
      ? "Retiradas de vale-transporte registradas no CAPS — acompanhamento de leitura."
      : "Retiradas de vale-transporte registradas pela recepção.";

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader
          titulo="Retiradas"
          descricao={descricao}
          acao={
            permissoes.podeRegistrar ? (
              <button
                type="button"
                onClick={() => setFormAberto(true)}
                className={BOTAO_PRIMARIO}
              >
                Registrar retirada
              </button>
            ) : undefined
          }
        />

        {props.erroInicial && <FeedbackErro>{props.erroInicial}</FeedbackErro>}

        {feedback && <FeedbackSucesso>{feedback}</FeedbackSucesso>}

        {!vazio && !props.erroInicial && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            {props.retiradasIniciais.length}{" "}
            {props.retiradasIniciais.length === 1 ? "retirada" : "retiradas"}
            {" "}registradas.
          </p>
        )}

        {vazio ? (
          <EstadoVazio mensagem="Nenhuma retirada registrada ainda." />
        ) : (
          <>
            {/* Desktop — tabela */}
            <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Paciente</th>
                    <th className="px-4 py-3 font-medium">Liberação</th>
                    <th className="px-4 py-3 font-medium">Quantidade</th>
                    <th className="px-4 py-3 font-medium">Data e hora</th>
                    {permissoes.visualizaResponsavel && (
                      <th className="px-4 py-3 font-medium">Responsável</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {props.retiradasIniciais.map((ret) => (
                    <tr
                      key={ret.id}
                      className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-900">
                          {ret.paciente?.nome ?? "Paciente"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {ret.paciente ? `Gestor SUS ${ret.paciente.gestor_sus}` : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {liberacaoTexto(ret)}
                        <p className="text-xs text-zinc-500">{periodoLiberacao(ret)}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{ret.quantidade}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatarDataHora(ret.data_hora)}
                      </td>
                      {permissoes.visualizaResponsavel && (
                        <td className="px-4 py-3 text-zinc-600">
                          {ret.recepcionista?.nome ?? "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — cards com as informações prioritárias */}
            <ul className="flex flex-col gap-3 md:hidden">
              {props.retiradasIniciais.map((ret) => (
                <li key={ret.id} className={`${CARTAO} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-brand-900">
                        {ret.paciente?.nome ?? "Paciente"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {ret.paciente ? `Gestor SUS ${ret.paciente.gestor_sus}` : "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold text-brand-900">
                      {ret.quantidade}
                    </span>
                  </div>

                  <dl className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-zinc-500">Liberação</dt>
                      <dd className="font-medium text-brand-900">{liberacaoTexto(ret)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-zinc-500">Vigência</dt>
                      <dd className="font-medium text-brand-900">{periodoLiberacao(ret)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-zinc-500">Data e hora</dt>
                      <dd className="font-medium text-brand-900">
                        {formatarDataHora(ret.data_hora)}
                      </dd>
                    </div>
                    {permissoes.visualizaResponsavel && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-zinc-500">Responsável</dt>
                        <dd className="font-medium text-brand-900">
                          {ret.recepcionista?.nome ?? "—"}
                        </dd>
                      </div>
                    )}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}

        {formAberto && (
          <RetiradaForm
            onClose={() => setFormAberto(false)}
            onSalvo={() => {
              setFeedback("Retirada registrada com sucesso.");
              setFormAberto(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}