"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useActionState, useEffect, useRef, useState } from "react";
import { listarLiberacoesAction } from "@/app/actions/liberacoes";
import { listarPacientesAction } from "@/app/actions/pacientes";
import {
  listarRetiradasAction,
  registrarRetiradaAction,
} from "@/app/actions/retiradas";
import { ORIGENS_PACIENTE, ROTULO_TIPO_LIBERACAO } from "@/lib/domain/enums";
import type { PacienteResumo } from "@/lib/domain/retiradas/types";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";
import { criarPacienteAction } from "@/app/actions/pacientes";
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
// Paciente —  Liberação (com saldo disponível calculado) —  Quantidade —  Revisão.
const PASSOS: { id: number; rotulo: string }[] = [
  { id: 1, rotulo: "Paciente" },
  { id: 2, rotulo: "Liberação" },
  { id: 3, rotulo: "Quantidade" },
  { id: 4, rotulo: "Revisão" },
];

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function periodoTexto(lib: LiberacaoComPaciente): string {
  return `${formatarData(lib.data_inicio)}  ${formatarData(lib.data_fim)}`;
}

export default function RetiradaForm({ onClose, onSalvo }: RetiradaFormProps) {
  const [paciente, setPaciente] = useState<PacienteResumo | null>(null);
  const [pacienteOrigem, setPacienteOrigem] = useState<string | null>(null);
  const [passo, setPasso] = useState(1);
  const [errosPasso, setErrosPasso] = useState<ErroCampo[]>([]);

  // Liberações do paciente (ativas para a recepção via RLS) + previsto/retirado
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

  // Sprint 48 — busca inteligente com autocomplete, debounce e foco automático.
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [resultados, setResultados] = useState<PacienteSemCpf[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const [novoSUS, setNovoSUS] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [criandoPaciente, setCriandoPaciente] = useState(false);
  const [erroCriarPaciente, setErroCriarPaciente] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastBuscaIdRef = useRef(0);

  // Foco automático ao abrir (passo 1, sem paciente)
  useEffect(() => {
    if (passo === 1 && !paciente) {
      // timeout para garantir que o modal já está no DOM (useModalA11y)
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [passo, paciente]);

  // Debounce 350ms + race handling + mínimo 2 caracteres
  useEffect(() => {
    const termo = buscaPaciente.trim();
    if (termo.length < 2) {
      setResultados(null);
      setMostrarResultados(false);
      setBuscando(false);
      setErroBusca(null);
      return;
    }
    const myId = ++lastBuscaIdRef.current;
    setBuscando(true);
    setErroBusca(null);
    const timer = setTimeout(() => {
      listarPacientesAction(termo).then((res) => {
        if (myId !== lastBuscaIdRef.current) return; // stale
        setBuscando(false);
        if (!res.ok) {
          setErroBusca((res as { error: string }).error);
          setResultados(null);
          setMostrarResultados(true);
          return;
        }
        setResultados((res as { data: PacienteSemCpf[] }).data);
        setMostrarResultados(true);
        setIndiceAtivo(-1);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [buscaPaciente]);

  // Validação local de cada etapa (mesmas regras do servidor)  impede avançar
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
      // Sprint 42: a previsão não limita a retirada — qualquer liberação
      // ativa e vigente é selecionável.
      return [];
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
  // retiradas (para somar o que já foi retirado). O acumulado é exibido
  // como orientação — a autoridade final é o trigger no banco.
  // Sprint 66 — prioriza contínua ativa e pré-preenche retirada com vales_por_dia
  async function carregarLiberacoes(p: PacienteResumo) {
    setLiberacoesCarregando(true);
    setErroLiberacoes(null);

    const [resultadoLib, resultadoRet] = await Promise.all([
      listarLiberacoesAction(p.gestor_sus),
      listarRetiradasAction(),
    ]);

    setLiberacoesCarregando(false);

    if (!resultadoLib || !resultadoLib.ok) {
      setErroLiberacoes(resultadoLib?.error ?? "Erro ao carregar liberações.");
      return;
    }
    if (!resultadoRet || !resultadoRet.ok) {
      setErroLiberacoes(resultadoRet?.error ?? "Erro ao carregar retiradas.");
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

    // Sprint 66 — fluxo principal contínua: pré-seleciona a contínua mais recente e preenche quantidade diária
    const continuaAtiva = (resultadoLib.data as unknown as Array<{ tipo: string; status: string; data_inicio: string; vales_por_dia?: number | null }>)
      .filter((l) => l.tipo === "continua" && l.status === "ativa")
      .sort((a, b) => (a.data_inicio < b.data_inicio ? 1 : -1))[0] as unknown as LiberacaoComPaciente | undefined;
    if (continuaAtiva) {
      setLiberacaoSelecionada(continuaAtiva as LiberacaoComPaciente);
      const diaria = (continuaAtiva as unknown as { vales_por_dia?: number | null }).vales_por_dia;
      setQuantidade(diaria && diaria >= 1 && diaria <= 10 ? diaria : 2);
      limparErro("liberacao");
    } else {
      // Sem contínua: limpa seleção e prepara avulsa com 2
      setLiberacaoSelecionada(null);
      setQuantidade(2);
    }
  }

  function selecionarLiberacao(lib: LiberacaoComPaciente, disp: number) {
    setLiberacaoSelecionada(lib);
    // Sprint 66 — quantidade inicial é diária da contínua ou 2 para avulsa
    const diaria = (lib as unknown as { vales_por_dia?: number | null }).vales_por_dia;
    if (lib.tipo === "continua") {
      setQuantidade(diaria && diaria >= 1 && diaria <= 10 ? diaria : 2);
    } else {
      setQuantidade(2);
    }
    // Fallback: se disp for 0 e diária não existir, mantém 2 (não 1) para avulsa
    if (diaria == null && lib.tipo === "avulsa" && disp <= 0) {
      setQuantidade(2);
    }
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
    }
    // Sprint 42: a quantidade da liberação é PREVISÃO  não há teto client-side.
    // O banco valida janela de vigência, status e RN24 no momento do registro.

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
  const ref = useModalA11y(onClose, !bloq);

  function selecionarPacienteCompleto(p: PacienteSemCpf) {
    setPaciente({ id: p.id, gestor_sus: p.gestor_sus, nome: p.nome });
    setPacienteOrigem((p as unknown as { origem?: string })?.origem ?? null);
    setResultados(null);
    setMostrarResultados(false);
    setBuscaPaciente("");
    limparErro("paciente");
    setErrosPasso([]);
    // Não avança automaticamente — usuário clica Continuar (preserva testes e acessibilidade)
    // O carregamento de liberações ocorrerá no avancar() do passo 1
  }

  function trocarPaciente() {
    setPaciente(null);
    setPacienteOrigem(null);
    setResultados(null);
    setMostrarResultados(false);
    setBuscaPaciente("");
    setLiberacoes([]);
    setDisponiveis({});
    setLiberacaoSelecionada(null);
    setQuantidade(null);
    setConsultadoPacienteId(null);
    setErroLiberacoes(null);
    limparErro("paciente");
    setPasso(1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function criarPacienteEsporadicoRetirada() {
    if (!novoSUS.trim() || !novoNome.trim()) {
      setErroCriarPaciente("Informe Gestor SUS e nome.");
      return;
    }
    setCriandoPaciente(true);
    setErroCriarPaciente(null);
    const r = await criarPacienteAction({ gestor_sus: novoSUS.trim(), nome: novoNome.trim(), origem: ORIGENS_PACIENTE.ESPORADICO });
    setCriandoPaciente(false);
    if (!r.ok) {
      setErroCriarPaciente(r.error);
      return;
    }
    selecionarPacienteCompleto(r.data as unknown as PacienteSemCpf);
    setNovoSUS("");
    setNovoNome("");
  }


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
                    {concluido ? "S" : p.id}
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

        {/* Passo 1  Paciente */}
        <div className={passo === 1 ? "flex flex-col gap-2" : "hidden"}>
          <span className={ROTULO}>Paciente</span>
          {paciente ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-900">
                  {paciente.nome}
                </p>
                <p className="text-xs text-zinc-500">
                  Gestor SUS {paciente.gestor_sus} · {pacienteOrigem === ORIGENS_PACIENTE.ESPORADICO ? "Esporádico" : "Regular"}
                </p>
              </div>
              <button
                type="button"
                disabled={bloq}
                onClick={trocarPaciente}
                className="h-9 shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
              >
                Alterar paciente
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="busca-paciente-retirada" className={ROTULO}>
                Buscar paciente
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="busca-paciente-retirada"
                  type="search"
                  role="combobox"
                  aria-label="Buscar paciente"
                  aria-expanded={mostrarResultados}
                  aria-controls="lista-pacientes"
                  aria-activedescendant={indiceAtivo >= 0 && resultados?.[indiceAtivo] ? `paciente-${resultados![indiceAtivo].id}` : undefined}
                  aria-autocomplete="list"
                  value={buscaPaciente}
                  onChange={(e) => setBuscaPaciente(e.target.value)}
                  onFocus={() => {
                    if (buscaPaciente.trim().length >= 2 && resultados && resultados.length > 0) setMostrarResultados(true);
                  }}
                  onBlur={() => setTimeout(() => setMostrarResultados(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setIndiceAtivo((i) => Math.min((resultados?.length ?? 1) - 1, i + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setIndiceAtivo((i) => Math.max(-1, i - 1));
                    } else if (e.key === "Enter") {
                      if (indiceAtivo >= 0 && resultados?.[indiceAtivo]) {
                        e.preventDefault();
                        selecionarPacienteCompleto(resultados[indiceAtivo]);
                      }
                    } else if (e.key === "Escape") {
                      setMostrarResultados(false);
                      setIndiceAtivo(-1);
                    }
                  }}
                  placeholder="🔎 Nome ou Gestor SUS..."
                  className={INPUT}
                  autoComplete="off"
                  autoFocus
                  disabled={bloq}
                />
                {buscando && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">Buscando...</span>}
                {mostrarResultados && (
                  <ul
                    id="lista-pacientes"
                    role="listbox"
                    className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-zinc-200 bg-white shadow-lg"
                  >
                    {buscando ? (
                      <li className="px-4 py-3 text-sm text-zinc-500">Buscando...</li>
                    ) : erroBusca ? (
                      <li className="px-4 py-3">
                        <FeedbackErro>{erroBusca}</FeedbackErro>
                        <button type="button" onClick={() => setBuscaPaciente((v) => v + " ")} className={`${BOTAO_SECUNDARIO} mt-2`}>
                          Tentar novamente
                        </button>
                      </li>
                    ) : resultados && resultados.length === 0 ? (
                      <li className="px-4 py-3">
                        <p className="text-sm font-medium text-zinc-700">Nenhum paciente encontrado</p>
                        <p className="text-xs text-zinc-500">Verifique o nome ou Gestor SUS, ou cadastre como esporádico.</p>
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-semibold text-amber-900">Cadastrar paciente esporádico</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input value={novoSUS} onChange={(e) => setNovoSUS(e.target.value.toUpperCase())} placeholder="Gestor SUS" className={`${INPUT} uppercase`} />
                            <input value={novoNome} onChange={(e) => setNovoNome(e.target.value.toUpperCase())} placeholder="Nome completo" className={`${INPUT} uppercase`} />
                          </div>
                          {erroCriarPaciente && <p className="mt-2 text-xs text-red-600">{erroCriarPaciente}</p>}
                          <button type="button" disabled={criandoPaciente} onClick={criarPacienteEsporadicoRetirada} className={`${BOTAO_PRIMARIO} mt-2 w-full`}>
                            {criandoPaciente ? "Salvando..." : "Cadastrar paciente esporádico"}
                          </button>
                        </div>
                      </li>
                    ) : resultados && resultados.length > 0 ? (
                      resultados.map((p, idx) => {
                        const ativo = idx === indiceAtivo;
                        return (
                          <li key={p.id} id={`paciente-${p.id}`} role="option" aria-selected={ativo}>
                            <button
                              type="button"
                              onClick={() => selecionarPacienteCompleto(p)}
                              onMouseEnter={() => setIndiceAtivo(idx)}
                              className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left ${ativo ? "bg-brand-50" : "hover:bg-zinc-50"}`}
                            >
                              <span className="text-sm font-medium text-brand-900">{p.nome}</span>
                              <span className="text-xs text-zinc-500">
                                SUS: {p.gestor_sus} · {(p as unknown as { origem?: string }).origem === ORIGENS_PACIENTE.ESPORADICO ? "Esporádico" : "Regular"}
                              </span>
                            </button>
                          </li>
                        );
                      })
                    ) : (
                      <li className="px-4 py-3 text-sm text-zinc-500">Digite pelo menos 2 caracteres para buscar.</li>
                    )}
                  </ul>
                )}
              </div>
              <p className="text-xs text-zinc-500">Digite para localizar. Use nome ou Gestor SUS.</p>
              {resultados && resultados.length === 0 && !mostrarResultados && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">Nenhum paciente encontrado</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input value={novoSUS} onChange={(e) => setNovoSUS(e.target.value.toUpperCase())} placeholder="Gestor SUS" className={`${INPUT} uppercase`} />
                    <input value={novoNome} onChange={(e) => setNovoNome(e.target.value.toUpperCase())} placeholder="Nome completo" className={`${INPUT} uppercase`} />
                  </div>
                  {erroCriarPaciente && <p className="mt-2 text-xs text-red-600">{erroCriarPaciente}</p>}
                  <button type="button" disabled={criandoPaciente} onClick={criarPacienteEsporadicoRetirada} className={`${BOTAO_PRIMARIO} mt-2 w-full`}>
                    {criandoPaciente ? "Salvando..." : "Cadastrar paciente esporádico"}
                  </button>
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

        {/* Passo 2 — Liberação (fluxo principal contínua) */}
        <div className={passo === 2 ? "flex flex-col gap-2" : "hidden"}>
          <span className={ROTULO}>Liberação para retirada</span>
          <p className="text-xs text-zinc-500">Fluxo principal: liberação contínua ativa com quantidade diária pré-preenchida. Avulsa como alternativa.</p>

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
                {liberacoes
                  .slice()
                  .sort((a, b) => {
                    // Contínua ativa primeiro
                    const aCont = a.tipo === "continua" && a.status === "ativa" ? 0 : 1;
                    const bCont = b.tipo === "continua" && b.status === "ativa" ? 0 : 1;
                    if (aCont !== bCont) return aCont - bCont;
                    return a.data_inicio < b.data_inicio ? 1 : -1;
                  })
                  .map((lib) => {
                    const previsto = lib.quantidade;
                    const retirado = lib.quantidade - (disponiveis[lib.id] ?? 0);
                    const diaria = (lib as unknown as { vales_por_dia?: number | null }).vales_por_dia;
                    const selecionada = liberacaoSelecionada?.id === lib.id;
                    const isContinua = lib.tipo === "continua";
                    return (
                      <li key={lib.id}>
                        <label
                          className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors ${
                            selecionada
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="liberacao"
                            value={lib.id}
                            checked={selecionada}
                            disabled={bloq}
                            onChange={() => selecionarLiberacao(lib, previsto - retirado)}
                            className="sr-only"
                          />
                          <span className="font-medium">
                            {ROTULO_TIPO_LIBERACAO[lib.tipo]} · {periodoTexto(lib)}{" "}
                            {isContinua ? (
                              diaria ? (
                                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${selecionada ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"}`}>{diaria}/dia</span>
                              ) : (
                                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${selecionada ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700"}`}>Diária não informada</span>
                              )
                            ) : null}
                          </span>
                          <span className={selecionada ? "text-zinc-300" : "text-xs text-zinc-500"}>
                            Previsto: {previsto} · Retirado: {retirado}
                            {isContinua ? (diaria ? ` · Diária: ${diaria}` : ` · Diária: não informada`) : ""}
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
              {pacienteOrigem !== "esporadico" && liberacoes.some((l) => l.tipo === "continua" && l.status === "ativa") && (
                <p className="mt-2 text-xs text-zinc-500">
                  Precisa registrar uma retirada avulsa? Selecione uma liberação avulsa acima ou crie via Atendimento.
                </p>
              )}
            </fieldset>
          )}
          {erroDe("liberacao") && (
            <p id="erro-liberacao" className="text-sm text-red-600">
              {erroDe("liberacao")}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Previsto é a estimativa administrativa da liberação  não limita a
            retirada. A validade e o status são confirmados no banco no momento
            do registro.
          </p>
        </div>

        {/* Passo 3  Quantidade */}
        <div className={passo === 3 ? "flex flex-col gap-2" : "hidden"}>
          {liberacaoSelecionada ? (
            <>
              <dl className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Liberação</dt>
                  <dd className="font-medium text-brand-900">
                    {ROTULO_TIPO_LIBERACAO[liberacaoSelecionada.tipo]} ·{" "}
                    {periodoTexto(liberacaoSelecionada)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Previsto / Retirado</dt>
                  <dd className="font-medium text-brand-900">
                    {liberacaoSelecionada.quantidade} /{" "}
                    {liberacaoSelecionada.quantidade - (disponiveis[liberacaoSelecionada.id] ?? 0)}
                  </dd>
                </div>
              </dl>

              <label htmlFor="quantidade" className={ROTULO}>
                Quantidade a retirar
              </label>
              <input
                id="quantidade"
                name="quantidade"
                type="number"
                min={1}
                step={1}
                autoFocus
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
              />
              <p id="ajuda-quantidade" className="text-xs text-zinc-500">
                {(() => {
                  if (!liberacaoSelecionada) return "Previsão não limita a retirada.";
                  if (liberacaoSelecionada.tipo !== "continua") return "Padrão avulsa: 2 vales — editável. Previsão não limita.";
                  const diaria = (liberacaoSelecionada as unknown as { vales_por_dia?: number | null }).vales_por_dia;
                  if (diaria != null) return `Quantidade diária configurada: ${diaria} vales/dia — editável antes de registrar.`;
                  return "Quantidade diária não informada — sugestão operacional: 2 vales. Confirme antes de registrar.";
                })()}
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

        {/* Passo 4  Revisão */}
        <div className={passo === 4 ? "flex flex-col gap-2" : "hidden"}>
          <dl className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Paciente</dt>
              <dd className="font-medium text-brand-900">{paciente?.nome ?? ""}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Gestor SUS</dt>
              <dd className="font-medium text-brand-900">{paciente?.gestor_sus ?? ""}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Liberação</dt>
              <dd className="font-medium text-brand-900">
                {liberacaoSelecionada
                  ? `${ROTULO_TIPO_LIBERACAO[liberacaoSelecionada.tipo]} · ${periodoTexto(liberacaoSelecionada)}`
                  : ""}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Previsto / Retirado</dt>
              <dd className="font-medium text-brand-900">
                {liberacaoSelecionada
                  ? `${liberacaoSelecionada.quantidade} / ${liberacaoSelecionada.quantidade - (disponiveis[liberacaoSelecionada.id] ?? 0)}`
                  : ""}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500">Quantidade a retirar</dt>
              <dd className="font-medium text-brand-900">{quantidade ?? ""}</dd>
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