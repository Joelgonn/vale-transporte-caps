"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ROTULO_TIPO_LIBERACAO, type PerfilUsuario } from "@/lib/domain/enums";
import { permissoesLiberacoes } from "@/lib/domain/regras";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";
import {
  BOTAO_AVISO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CARTAO,
  CONTAINER,
  INPUT,
  LINK,
} from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro, FeedbackSucesso } from "@/components/ui/feedback";
import { LiberacaoStatus } from "./liberacao-status";
import LiberacaoForm from "./liberacao-form";

type FormAberto =
  | { modo: "criar" }
  | { modo: "renovar"; origem: LiberacaoComPaciente }
  | null;

type LiberacoesViewProps = {
  perfil: PerfilUsuario;
  statusAtivo: boolean;
  busca: string;
  liberacoesIniciais: LiberacaoComPaciente[];
  erroInicial: string | null;
};

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function periodoTexto(lib: LiberacaoComPaciente): string {
  return `${formatarData(lib.data_inicio)} – ${formatarData(lib.data_fim)}`;
}

export default function LiberacoesView(props: LiberacoesViewProps) {
  const router = useRouter();
  const permissoes = permissoesLiberacoes(props.perfil, props.statusAtivo);
  const [formAberto, setFormAberto] = useState<FormAberto>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Feedback pós-salvar (Sprint 19): banner transitório após criar/renovar.
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const vazio = props.liberacoesIniciais.length === 0;
  const podeRenovar = permissoes.podeRenovar;

  const descricao =
    props.perfil === "recepcionista"
      ? "Liberações ativas do vale-transporte — apenas as liberações vigentes."
      : "Liberações registradas no CAPS — busque por paciente ou Gestor SUS.";

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader
          titulo="Liberações"
          descricao={descricao}
          acao={
            permissoes.podeCriar ? (
              <button
                type="button"
                onClick={() => setFormAberto({ modo: "criar" })}
                className={BOTAO_PRIMARIO}
              >
                Nova liberação
              </button>
            ) : undefined
          }
        />

        <form
          method="get"
          action="/dashboard/liberacoes"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <label htmlFor="busca-liberacoes" className="sr-only">
            Buscar liberações
          </label>
          <input
            id="busca-liberacoes"
            name="q"
            type="search"
            defaultValue={props.busca}
            placeholder="Buscar por paciente ou Gestor SUS"
            aria-label="Buscar liberações por paciente ou Gestor SUS"
            className={`${INPUT} flex-1`}
          />
          <div className="flex items-center gap-2">
            <button type="submit" className={BOTAO_SECUNDARIO}>
              Buscar
            </button>
            {props.busca && (
              <Link href="/dashboard/liberacoes" className={LINK}>
                Limpar
              </Link>
            )}
          </div>
        </form>

        {props.erroInicial && <FeedbackErro>{props.erroInicial}</FeedbackErro>}

        {feedback && <FeedbackSucesso>{feedback}</FeedbackSucesso>}

        {!vazio && !props.erroInicial && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            {props.liberacoesIniciais.length}{" "}
            {props.liberacoesIniciais.length === 1 ? "liberação" : "liberações"}
            {props.busca
              ? " para esta busca."
              : props.liberacoesIniciais.length === 1
                ? " registrada."
                : " registradas."}
          </p>
        )}

        {vazio ? (
          <EstadoVazio
            mensagem={
              props.busca
                ? "Nenhuma liberação encontrada para esta busca."
                : props.perfil === "recepcionista"
                  ? "Nenhuma liberação ativa no momento."
                  : "Nenhuma liberação registrada ainda."
            }
          />
        ) : (
          <>
            {/* Desktop — tabela */}
            <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Paciente</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Quantidade</th>
                    <th className="px-4 py-3 font-medium">Período</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {props.liberacoesIniciais.map((lib) => (
                    <tr
                      key={lib.id}
                      className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-900">
                          {lib.paciente?.nome ?? "Paciente"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {lib.paciente ? `Gestor SUS ${lib.paciente.gestor_sus}` : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {ROTULO_TIPO_LIBERACAO[lib.tipo]}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{lib.quantidade}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {periodoTexto(lib)}
                      </td>
                      <td className="px-4 py-3">
                        <LiberacaoStatus status={lib.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {podeRenovar && lib.status === "ativa" && (
                            <button
                              type="button"
                              onClick={() => setFormAberto({ modo: "renovar", origem: lib })}
                              className={`${BOTAO_AVISO} h-9`}
                            >
                              Renovar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — cards com as informações prioritárias */}
            <ul className="flex flex-col gap-3 md:hidden">
              {props.liberacoesIniciais.map((lib) => (
                <li
                  key={lib.id}
                  className={`${CARTAO} p-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-brand-900">
                        {lib.paciente?.nome ?? "Paciente"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {lib.paciente ? `Gestor SUS ${lib.paciente.gestor_sus}` : "—"}
                      </p>
                    </div>
                    <LiberacaoStatus status={lib.status} />
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-zinc-500">Tipo</dt>
                      <dd className="font-medium text-brand-900">
                        {ROTULO_TIPO_LIBERACAO[lib.tipo]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Quantidade</dt>
                      <dd className="font-medium text-brand-900">{lib.quantidade}</dd>
                    </div>
                    <div className="w-full sm:w-auto">
                      <dt className="text-xs text-zinc-500">Período</dt>
                      <dd className="font-medium text-brand-900">{periodoTexto(lib)}</dd>
                    </div>
                  </dl>

                  {podeRenovar && lib.status === "ativa" && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setFormAberto({ modo: "renovar", origem: lib })}
                        className={`${BOTAO_AVISO} h-11`}
                      >
                        Renovar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {formAberto && (
          <LiberacaoForm
            {...(formAberto.modo === "criar"
              ? { modo: "criar" as const }
              : { modo: "renovar" as const, origem: formAberto.origem })}
            onClose={() => setFormAberto(null)}
            onSalvo={() => {
              setFeedback(
                formAberto.modo === "renovar"
                  ? "Liberação renovada com sucesso."
                  : "Liberação criada com sucesso."
              );
              setFormAberto(null);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
