"use client";

import { useActionState, useState } from "react";
import { listarLiberacoesAction } from "@/app/actions/liberacoes";
import { listarPacientesAction } from "@/app/actions/pacientes";
import {
  listarRetiradasAction,
  registrarRetiradaAction,
} from "@/app/actions/retiradas";
import { ROTULO_TIPO_LIBERACAO } from "@/lib/domain/enums";
import type { PacienteResumo } from "@/lib/domain/retiradas/types";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  INPUT,
  ROTULO,
} from "@/components/ui/visual-tokens";
import { useModalA11y } from "@/components/ui/use-modal-a11y";
import { FeedbackErro, FeedbackSucesso } from "@/components/ui/feedback";
import { mensagemRetirada } from "@/components/ui/mensagens";

type RetiradaFormProps = {
  onClose: () => void;
  onSalvo: () => void;
};

type FormState = {
  error?: string;
  erroCampos?: Partial<Record<"paciente" | "liberacao" | "quantidade", string>>;
  sucesso?: boolean;
};

type CampoRetirada = keyof NonNullable<FormState["erroCampos"]>;
type ErroCampo = { campo: CampoRetirada; mensagem: string };

// Fluxo em etapas do registro de retirada (Sprint 20): o usuário avança de
// Paciente → Liberação (com saldo disponível calculado) → Quantidade → Revisão.
const PASSOS: { id: number; rotulo: string }[] = [
  { id: 1, rotulo: "Paciente" },
  { id: 2, rotulo: "Liberação" },
  { id: 3, rotulo: "Quantidade" },
  { id: 4, rotulo: "Revisão" },
];

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function periodoTexto(lib: LiberacaoComPaciente): string {
  return `${formatarData(lib.data_inicio)} – ${formatarData(lib.data_fim)}`;
}

export default function RetiradaForm({ onClose, onSalvo }: RetiradaFormProps) {
  const [paciente, setPaciente] = useState<PacienteResumo | null>(null);
  const [passo, setPasso] = useState(1);
  const [errosPasso, setErrosPasso] = useState<ErroCampo[]>([]);

  // Liberações do paciente (ativas para a recepção via RLS) + saldo disponível
  // calculado no cliente com dados reais: quantidade - soma das retiradas.
  // A autoridade final do saldo permanece no banco (trigger fn_retiradas_before).
  const [liberacoes, setLiberacoes] = useState<LiberacaoComPaciente[]>([]);
  const [disponiveis, setDisponiveis] = useState<Record<string, number>>({});
  const [liberacaoSelecionada, setLiberacaoSelecionada] =
    useState<LiberacaoComPaciente | null>(null);
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [consultadoPacienteId, setConsultadoPacienteId] = useState<string | null>(
    null
  );
  const [liberacoesCarregando, setLiberacoesCarregando] = useState(false);
  const [erroLiberacoes, setErroLiberacoes] = useState<string | null>(null);

  // Seletor de paciente — pesquisa por nome/Gestor SUS via server action
  // (v_pacientes, sem CPF). Nunca carrega a lista completa.
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [resultados, setResultados] = useState<PacienteSemCpf[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);

  // Validação local de cada etapa (mesmas regras do servidor) — impede avançar
  // com o passo incompleto e evita submissões claramente inválidas.
  function errosDoPasso(p: number): ErroCampo[] {
    if (p === 1) {
      return paciente
        ? []
        : [{ campo: "paciente", mensagem: "Selecione o paciente." }];
    }
    if (p === 2) {
      if (liberacoesCarregando) return [];
      if (!liberacaoSelecionada) {
        return [{ campo: "liberacao", mensagem: "Selecione a liberação." }];
      }
      const disp = disponiveis[liberacaoSelecionada.id] ?? 0;
      return disp > 0
        ? []
        : [{ campo: "liberacao", mensagem: "Liberação sem saldo disponível." }];
    }
    if (p === 3) {
      return quantidade != null && quantidade > 0
        ? []
        : [
            {
              campo: "quantidade",
              mensagem: "Quantidade da retirada deve ser positiva (RN14).",
            },
          ];
    }
    return [];
  }

  function avancar() {
    if (passo === 1 && paciente && consultadoPacienteId !== paciente.id) {
      carregarLiberacoes(paciente);
    }
    const erros = errosDoPasso(passo);
    if (erros.length > 0) {
      setErrosPasso(erros);
      return;
    }
    setErrosPasso([]);
    setPasso((p) => Math.min(PASSOS.length, p + 1));
  }

  function voltar() {
    setErrosPasso([]);
    setPasso((p) => Math.max(1, p - 1));
  }

  function limparErro(campo: CampoRetirada) {
    setErrosPasso((atual) => atual.filter((e) => e.campo !== campo));
  }

  function erroDe(campo: CampoRetirada): string | undefined {
    const local = errosPasso.find((e) => e.campo === campo)?.mensagem;
    return local ?? state.erroCampos?.[campo];
  }

  // Carrega as liberações do paciente (server-side, busca por Gestor SUS) e as
  // retiradas (para somar o que já foi retirado). O saldo disponível é exibido
  // como orientação — a autoridade final é o trigger no banco.
  async function carregarLiberacoes(p: PacienteResumo) {
    setLiberacoesCarregando(true);
    setErroLiberacoes(null);

    const [resultadoLib, resultadoRet] = await Promise.all([
      listarLiberacoesAction(p.gestor_sus),
      listarRetiradasAction(),
    ]);

    setLiberacoesCarregando(false);

    if (!resultadoLib.ok) {
      setErroLiberacoes(resultadoLib.error);
      return;
    }
    if (!resultadoRet.ok) {
      setErroLiberacoes(resultadoRet.error);
      return;
    }

    const idsPaciente = new Set(resultadoLib.data.map((l) => l.id));
    const totalRetirado: Record<string, number> = {};
    for (const r of resultadoRet.data) {
      if (!idsPaciente.has(r.liberacao_id)) continue;
      totalRetirado[r.liberacao_id] =
        (totalRetirado[r.liberacao_id] ?? 0) + r.quantidade;
    }

    const disp: Record<string, number> = {};
    for (const lib of resultadoLib.data) {
      disp[lib.id] = lib.quantidade - (totalRetirado[lib.id] ?? 0);
    }

    setLiberacoes(resultadoLib.data);
    setDisponiveis(disp);
    setConsultadoPacienteId(p.id);
  }

  function selecionarLiberacao(lib: LiberacaoComPaciente, disp: number) {
    setLiberacaoSelecionada(lib);
    setQuantidade(disp > 0 ? 1 : null);
    limparErro("liberacao");
  }

  const executar = async (): Promise<FormState> => {
    const erros: ErroCampo[] = [];

    if (!paciente) {
      erros.push({ campo: "paciente", mensagem: "Selecione o paciente." });
    }
    if (!liberacaoSelecionada) {
      erros.push({ campo: "liberacao", mensagem: "Selecione a liberação." });
    }

    const qtd = quantidade;
    if (qtd == null || !Number.isInteger(qtd) || qtd <= 0) {
      erros.push({
        campo: "quantidade",
        mensagem: "Quantidade da retirada deve ser positiva (RN14).",
      });
    } else if (liberacaoSelecionada) {
      const disp = disponiveis[liberacaoSelecionada.id] ?? 0;
      if (qtd > disp) {
        erros.push({
          campo: "quantidade",
          mensagem: `Quantidade excede o saldo disponível (${disp}).`,
        });
      }
    }

    if (erros.length > 0) {
      const erroCampos: FormState["erroCampos"] = {};
      for (const e of erros) erroCampos[e.campo] = e.mensagem;
      return { erroCampos };
    }

    if (!paciente || !liberacaoSelecionada || qtd == null) {
      return { error: "Dados inválidos." };
    }

    const resultado = await registrarRetiradaAction({
      liberacaoId: liberacaoSelecionada.id,
      pacienteId: paciente.id,
      quantidade: qtd,
    });

    return resultado.ok ? { sucesso: true } : { error: resultado.error };
  };

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    executar,
    {}
  );

  const bloq = pending || state.sucesso;
  const dispSelecionada = liberacaoSelecionada
    ? disponiveis[liberacaoSelecionada.id] ?? 0
    : 0;
  const ref = useModalA11y(onClose, !bloq);

  function buscarPacientes() {
    const termo = buscaPaciente.trim();
    setErroBusca(null);
    setBuscando(true);
    listarPacientesAction(termo).then((resultado) => {
      setBuscando(false);
      if (!resultado.ok) {
        setErroBusca(resultado.error);
        setResultados(null);
        return;
      }
      setResultados(resultado.data);
    });
  }

  function trocarPaciente() {
    setPaciente(null);
    setResultados(null);
    setSeletorAberto(true);
    setLiberacoes([]);
    setDisponiveis({});
    setLiberacaoSelecionada(null);
    setQuantidade(null);
    setConsultadoPacienteId(null);
    setErroLiberacoes(null);
    limparErro("paciente");
  }

  const opcoesQuantidade =
    liberacaoSelecionada && dispSelecionada > 0
      ? Array.from({ length: dispSelecionada }, (_, i) => i + 1)
      : [];

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 outline-none sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar retirada"
    >
      <form
        action={formAction}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-lg bg-white p-6 sm:rounded-lg"
      >
        <div>
          <h2 className="text-lg font-semibold text-brand-900">
            Registrar retirada
          </h2>
          <p className="text-sm text-zinc-500">
            Registro de retirada de vale-transporte pelo balcão do CAPS.
          </p>
        </div>

        <div
          aria-label="Progresso do registro de retirada"
          className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
        >
          <p aria-live="polite" className="mb-2 text-xs font-medium text-zinc-500">
            Etapa {passo} de {PASSOS.length}
          </p>
          <ol className="flex flex-col gap-1.5">
            {PASSOS.map((p) => {
              const concluido = p.id < passo;
              const atual = p.id === passo;
              return (
                <li
                  key={p.id}
                  aria-current={atual ? "step" : undefined}
                  className="flex items-center gap-2.5 text-sm"
                >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          concluido
                            ? "bg-green-100 text-green-800"
                            : atual
                              ? "bg-brand-600 text-white"
                              : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                    {concluido ? "✓" : p.id}
                  </span>
                  <span
                    className={atual ? "font-medium text-brand-900" : "text-zinc-500"}
                  >
                    {p.rotulo}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Passo 1 — Paciente */}
        <div className={passo === 1 ? "flex flex-col gap-2" : "hidden"}>
          <span className={ROTULO}>Paciente</span>
          {paciente ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-900">
                  {paciente.nome}
                </p>
                <p className="text-xs text-zinc-500">Gestor SUS {paciente.gestor_sus}</p>
              </div>
              <button
                type="button"
                disabled={bloq}
                onClick={trocarPaciente}
                className="h-9 shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={bloq}
                onClick={() => setSeletorAberto((v) => !v)}
                aria-expanded={seletorAberto}
                aria-controls="seletor-paciente-retirada"
                className={BOTAO_SECUNDARIO}
              >
                Buscar paciente por nome ou Gestor SUS
              </button>

              {seletorAberto && (
                <div
                  id="seletor-paciente-retirada"
                  className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="busca-paciente-retirada" className="sr-only">
                      Buscar paciente
                    </label>
                    <input
                      id="busca-paciente-retirada"
                      type="search"
                      value={buscaPaciente}
                      onChange={(e) => setBuscaPaciente(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          buscarPacientes();
                        }
                      }}
                      placeholder="Nome ou Gestor SUS"
                      className={`${INPUT} sm:w-auto sm:flex-1`}
                    />
                    <button
                      type="button"
                      disabled={buscando}
                      onClick={buscarPacientes}
                      className={BOTAO_SECUNDARIO}
                    >
                      {buscando ? "Buscando..." : "Buscar"}
                    </button>
                  </div>

                  {erroBusca && <FeedbackErro>{erroBusca}</FeedbackErro>}

                  {resultados !== null && resultados.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      Nenhum paciente encontrado para esta busca.
                    </p>
                  )}

                  {resultados !== null && resultados.length > 0 && (
                    <ul className="flex max-h-56 flex-col divide-y divide-zinc-200 overflow-y-auto rounded-md border border-zinc-200 bg-white">
                      {resultados.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setPaciente({
                                id: p.id,
                                gestor_sus: p.gestor_sus,
                                nome: p.nome,
                              });
                              setResultados(null);
                              setSeletorAberto(false);
                              limparErro("paciente");
                            }}
                            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                          >
                            <span className="text-sm font-medium text-brand-900">
                              {p.nome}
                            </span>
                            <span className="text-xs text-zinc-500">
                              Gestor SUS {p.gestor_sus}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          {erroDe("paciente") && (
            <p id="erro-paciente" className="text-sm text-red-600">
              {erroDe("paciente")}
            </p>
          )}
        </div>

        {/* Passo 2 — Liberação */}
        <div className={passo === 2 ? "flex flex-col gap-2" : "hidden"}>
          <span className={ROTULO}>Liberação para retirada</span>

          {liberacoesCarregando ? (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              Carregando liberações do paciente...
            </p>
          ) : erroLiberacoes ? (
            <FeedbackErro>{erroLiberacoes}</FeedbackErro>
          ) : liberacoes.length === 0 ? (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              Nenhuma liberação {paciente ? "disponível para este paciente" : "carregada"}.
            </p>
          ) : (
            <fieldset>
              <legend className="sr-only">Liberação para retirada</legend>
              <ul className="flex flex-col gap-2">
                {liberacoes.map((lib) => {
                  const disp = disponiveis[lib.id] ?? 0;
                  const esgotada = disp <= 0;
                  const selecionada = liberacaoSelecionada?.id === lib.id;
                  return (
                    <li key={lib.id}>
                      <label
                        className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors ${
                          esgotada
                            ? "border-zinc-200 bg-zinc-50 opacity-60"
                            : selecionada
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="liberacao"
                          value={lib.id}
                          checked={selecionada}
                          disabled={esgotada || bloq}
                          onChange={() => selecionarLiberacao(lib, disp)}
                          className="sr-only"
                        />
                        <span className="font-medium">
                          {ROTULO_TIPO_LIBERACAO[lib.tipo]} · {lib.quantidade}{" "}
                          {lib.quantidade === 1 ? "vale" : "vales"} · {periodoTexto(lib)}
                        </span>
                        <span
                          className={
                            selecionada && !esgotada
                              ? "text-zinc-300"
                              : "text-xs text-zinc-500"
                          }
                        >
                          Disponível: {disp}{" "}
                          {esgotada && (
                            <span
                              className={
                                selecionada
                                  ? "text-zinc-300"
                                  : "font-medium text-red-600"
                              }
                            >
                              — saldo esgotado
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
          {erroDe("liberacao") && (
            <p id="erro-liberacao" className="text-sm text-red-600">
              {erroDe("liberacao")}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            O saldo considera as retiradas já registradas. O valor final é
            confirmado no banco no momento do registro.
          </p>
        </div>

        {/* Passo 3 — Quantidade */}
        <div className={passo === 3 ? "flex flex-col gap-2" : "hidden"}>
          {liberacaoSelecionada ? (
            <>
              <dl className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Liberação</dt>
                  <dd className="font-medium text-brand-900">
                    {ROTULO_TIPO_LIBERACAO[liberacaoSelecionada.tipo]} ·{" "}
                    {liberacaoSelecionada.quantidade} ·{" "}
                    {periodoTexto(liberacaoSelecionada)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Saldo disponível</dt>
                  <dd className="font-medium text-brand-900">{dispSelecionada}</dd>
                </div>
              </dl>

              <label htmlFor="quantidade" className={ROTULO}>
                Quantidade a retirar
              </label>
              <select
                id="quantidade"
                name="quantidade"
                value={quantidade != null ? String(quantidade) : ""}
                disabled={bloq}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  setQuantidade(Number.isInteger(q) && q > 0 ? q : null);
                  limparErro("quantidade");
                }}
                aria-invalid={Boolean(erroDe("quantidade"))}
                aria-describedby={erroDe("quantidade") ? "erro-quantidade" : "ajuda-quantidade"}
                className={INPUT}
              >
                {opcoesQuantidade.map((q) => (
                  <option key={q} value={String(q)}>
                    {q}
                  </option>
                ))}
              </select>
              <p id="ajuda-quantidade" className="text-xs text-zinc-500">
                Máximo disponível: {dispSelecionada} {dispSelecionada === 1 ? "vale" : "vales"}.
              </p>
              {erroDe("quantidade") && (
                <p id="erro-quantidade" className="text-sm text-red-600">
                  {erroDe("quantidade")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              Selecione primeiro a liberação na etapa anterior.
            </p>
          )}
        </div>

        {/* Passo 4 — Revisão */}
        <div className={passo === 4 ? "flex flex-col gap-2" : "hidden"}>
          <dl className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Paciente</dt>
              <dd className="font-medium text-brand-900">{paciente?.nome ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Gestor SUS</dt>
              <dd className="font-medium text-brand-900">{paciente?.gestor_sus ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Liberação</dt>
              <dd className="font-medium text-brand-900">
                {liberacaoSelecionada
                  ? `${ROTULO_TIPO_LIBERACAO[liberacaoSelecionada.tipo]} · ${periodoTexto(liberacaoSelecionada)}`
                  : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Saldo disponível</dt>
              <dd className="font-medium text-brand-900">{dispSelecionada}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Quantidade a retirar</dt>
              <dd className="font-medium text-brand-900">{quantidade ?? "—"}</dd>
            </div>
          </dl>
          <p className="text-xs text-zinc-500">
            O registro fica vinculado a você e à data/hora atuais (o sistema
            registra automaticamente).
          </p>
        </div>

        {state.error && (
          <FeedbackErro>{mensagemRetirada(state.error)}</FeedbackErro>
        )}
        {state.sucesso && (
          <FeedbackSucesso>Retirada registrada com sucesso.</FeedbackSucesso>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={BOTAO_SECUNDARIO}
          >
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            {passo > 1 && !state.sucesso && (
              <button
                type="button"
                onClick={voltar}
                disabled={pending}
                className={BOTAO_SECUNDARIO}
              >
                Voltar
              </button>
            )}
            {state.sucesso ? (
              <button
                type="button"
                onClick={onSalvo}
                className={BOTAO_PRIMARIO}
              >
                Concluir
              </button>
            ) : passo < PASSOS.length ? (
              <button
                type="button"
                onClick={avancar}
                disabled={pending || (passo === 2 && liberacoesCarregando)}
                className={BOTAO_PRIMARIO}
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending}
                className={BOTAO_PRIMARIO}
              >
                {pending ? "Salvando..." : "Registrar retirada"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}