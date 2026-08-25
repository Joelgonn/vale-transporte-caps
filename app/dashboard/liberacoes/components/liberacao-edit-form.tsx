"use client";

import { useActionState, useState } from "react";
import { atualizarLiberacaoAction } from "@/app/actions/liberacoes";
import { useModalA11y } from "@/components/ui/use-modal-a11y";
import { FeedbackErro, FeedbackSucesso } from "@/components/ui/feedback";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  INPUT,
  ROTULO,
} from "@/components/ui/visual-tokens";
import {
  PERFIS,
  ROTULO_STATUS_LIBERACAO,
  STATUS_LIBERACAO,
  type PerfilUsuario,
} from "@/lib/domain/enums";
import { calcularPrevisaoVales } from "@/lib/domain/liberacoes/previsao";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";

// Sprint 42 — edição segura de liberação. Os campos exibidos seguem a MESMA
// whitelist do domínio/banco (CAMPOS_EDICAO_LIBERACAO_POR_PERFIL):
//   * profissional_autorizador → quantidade (previsão RN04), datas da vigência
//     e justificativa — nunca status/paciente/tipo/período/autorizador;
//   * gestor → status (cancelamento) — nunca dados clínicos da autorização;
//   * recepcionista → este formulário nem é aberto (a view não oferece o botão).
type LiberacaoEditFormProps = {
  liberacao: LiberacaoComPaciente;
  perfil: PerfilUsuario;
  onClose: () => void;
  onSalvo: () => void;
};

type FormState = { error?: string; sucesso?: boolean };

function lerCampo(formData: FormData, nome: string): string | null {
  const valor = formData.get(nome);
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

export default function LiberacaoEditForm(props: LiberacaoEditFormProps) {
  const ehGestor = props.perfil === PERFIS.GESTOR;
  const lib = props.liberacao;

  // Sprint 42.1 - calculadora de previsão (somente interface, nunca persistida).
  const [calcParams, setCalcParams] = useState({ valesPorDia: 0, diasPorSemana: 0 });
  const [quantidadeManual, setQuantidadeManual] = useState<number | null>(null);
  const previsao =
    lib.tipo === "continua" && lib.periodo_meses != null
      ? calcularPrevisaoVales(calcParams.valesPorDia, calcParams.diasPorSemana, lib.periodo_meses)
      : null;
  const quantidadeAtual =
    quantidadeManual ??
    (previsao && previsao.previsaoTotal > 0
      ? previsao.previsaoTotal
      : lib.quantidade);

  const executar = async (
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> => {
    const dados: Record<string, unknown> = {};

    if (ehGestor) {
      const status = lerCampo(formData, "status");
      if (status) dados.status = status;
    } else {
      const quantidade = Number(formData.get("quantidade"));
      if (Number.isInteger(quantidade) && quantidade > 0) {
        dados.quantidade = quantidade;
      }
      const inicio = lerCampo(formData, "data_inicio");
      if (inicio) dados.data_inicio = inicio;
      const fim = lerCampo(formData, "data_fim");
      if (fim) dados.data_fim = fim;
      const justificativa = formData.get("justificativa");
      if (typeof justificativa === "string" && justificativa.trim()) {
        dados.justificativa = justificativa.trim();
      }
    }

    const resultado = await atualizarLiberacaoAction(props.liberacao.id, dados);

    return resultado.ok ? { sucesso: true } : { error: resultado.error };
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
      aria-label="Editar liberação"
    >
      <form
        action={formAction}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-lg bg-white p-6 sm:rounded-lg"
      >
        <div>
          <h2 className="text-lg font-semibold text-brand-900">
            Editar liberação
          </h2>
          <p className="text-sm text-zinc-500">
            A quantidade é uma PREVISÃO administrativa — não bloqueia retiradas
            durante a vigência. Paciente, tipo e autorizador são históricos e
            não podem ser alterados.
          </p>
        </div>

        {/* Contexto imutável (somente leitura). */}
        <dl className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">Paciente</dt>
            <dd className="font-medium text-brand-900">
              {lib.paciente?.nome ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">Tipo</dt>
            <dd className="font-medium text-brand-900">{lib.tipo}</dd>
          </div>
        </dl>

        {ehGestor ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="status" className={ROTULO}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={lib.status}
              disabled={bloq}
              className={INPUT}
            >
              {Object.values(STATUS_LIBERACAO).map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS_LIBERACAO[s]}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              O Gestor altera apenas o status (ex.: cancelamento administrativo)
              da liberação.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="quantidade" className={ROTULO}>
                Quantidade prevista
              </label>
              <input
                id="quantidade"
                name="quantidade"
                type="number"
                min={1}
                max={999}
                step={1}
                value={String(quantidadeAtual)}
                disabled={bloq}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  if (Number.isInteger(q) && q > 0) setQuantidadeManual(q);
                }}
                className={INPUT}
              />
              <p className="text-xs text-zinc-500">
                Previsão administrativa (RN31) — retiradas continuam permitidas
                durante toda a vigência, mesmo que a ultrapassem.
              </p>

              {/* Sprint 42.1 — Calculadora de previsão (auxiliar de interface). */}
              {previsao && (
                <fieldset
                  aria-label="Calculadora de previsão"
                  className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                >
                  <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Calculadora de previsão
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="calc-vales-dia" className={ROTULO}>
                        Vales por dia
                      </label>
                      <input
                        id="calc-vales-dia"
                        type="number"
                        min={0}
                        step={1}
                        value={calcParams.valesPorDia ? String(calcParams.valesPorDia) : ""}
                        disabled={bloq}
                        onChange={(e) => {
                    setCalcParams((prev) => ({
                      ...prev,
                      valesPorDia: Number(e.target.value),
                    }));
                    setQuantidadeManual(null);
                  }}
                        className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="calc-dias-semana" className={ROTULO}>
                        Dias por semana
                      </label>
                      <input
                        id="calc-dias-semana"
                        type="number"
                        min={0}
                        max={7}
                        step={1}
                        value={calcParams.diasPorSemana ? String(calcParams.diasPorSemana) : ""}
                        disabled={bloq}
                        onChange={(e) => {
                          setCalcParams((prev) => ({
                            ...prev,
                            diasPorSemana: Math.min(7, Number(e.target.value)),
                          }));
                          setQuantidadeManual(null);
                        }}
                        className={INPUT}
                      />
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-zinc-500">Por semana</dt>
                      <dd className="font-medium text-brand-900">{previsao.valesPorSemana}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Semanas</dt>
                      <dd className="font-medium text-brand-900">{previsao.semanas}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Período</dt>
                      <dd className="font-medium text-brand-900">
                        {lib.periodo_meses} mês(es)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Previsão total</dt>
                      <dd className="font-semibold text-brand-900">{previsao.previsaoTotal}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-zinc-500">
                    Recalcula e preenche a quantidade prevista em tempo real
                    (editável). Não persistimos vales/dia nem dias/semana.
                  </p>
                </fieldset>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="data_inicio" className={ROTULO}>
                  Início da vigência
                </label>
                <input
                  id="data_inicio"
                  name="data_inicio"
                  type="date"
                  defaultValue={lib.data_inicio.slice(0, 10)}
                  disabled={bloq}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="data_fim" className={ROTULO}>
                  Fim da vigência
                </label>
                <input
                  id="data_fim"
                  name="data_fim"
                  type="date"
                  defaultValue={lib.data_fim.slice(0, 10)}
                  disabled={bloq}
                  className={INPUT}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="justificativa" className={ROTULO}>
                Justificativa da alteração{" "}
                <span className="font-normal text-zinc-500">(opcional)</span>
              </label>
              <textarea
                id="justificativa"
                name="justificativa"
                rows={3}
                disabled={bloq}
                defaultValue={lib.justificativa ?? ""}
                className={INPUT}
              />
            </div>
          </>
        )}

        {state.error && <FeedbackErro>{state.error}</FeedbackErro>}
        {state.sucesso && (
          <FeedbackSucesso>Liberação atualizada com sucesso.</FeedbackSucesso>
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
              {pending ? "Salvando..." : "Salvar alterações"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
