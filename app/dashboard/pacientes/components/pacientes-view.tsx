"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useTransition, useState } from "react";
import { atualizarPacienteAction } from "@/app/actions/pacientes";
import {
  ORIGENS_PACIENTE,
  ROTULO_ORIGEM_PACIENTE,
  STATUS_PACIENTE,
  type OrigemPaciente,
  type PerfilUsuario,
} from "@/lib/domain/enums";
import { permissoesPacientes } from "@/lib/domain/regras";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";
import {
  BOTAO_AVISO,
  BOTAO_POSITIVO,
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
import PacienteForm from "./paciente-form";
import { PacienteStatus } from "./paciente-status";

type FormAberto =
  | { modo: "criar"; origem: OrigemPaciente }
  | { modo: "editar"; paciente: PacienteSemCpf }
  | null;

type PacientesViewProps = {
  perfil: PerfilUsuario;
  statusAtivo: boolean;
  busca: string;
  pacientesIniciais: PacienteSemCpf[];
  erroInicial: string | null;
};

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

export default function PacientesView(props: PacientesViewProps) {
  const router = useRouter();
  const permissoes = permissoesPacientes(props.perfil, props.statusAtivo);
  const [formAberto, setFormAberto] = useState<FormAberto>(null);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [pendenteStatus, startStatus] = useTransition();

  // Feedback de sucesso transitório (5s) após inativar/reativar (Sprint 23).
  useEffect(() => {
    if (!feedbackStatus) return;
    const timeout = setTimeout(() => setFeedbackStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [feedbackStatus]);

  function salvarEAtualizar() {
    setFormAberto(null);
    setErroStatus(null);
    setFeedbackStatus(null);
    router.refresh();
  }

  function alternarStatus(paciente: PacienteSemCpf) {
    const proximo =
      paciente.status === STATUS_PACIENTE.ATIVO
        ? STATUS_PACIENTE.INATIVO
        : STATUS_PACIENTE.ATIVO;

    startStatus(async () => {
      const resultado = await atualizarPacienteAction(paciente.id, {
        status: proximo,
      });
      if (!resultado.ok) {
        setErroStatus(resultado.error);
        return;
      }
      setErroStatus(null);
      setFeedbackStatus(
        proximo === STATUS_PACIENTE.ATIVO
          ? "Paciente reativado com sucesso."
          : "Paciente inativado com sucesso."
      );
      router.refresh();
    });
  }

  const vazio = props.pacientesIniciais.length === 0;
  const contagem = props.pacientesIniciais.length;

  function classeBotaoStatus(paciente: PacienteSemCpf): string {
    return `${
      paciente.status === STATUS_PACIENTE.ATIVO
        ? BOTAO_AVISO
        : BOTAO_POSITIVO
    } h-11`;
  }

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader
          titulo="Pacientes"
          descricao="Acompanhamento no CAPS — pesquisa por nome ou Gestor SUS."
          acao={
            permissoes.podeCriarRegular ? (
              <button
                type="button"
                onClick={() =>
                  setFormAberto({
                    modo: "criar",
                    origem: ORIGENS_PACIENTE.REGULAR,
                  })
                }
                className={BOTAO_PRIMARIO}
              >
                Novo paciente
              </button>
            ) : permissoes.podeCriarEsporadico ? (
              <button
                type="button"
                onClick={() =>
                  setFormAberto({
                    modo: "criar",
                    origem: ORIGENS_PACIENTE.ESPORADICO,
                  })
                }
                className={BOTAO_PRIMARIO}
              >
                Paciente Esporádico
              </button>
            ) : undefined
          }
        />

        <form
          method="get"
          action="/dashboard/pacientes"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <label htmlFor="busca-pacientes" className="sr-only">
            Buscar pacientes
          </label>
          <input
            id="busca-pacientes"
            name="q"
            type="search"
            defaultValue={props.busca}
            placeholder="Buscar por nome ou Gestor SUS"
            aria-label="Buscar pacientes por nome ou Gestor SUS"
            className={`${INPUT} flex-1`}
          />
          <div className="flex items-center gap-2">
            <button type="submit" className={BOTAO_SECUNDARIO}>
              Buscar
            </button>
            {props.busca && (
              <Link href="/dashboard/pacientes" className={LINK}>
                Limpar
              </Link>
            )}
          </div>
        </form>

        {erroStatus && <FeedbackErro>{erroStatus}</FeedbackErro>}
        {props.erroInicial && <FeedbackErro>{props.erroInicial}</FeedbackErro>}
        {feedbackStatus && <FeedbackSucesso>{feedbackStatus}</FeedbackSucesso>}

        {!vazio && !props.erroInicial && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            {contagem} {contagem === 1 ? "paciente" : "pacientes"}
            {props.busca
              ? " para esta busca."
              : contagem === 1
                ? " cadastrado."
                : " cadastrados."}
          </p>
        )}

        {vazio ? (
          <EstadoVazio
            mensagem={
              props.busca
                ? "Nenhum paciente encontrado para esta busca."
                : "Nenhum paciente cadastrado ainda."
            }
          />
        ) : (
          <>
            {/* Desktop — tabela */}
            <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Gestor SUS</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Início</th>
                    <th className="px-4 py-3 font-medium">Fim</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {props.pacientesIniciais.map((paciente) => (
                    <tr
                      key={paciente.id}
                      className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3 font-medium text-brand-900">
                        <span className="flex items-center gap-2">
                          {paciente.nome}
                          {paciente.origem === ORIGENS_PACIENTE.ESPORADICO && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              {ROTULO_ORIGEM_PACIENTE[paciente.origem]}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {paciente.gestor_sus}
                      </td>
                      <td className="px-4 py-3">
                        <PacienteStatus status={paciente.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatarData(paciente.data_inicio_acompanhamento)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatarData(paciente.data_fim_acompanhamento)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {permissoes.podeEditarDados && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormAberto({
                                  modo: "editar",
                                  paciente,
                                })
                              }
                              className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 motion-reduce:transition-none"
                            >
                              Editar
                            </button>
                          )}
                          {permissoes.podeAlterarStatus && (
                            <button
                              type="button"
                              disabled={pendenteStatus}
                              onClick={() => alternarStatus(paciente)}
                              className={`${
                                paciente.status === STATUS_PACIENTE.ATIVO
                                  ? BOTAO_AVISO
                                  : BOTAO_POSITIVO
                              } h-9`}
                            >
                              {pendenteStatus
                                ? "Salvando..."
                                : paciente.status === STATUS_PACIENTE.ATIVO
                                  ? "Inativar"
                                  : "Reativar"}
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
              {props.pacientesIniciais.map((paciente) => (
                <li key={paciente.id} className={`${CARTAO} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-brand-900">
                        {paciente.nome}
                        {paciente.origem === ORIGENS_PACIENTE.ESPORADICO && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            {ROTULO_ORIGEM_PACIENTE[paciente.origem]}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Gestor SUS {paciente.gestor_sus}
                      </p>
                    </div>
                    <PacienteStatus status={paciente.status} />
                  </div>

                  <dl className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-zinc-500">Início</dt>
                      <dd className="font-medium text-brand-900">
                        {formatarData(paciente.data_inicio_acompanhamento)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-zinc-500">Fim</dt>
                      <dd className="font-medium text-brand-900">
                        {formatarData(paciente.data_fim_acompanhamento)}
                      </dd>
                    </div>
                  </dl>

                  {(permissoes.podeEditarDados || permissoes.podeAlterarStatus) && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {permissoes.podeEditarDados && (
                        <button
                          type="button"
                          onClick={() => setFormAberto({ modo: "editar", paciente })}
                          className={BOTAO_SECUNDARIO}
                        >
                          Editar
                        </button>
                      )}
                      {permissoes.podeAlterarStatus && (
                        <button
                          type="button"
                          disabled={pendenteStatus}
                          onClick={() => alternarStatus(paciente)}
                          className={classeBotaoStatus(paciente)}
                        >
                          {pendenteStatus
                            ? "Salvando..."
                            : paciente.status === STATUS_PACIENTE.ATIVO
                              ? "Inativar"
                              : "Reativar"}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {formAberto && (
          <PacienteForm
            {...(formAberto.modo === "criar"
              ? {
                  modo: "criar" as const,
                  origem: formAberto.origem,
                }
              : { modo: "editar" as const, paciente: formAberto.paciente })}
            onClose={() => {
              setFormAberto(null);
              setErroStatus(null);
            }}
            onSalvo={salvarEAtualizar}
          />
        )}
      </div>
    </div>
  );
}
