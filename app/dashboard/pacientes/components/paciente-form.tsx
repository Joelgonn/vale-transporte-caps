"use client";

import { useActionState } from "react";
import {
  atualizarPacienteAction,
  criarPacienteAction,
} from "@/app/actions/pacientes";
import { useModalA11y } from "@/components/ui/use-modal-a11y";
import { FeedbackErro, FeedbackSucesso } from "@/components/ui/feedback";
import { mensagemUsuario } from "@/components/ui/mensagens";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  INPUT,
  ROTULO,
} from "@/components/ui/visual-tokens";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";

type PacienteFormProps =
  | { modo: "criar"; onClose: () => void; onSalvo: () => void }
  | { modo: "editar"; paciente: PacienteSemCpf; onClose: () => void; onSalvo: () => void };

type FormState = { error?: string; sucesso?: boolean };

function lerCampo(formData: FormData, nome: string): string | null {
  const valor = formData.get(nome);
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

export default function PacienteForm(props: PacienteFormProps) {
  const isEdicao = props.modo === "editar";
  const paciente = isEdicao ? props.paciente : null;

  const executar = async (
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> => {
    const camposComuns = {
      gestor_sus: lerCampo(formData, "gestor_sus"),
      nome: lerCampo(formData, "nome"),
      data_inicio_acompanhamento: lerCampo(formData, "data_inicio_acompanhamento"),
      data_fim_acompanhamento: lerCampo(formData, "data_fim_acompanhamento"),
    };

    const resultado = isEdicao
      ? await atualizarPacienteAction(paciente!.id, {
          nome: camposComuns.nome ?? undefined,
          data_inicio_acompanhamento: camposComuns.data_inicio_acompanhamento,
          data_fim_acompanhamento: camposComuns.data_fim_acompanhamento,
        })
      : await criarPacienteAction({
          gestor_sus: camposComuns.gestor_sus ?? "",
          nome: camposComuns.nome ?? "",
          cpf: lerCampo(formData, "cpf"),
          data_inicio_acompanhamento: camposComuns.data_inicio_acompanhamento,
          data_fim_acompanhamento: camposComuns.data_fim_acompanhamento,
        });

    return resultado.ok
      ? { sucesso: true }
      : { error: resultado.error };
  };

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    executar,
    {}
  );

  const bloq = pending || state.sucesso;
  const ref = useModalA11y(props.onClose, !bloq);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 outline-none sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdicao ? "Editar paciente" : "Novo paciente"}
    >
      <form
        action={formAction}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-lg bg-white p-6 sm:rounded-lg"
      >
        <div>
          <h2 className="text-lg font-semibold text-brand-900">
            {isEdicao ? "Editar paciente" : "Novo paciente"}
          </h2>
          <p className="text-sm text-zinc-500">
            {isEdicao
              ? "Altere os dados abaixo. O CPF não é editado por esta tela."
              : "Cadastro de acompanhamento no CAPS."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="gestor_sus" className={ROTULO}>
            Gestor SUS
          </label>
          <input
            id="gestor_sus"
            name="gestor_sus"
            defaultValue={paciente?.gestor_sus ?? ""}
            required={!isEdicao}
            disabled={isEdicao || pending || state.sucesso}
            className={`${INPUT} disabled:bg-zinc-100 disabled:opacity-60`}
          />
          {isEdicao && (
            <p className="text-xs text-zinc-500">
              Gestor SUS é a identificação do paciente (RN25) e não é editável.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="nome" className={ROTULO}>
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            defaultValue={paciente?.nome ?? ""}
            required
            disabled={pending || state.sucesso}
            className={INPUT}
          />
        </div>

        {!isEdicao && (
          <div className="flex flex-col gap-2">
            <label htmlFor="cpf" className={ROTULO}>
              CPF{" "}
              <span className="font-normal text-zinc-500">
                (opcional, dado protegido)
              </span>
            </label>
            <input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              disabled={pending || state.sucesso}
              className={INPUT}
              placeholder="Somente números"
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="data_inicio_acompanhamento"
              className={ROTULO}
            >
              Início do acompanhamento
            </label>
            <input
              id="data_inicio_acompanhamento"
              name="data_inicio_acompanhamento"
              type="date"
              defaultValue={paciente?.data_inicio_acompanhamento ?? ""}
              disabled={pending || state.sucesso}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="data_fim_acompanhamento"
              className={ROTULO}
            >
              Fim do acompanhamento
            </label>
            <input
              id="data_fim_acompanhamento"
              name="data_fim_acompanhamento"
              type="date"
              defaultValue={paciente?.data_fim_acompanhamento ?? ""}
              disabled={pending || state.sucesso}
              className={INPUT}
            />
          </div>
        </div>

        {state.error && (
          <FeedbackErro>{mensagemUsuario(state.error)}</FeedbackErro>
        )}
        {state.sucesso && (
          <FeedbackSucesso>
            Paciente {isEdicao ? "atualizado" : "cadastrado"} com sucesso.
          </FeedbackSucesso>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={props.onClose}
            disabled={pending}
            className={BOTAO_SECUNDARIO}
          >
            Cancelar
          </button>
          {state.sucesso ? (
            <button
              type="button"
              onClick={props.onSalvo}
              className={BOTAO_PRIMARIO}
            >
              Concluir
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className={BOTAO_PRIMARIO}
            >
              {pending ? "Salvando..." : isEdicao ? "Salvar alterações" : "Cadastrar"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
