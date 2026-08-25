"use client";

import { useActionState, useState } from "react";
import { criarLiberacaoAction } from "@/app/actions/liberacoes";
import { listarPacientesAction } from "@/app/actions/pacientes";
import {
  ORIGENS_PACIENTE,
  PERIODOS_LIBERACAO,
  ROTULO_TIPO_LIBERACAO,
  TIPOS_LIBERACAO,
  type PeriodoLiberacao,
  type QuantidadeLiberacao,
  type TipoLiberacao,
} from "@/lib/domain/enums";
import { isPeriodoValido, isQuantidadeValida } from "@/lib/domain/regras";
import { calcularPrevisaoVales } from "@/lib/domain/liberacoes/previsao";
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
import { mensagemUsuario } from "@/components/ui/mensagens";

type LiberacaoFormProps =
  | { modo: "criar"; onClose: () => void; onSalvo: () => void }
  | {
      modo: "renovar";
      origem: LiberacaoComPaciente;
      onClose: () => void;
      onSalvo: () => void;
    };

type FormState = {
  error?: string;
  erroCampos?: Partial<Record<"paciente" | "tipo" | "quantidade" | "periodo", string>>;
  sucesso?: boolean;
};

type CampoLiberacao = keyof NonNullable<FormState["erroCampos"]>;
type ErroCampo = { campo: CampoLiberacao; mensagem: string };

// Fluxo em etapas da nova liberação (Sprint 19): o usuário avança passo a passo
// de Paciente → Tipo e quantidade → Período → Revisão antes de criar.
const PASSOS: { id: number; rotulo: string }[] = [
  { id: 1, rotulo: "Paciente" },
  { id: 2, rotulo: "Tipo e quantidade" },
  { id: 3, rotulo: "Período" },
  { id: 4, rotulo: "Revisão" },
];

function selecionarQuantidade(valor: string): QuantidadeLiberacao | null {
  const n = Number(valor);
  return isQuantidadeValida(n) ? n : null;
}

function selecionarPeriodo(valor: string): PeriodoLiberacao | null {
  const n = Number(valor);
  return isPeriodoValido(n) ? n : null;
}

function selecionarTipo(valor: string): TipoLiberacao | null {
  return valor === TIPOS_LIBERACAO.CONTINUA || valor === TIPOS_LIBERACAO.AVULSA
    ? valor
    : null;
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

export default function LiberacaoForm(props: LiberacaoFormProps) {
  const isRenovacao = props.modo === "renovar";
  const origem = isRenovacao ? props.origem : null;

  // Paciente selecionado (somente no modo criar). Guarda o registro completo de
  // v_pacientes para conhecer a ORIGEM e aplicar RN29 na UI.
  const [paciente, setPaciente] = useState<PacienteSemCpf | null>(null);
  const [tipo, setTipo] = useState<TipoLiberacao>(
    (origem?.tipo as TipoLiberacao | undefined) ?? TIPOS_LIBERACAO.CONTINUA
  );
  const [quantidadeManual, setQuantidadeManual] = useState<number | null>(null);
  const [periodoMeses, setPeriodoMeses] = useState<PeriodoLiberacao>(
    origem?.periodo_meses ?? 3
  );
  // Sprint 42.1 — Calculadora de previsão (somente interface): parâmetros
  // auxiliares NUNCA são persistidos; apenas derivam a quantidade prevista.
  const [calcParams, setCalcParams] = useState({ valesPorDia: 0, diasPorSemana: 0 });
  const calculadoraVisivel = tipo === TIPOS_LIBERACAO.CONTINUA;
  const previsao = calculadoraVisivel
    ? calcularPrevisaoVales(calcParams.valesPorDia, calcParams.diasPorSemana, periodoMeses)
    : null;
  const quantidade =
    quantidadeManual ??
    (previsao && previsao.previsaoTotal > 0
      ? previsao.previsaoTotal
      : (origem?.quantidade ?? 1));

  const [passo, setPasso] = useState(1);
  const [errosPasso, setErrosPasso] = useState<ErroCampo[]>([]);

  // Seletor de paciente (somente no modo criar) — pesquisa por nome/Gestor SUS
  // via server action (v_pacientes, sem CPF). Nunca carrega a lista completa.
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
      const erros: ErroCampo[] = [];
      if (tipo !== TIPOS_LIBERACAO.CONTINUA && tipo !== TIPOS_LIBERACAO.AVULSA) {
        erros.push({ campo: "tipo", mensagem: "Selecione o tipo de liberação." });
      }
      // RN29 — paciente esporádico somente liberação avulsa (o banco também
      // bloqueia via trigger fn_liberacoes_before).
      if (
        paciente?.origem === ORIGENS_PACIENTE.ESPORADICO &&
        tipo !== TIPOS_LIBERACAO.AVULSA
      ) {
        erros.push({
          campo: "tipo",
          mensagem:
            "Paciente esporádico somente recebe liberação avulsa (RN29).",
        });
      }
      if (!isQuantidadeValida(quantidade)) {
        erros.push({
          campo: "quantidade",
          mensagem: "Quantidade prevista deve ser um inteiro entre 1 e 999.",
        });
      }
      return erros;
    }
    if (p === 3) {
      return tipo === TIPOS_LIBERACAO.CONTINUA && !isPeriodoValido(periodoMeses)
        ? [
            {
              campo: "periodo",
              mensagem: "Liberação contínua exige período de 1, 3 ou 6 meses.",
            },
          ]
        : [];
    }
    return [];
  }

  function avancar() {
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

  function limparErro(campo: CampoLiberacao) {
    setErrosPasso((atual) => atual.filter((e) => e.campo !== campo));
  }

  function erroDe(campo: CampoLiberacao): string | undefined {
    const local = errosPasso.find((e) => e.campo === campo)?.mensagem;
    return local ?? state.erroCampos?.[campo];
  }

  const executar = async (
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> => {
    // Renovação: o cliente envia SOMENTE renovacaoDeId. O servidor localiza a
    // liberação original e preserva o profissional autorizador original e os
    // parâmetros (paciente/tipo/quantidade/período) — o cliente nunca informa
    // profissional_autorizador_id.
    if (isRenovacao && origem) {
      const resultado = await criarLiberacaoAction({ renovacaoDeId: origem.id });
      return resultado.ok ? { sucesso: true } : { error: resultado.error };
    }

    const erros: ErroCampo[] = [];

    if (!paciente) {
      erros.push({ campo: "paciente", mensagem: "Selecione o paciente." });
    }

    const tipoSel = selecionarTipo(String(formData.get("tipo") ?? ""));
    if (!tipoSel) {
      erros.push({ campo: "tipo", mensagem: "Selecione o tipo de liberação." });
    }
    // RN29 — espelho local da regra do banco.
    if (
      tipoSel &&
      paciente?.origem === ORIGENS_PACIENTE.ESPORADICO &&
      tipoSel !== TIPOS_LIBERACAO.AVULSA
    ) {
      erros.push({
        campo: "tipo",
        mensagem:
          "Paciente esporádico somente recebe liberação avulsa (RN29).",
      });
    }

    const qtdSel = selecionarQuantidade(String(formData.get("quantidade") ?? ""));
    if (!qtdSel) {
      erros.push({
        campo: "quantidade",
        mensagem: "Quantidade prevista deve ser um inteiro entre 1 e 999.",
      });
    }

    const periodoSel = selecionarPeriodo(String(formData.get("periodo") ?? ""));
    if (tipoSel === TIPOS_LIBERACAO.CONTINUA && !periodoSel) {
      erros.push({
        campo: "periodo",
        mensagem: "Liberação contínua exige período de 1, 3 ou 6 meses.",
      });
    }

    if (erros.length > 0) {
      const erroCampos: FormState["erroCampos"] = {};
      for (const e of erros) erroCampos[e.campo] = e.mensagem;
      return { erroCampos };
    }

    if (!paciente || !tipoSel || !qtdSel) return { error: "Dados inválidos." };

    const dados: Parameters<typeof criarLiberacaoAction>[0] = {
      pacienteId: paciente.id,
      tipo: tipoSel,
      quantidade: qtdSel,
      periodoMeses: tipoSel === TIPOS_LIBERACAO.CONTINUA ? periodoSel : null,
    };

    const resultado = await criarLiberacaoAction(dados);
    return resultado.ok ? { sucesso: true } : { error: resultado.error };
  };

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    executar,
    {}
  );

  const bloq = pending || state.sucesso;
  const origemPaciente = origem?.paciente?.nome ?? "";
  const ref = useModalA11y(props.onClose, !bloq);

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

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 outline-none sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isRenovacao ? "Renovar liberação" : "Nova liberação"}
    >
      <form
        action={formAction}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-lg bg-white p-6 sm:rounded-lg"
      >
        <div>
          <h2 className="text-lg font-semibold text-brand-900">
            {isRenovacao ? "Renovar liberação" : "Nova liberação"}
          </h2>
          <p className="text-sm text-zinc-500">
            {isRenovacao
              ? `Renovação de ${origemPaciente} — mantém o profissional autorizador original.`
              : "Registro de liberação de vale-transporte no CAPS."}
          </p>
          {isRenovacao && (
            <span className="mt-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              Renovação
            </span>
          )}
        </div>

        {isRenovacao ? (
          <div className="flex flex-col gap-2">
            <dl className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Paciente</dt>
                <dd className="font-medium text-brand-900">{origemPaciente || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Tipo</dt>
                <dd className="font-medium text-brand-900">
                  {origem ? ROTULO_TIPO_LIBERACAO[origem.tipo] : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Quantidade</dt>
                <dd className="font-medium text-brand-900">{origem?.quantidade ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Período</dt>
                <dd className="font-medium text-brand-900">
                  {origem?.tipo === TIPOS_LIBERACAO.CONTINUA
                    ? `${origem.periodo_meses ?? "—"} ${origem.periodo_meses === 1 ? "mês" : "meses"}`
                    : "Avulsa (1 dia)"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Vigência</dt>
                <dd className="font-medium text-brand-900">
                  {formatarData(origem?.data_inicio)} – {formatarData(origem?.data_fim)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-zinc-500">
              A renovação mantém o profissional autorizador original.
            </p>
          </div>
        ) : (
          <>
            <div
              aria-label="Progresso da nova liberação"
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
                        className={
                          atual ? "font-medium text-brand-900" : "text-zinc-500"
                        }
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
                    onClick={() => {
                      setPaciente(null);
                      setResultados(null);
                      setSeletorAberto(true);
                      limparErro("paciente");
                    }}
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
                    aria-controls="seletor-paciente"
                    className={BOTAO_SECUNDARIO}
                  >
                    Buscar paciente por nome ou Gestor SUS
                  </button>

                  {seletorAberto && (
                    <div
                      id="seletor-paciente"
                      className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <label htmlFor="busca-paciente" className="sr-only">
                          Buscar paciente
                        </label>
                        <input
                          id="busca-paciente"
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
                                  setPaciente(p);
                                  setResultados(null);
                                  setSeletorAberto(false);
                                  limparErro("paciente");
                                  // RN29 — paciente esporádico só pode avulsa:
                                  // força o tipo e limpa erro de período.
                                  if (
                                    p.origem === ORIGENS_PACIENTE.ESPORADICO &&
                                    tipo !== TIPOS_LIBERACAO.AVULSA
                                  ) {
                                    setTipo(TIPOS_LIBERACAO.AVULSA);
                                    limparErro("periodo");
                                  }
                                }}
                                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                              >
                                <span className="text-sm font-medium text-brand-900">
                                  {p.nome}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  Gestor SUS {p.gestor_sus}
                                  {p.origem === ORIGENS_PACIENTE.ESPORADICO &&
                                    " · Esporádico (somente avulsa)"}
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

            {/* Passo 2 — Tipo e quantidade */}
            <div className={passo === 2 ? "flex flex-col gap-2" : "hidden"}>
              <fieldset>
                <legend className={ROTULO}>Tipo de liberação</legend>
                {paciente?.origem === ORIGENS_PACIENTE.ESPORADICO && (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Paciente esporádico: somente liberação avulsa (RN29).
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  {Object.values(TIPOS_LIBERACAO).map((valor) => {
                    const bloqueado =
                      paciente?.origem === ORIGENS_PACIENTE.ESPORADICO &&
                      valor !== TIPOS_LIBERACAO.AVULSA;
                    return (
                    <label
                      key={valor}
                      className={`flex h-11 flex-1 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                        tipo === valor
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                      } ${bloqueado ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                    >
                      <input
                        type="radio"
                        name="tipo"
                        value={valor}
                        checked={tipo === valor}
                        disabled={bloq || bloqueado}
                        onChange={() => {
                          setTipo(valor);
                          limparErro("tipo");
                        }}
                        className="sr-only"
                      />
                      {ROTULO_TIPO_LIBERACAO[valor]}
                    </label>
                    );
                  })}
                </div>
                {erroDe("tipo") && (
                  <p id="erro-tipo" className="mt-1 text-sm text-red-600">
                    {erroDe("tipo")}
                  </p>
                )}
              </fieldset>

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
                  value={String(quantidade)}
                  disabled={bloq}
                  onChange={(e) => {
                    const q = Number(e.target.value);
                    if (Number.isInteger(q) && q > 0) {
                      setQuantidadeManual(q);
                      limparErro("quantidade");
                    }
                  }}
                  aria-invalid={Boolean(erroDe("quantidade"))}
                  aria-describedby={
                    erroDe("quantidade") ? "erro-quantidade" : "ajuda-quantidade"
                  }
                  className={INPUT}
                />
                <p id="ajuda-quantidade" className="text-xs text-zinc-500">
                  É uma PREVISÃO (RN31) — não limita retiradas durante a vigência.
                </p>
                {erroDe("quantidade") && (
                  <p id="erro-quantidade" className="text-sm text-red-600">
                    {erroDe("quantidade")}
                  </p>
                )}
              </div>

              {/* Sprint 42.1 — Calculadora de previsão (auxiliar de interface). */}
              {calculadoraVisivel && previsao && (
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
                      <dd className="font-medium text-brand-900">{periodoMeses} mês(es)</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Previsão total</dt>
                      <dd className="font-semibold text-brand-900">{previsao.previsaoTotal}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-zinc-500">
                    Preenche automaticamente a quantidade prevista (editável).
                    Não persistimos vales/dia nem dias/semana.
                  </p>
                </fieldset>
              )}
            </div>

            {/* Passo 3 — Período */}
            <div className={passo === 3 ? "flex flex-col gap-2" : "hidden"}>
              {tipo === TIPOS_LIBERACAO.CONTINUA ? (
                <>
                  <label htmlFor="periodo" className={ROTULO}>
                    Período da liberação
                  </label>
                  <select
                    id="periodo"
                    name="periodo"
                    value={String(periodoMeses)}
                    disabled={bloq}
                    onChange={(e) => {
                      const p = selecionarPeriodo(e.target.value);
                      if (p) {
                        setPeriodoMeses(p);
                        limparErro("periodo");
                      }
                    }}
                    aria-invalid={Boolean(erroDe("periodo"))}
                    aria-describedby={
                      erroDe("periodo") ? "erro-periodo" : undefined
                    }
                    className={INPUT}
                  >
                    {PERIODOS_LIBERACAO.map((p) => (
                      <option key={p} value={String(p)}>
                        {p} {p === 1 ? "mês" : "meses"}
                      </option>
                    ))}
                  </select>
                  {erroDe("periodo") && (
                    <p id="erro-periodo" className="text-sm text-red-600">
                      {erroDe("periodo")}
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                  Liberação avulsa vale por 1 dia (RN21).
                </div>
              )}
            </div>

            {/* Passo 4 — Revisão */}
            <div className={passo === 4 ? "flex flex-col gap-2" : "hidden"}>
              <dl className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Paciente</dt>
                  <dd className="font-medium text-brand-900">
                    {paciente?.nome ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Gestor SUS</dt>
                  <dd className="font-medium text-brand-900">
                    {paciente?.gestor_sus ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Tipo</dt>
                  <dd className="font-medium text-brand-900">
                    {ROTULO_TIPO_LIBERACAO[tipo]}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Quantidade</dt>
                  <dd className="font-medium text-brand-900">{quantidade}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Período</dt>
                  <dd className="font-medium text-brand-900">
                    {tipo === TIPOS_LIBERACAO.CONTINUA
                      ? `${periodoMeses} ${periodoMeses === 1 ? "mês" : "meses"}`
                      : "Avulsa (1 dia)"}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-zinc-500">
                Confira os dados antes de criar a liberação.
              </p>
            </div>
          </>
        )}

        {state.error && (
          <FeedbackErro>{mensagemUsuario(state.error)}</FeedbackErro>
        )}
        {state.sucesso && (
          <FeedbackSucesso>
            Liberação {isRenovacao ? "renovada" : "criada"} com sucesso.
          </FeedbackSucesso>
        )}

        {isRenovacao ? (
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
                {pending ? "Salvando..." : "Renovar"}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={props.onClose}
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
                  onClick={props.onSalvo}
                  className={BOTAO_PRIMARIO}
                >
                  Concluir
                </button>
              ) : passo < PASSOS.length ? (
                <button
                  type="button"
                  onClick={avancar}
                  disabled={pending}
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
                  {pending ? "Salvando..." : "Criar liberação"}
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
