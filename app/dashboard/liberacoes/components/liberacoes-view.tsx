"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ORIGENS_PACIENTE, type PerfilUsuario } from "@/lib/domain/enums";
import { permissoesLiberacoes } from "@/lib/domain/regras";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";
import { listarLiberacoesAction } from "@/app/actions/liberacoes";
import {
  BOTAO_PRIMARIO,
  CARTAO,
  CONTAINER,
} from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro, FeedbackSucesso } from "@/components/ui/feedback";
import { PatientSearch } from "@/components/ui/patient-search";
import LiberacaoCard from "./liberacao-card";
import LiberacaoForm from "./liberacao-form";
import LiberacaoEditForm from "./liberacao-edit-form";

type FormAberto =
  | { modo: "criar"; pacienteInicial?: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null }
  | { modo: "renovar"; origem: LiberacaoComPaciente }
  | { modo: "editar"; liberacao: LiberacaoComPaciente }
  | null;

type LiberacoesViewProps = {
  perfil: PerfilUsuario;
  statusAtivo: boolean;
  busca: string;
  pacienteSelecionado?: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null;
  liberacoesIniciais: LiberacaoComPaciente[];
  erroInicial: string | null;
};

export default function LiberacoesView(props: LiberacoesViewProps) {
  const router = useRouter();
  const permissoes = permissoesLiberacoes(props.perfil, props.statusAtivo);
  const [formAberto, setFormAberto] = useState<FormAberto>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [selecionado, setSelecionado] = useState(props.pacienteSelecionado ?? null);
  // Sincroniza com props quando a navegação do servidor muda o paciente (ex: URL ?paciente=)
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelecionado(props.pacienteSelecionado ?? null);
  }, [props.pacienteSelecionado?.id, props.pacienteSelecionado?.gestor_sus]);

  const requestIdRef = useRef(0);
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string | null; continua: LiberacaoComPaciente | null }>({
    loading: false, error: null, continua: null,
  });
  const [retryTick, setRetryTick] = useState(0);

  const isClientSelection = !!selecionado && selecionado.id !== props.pacienteSelecionado?.id;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!selecionado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFetchState({ loading: false, error: null, continua: null });
      return;
    }
    if (!isClientSelection && retryTick === 0) {
      if (props.erroInicial) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFetchState({ loading: false, error: props.erroInicial, continua: null });
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFetchState({ loading: false, error: null, continua: null });
      }
      return;
    }
    const myId = ++requestIdRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetchState({ loading: true, error: null, continua: null });
    listarLiberacoesAction(undefined, selecionado.id)
      .then((r) => {
        if (myId !== requestIdRef.current) return;
        if (!r) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFetchState({ loading: false, error: null, continua: null });
          return;
        }
        if (!r.ok) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFetchState({ loading: false, error: r.error, continua: null });
        } else {
          const encontrada = r.data.find((l) => l.tipo === "continua" && l.status === "ativa") ?? null;
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFetchState({ loading: false, error: null, continua: encontrada });
        }
      })
      .catch(() => {
        if (myId !== requestIdRef.current) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFetchState({ loading: false, error: "Não foi possível verificar a situação.", continua: null });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isClientSelection e selecionado?.id já capturam mudanças relevantes; adicionar 'selecionado' causaria re-execução espúria
  }, [selecionado?.id, isClientSelection, retryTick, props.erroInicial]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const [searchQuery, setSearchQuery] = useState("");

  const vazio = props.liberacoesIniciais.length === 0;

  const continuaAtivaServer = selecionado ? props.liberacoesIniciais.find((l) => l.tipo === "continua" && l.status === "ativa") ?? null : null;
  const continuaAtiva = isClientSelection ? fetchState.continua : continuaAtivaServer;
  const temContinuaAtiva = !!continuaAtiva;
  const isEsporadico = selecionado?.origem === ORIGENS_PACIENTE.ESPORADICO;
  const loadingSituacao = isClientSelection ? fetchState.loading : false;

  const erroDaSituacao = isClientSelection
    ? fetchState.error
    : props.erroInicial;
  const temErroSituacao = !!erroDaSituacao;

  const descricao =
    props.perfil === "recepcionista"
      ? "Liberações ativas do vale-transporte — apenas as liberações vigentes."
      : "Liberações registradas no CAPS — busque por paciente ou Gestor SUS.";

  const canCreateContinua = permissoes.podeCriarContinua && selecionado && !loadingSituacao && !temErroSituacao && !isEsporadico && !temContinuaAtiva;

  let motivoDesabilitado: string | undefined;
  if (!selecionado) {
    motivoDesabilitado = "Pesquise e selecione um paciente para iniciar uma nova liberação.";
  } else if (loadingSituacao) {
    motivoDesabilitado = "Verificando situação do paciente...";
  } else if (temErroSituacao) {
    motivoDesabilitado = erroDaSituacao ?? "Erro ao verificar situação.";
  } else if (isEsporadico) {
    motivoDesabilitado = "Paciente esporádico não pode receber liberação contínua.";
  } else if (temContinuaAtiva) {
    motivoDesabilitado = "Este paciente já possui uma liberação contínua ativa.";
  }

  function handleSelect(p: PacienteSemCpf) {
    setSelecionado({ id: p.id, gestor_sus: p.gestor_sus, nome: p.nome, origem: (p as unknown as { origem?: string | null }).origem ?? null });
    setSearchQuery("");
    router.push(`/dashboard/liberacoes?paciente=${p.id}`);
  }

  function handleQueryChange(q: string) {
    setSearchQuery(q);
    if (selecionado) {
      requestIdRef.current++;
      setSelecionado(null);
      setFetchState({ loading: false, error: null, continua: null });
      if (props.pacienteSelecionado) {
        router.push("/dashboard/liberacoes");
      }
      return;
    }
    if (fetchState.continua || fetchState.error || fetchState.loading) {
      requestIdRef.current++;
      setFetchState({ loading: false, error: null, continua: null });
    }
    void q;
  }

  function handleClear() {
    requestIdRef.current++;
    setSelecionado(null);
    setFetchState({ loading: false, error: null, continua: null });
    setSearchQuery("");
    setFeedback(null);
    router.replace("/dashboard/liberacoes");
  }

  function handleRetry() {
    setRetryTick((n) => n + 1);
  }

  function handleEditar(lib: LiberacaoComPaciente) {
    setFormAberto({ modo: "editar", liberacao: lib });
  }

  function handleRenovar(lib: LiberacaoComPaciente) {
    setFormAberto({ modo: "renovar", origem: lib });
  }

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader titulo="Liberações" descricao={descricao} />

        <div className={`${CARTAO} p-5`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 min-w-0">
              <PatientSearch
                id="busca-liberacoes"
                label="Buscar por paciente ou Gestor SUS"
                placeholder="🔎 Nome ou Gestor SUS..."
                value={searchQuery}
                onValueChange={handleQueryChange}
                onSelect={handleSelect}
                onCreatePatient={(origem) => {
                  if (origem === "regular") {
                    router.push("/dashboard/pacientes?novo=regular");
                  } else {
                    router.push("/dashboard/atendimento");
                  }
                }}
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {(selecionado || searchQuery) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 ring-1 ring-zinc-900/10 transition-colors hover:bg-zinc-50 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Limpar
                </button>
              )}
              {permissoes.podeCriarAvulsa && !permissoes.podeCriarContinua ? (
                <Link href="/dashboard/atendimento" className={BOTAO_PRIMARIO}>
                  Novo atendimento
                </Link>
              ) : null}
            </div>
          </div>

          <p id="nova-liberacao-descricao" className="sr-only" aria-live="polite">
            {motivoDesabilitado ?? ""}
          </p>

          {!selecionado && motivoDesabilitado && (
            <p className="mt-3 text-sm text-zinc-500">
              {motivoDesabilitado}
            </p>
          )}
        </div>

        {props.erroInicial && !selecionado && <FeedbackErro>{props.erroInicial}</FeedbackErro>}

        {feedback && <FeedbackSucesso>{feedback}</FeedbackSucesso>}

        {selecionado && (
          <>
            <div className={`${CARTAO} p-5`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-brand-900 truncate">{selecionado.nome}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Gestor SUS {selecionado.gestor_sus}{selecionado.origem === "esporadico" ? " · Esporádico" : " · Regular"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 ring-1 ring-zinc-900/10 transition-colors hover:bg-zinc-50 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Limpar
                  </button>
                  {canCreateContinua && (
                    <button
                      type="button"
                      onClick={() => setFormAberto({ modo: "criar", pacienteInicial: selecionado })}
                      className={BOTAO_PRIMARIO}
                    >
                      + Nova liberação contínua
                    </button>
                  )}
                </div>
              </div>

              {(loadingSituacao || temErroSituacao || isEsporadico || temContinuaAtiva) && (
                <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col gap-2" role="status" aria-live="polite">
                  {loadingSituacao && (
                    <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-hidden="true"></span>
                      Verificando situação...
                    </p>
                  )}
                  {temErroSituacao && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex flex-col gap-2">
                      <p role="alert" className="text-sm text-red-700 flex items-center gap-1.5">
                        <span aria-hidden="true" className="flex-shrink-0">✕</span>
                        Não foi possível verificar a situação deste paciente.
                      </p>
                      <button type="button" onClick={handleRetry} className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 self-start">
                        Tentar novamente
                      </button>
                    </div>
                  )}
                  {isEsporadico && (
                    <p className="text-sm text-amber-800 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 border border-amber-100">
                      <span aria-hidden="true" className="flex-shrink-0">⚠</span>
                      <span>Paciente esporádico não pode receber liberação contínua.</span>
                    </p>
                  )}
                  {temContinuaAtiva && (
                    <p className="text-sm text-amber-800 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 border border-amber-100">
                      <span aria-hidden="true" className="flex-shrink-0">⚠</span>
                      <span>Contínua ativa — nova liberação indisponível enquanto esta estiver ativa.</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {!vazio && !props.erroInicial && (
              <p className="text-sm text-zinc-500" aria-live="polite">
                {props.liberacoesIniciais.length === 1
                  ? "1 liberação encontrada"
                  : `${props.liberacoesIniciais.length} liberações encontradas.`}
              </p>
            )}

            {vazio ? (
              <div className={`${CARTAO} p-6 text-center`}>
                <p className="text-sm text-zinc-500 mb-4">
                  Nenhuma liberação encontrada para este paciente.
                </p>
                {canCreateContinua && (
                  <button
                    type="button"
                    onClick={() => setFormAberto({ modo: "criar", pacienteInicial: selecionado })}
                    className={BOTAO_PRIMARIO}
                  >
                    + Nova liberação contínua
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {props.liberacoesIniciais.map((lib) => (
                  <LiberacaoCard
                    key={lib.id}
                    liberacao={lib}
                    permissoes={{
                      podeEditar: permissoes.podeEditar,
                      podeAlterarStatus: permissoes.podeAlterarStatus,
                      podeRenovar: permissoes.podeRenovar,
                    }}
                    onEditar={handleEditar}
                    onRenovar={handleRenovar}
                    showPacienteInfo={false}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!selecionado && vazio && !props.erroInicial && !props.busca && (
          <EstadoVazio
            mensagem={
              props.perfil === "recepcionista"
                ? "Nenhuma liberação ativa no momento."
                : "Nenhuma liberação registrada ainda."
            }
          />
        )}

        {formAberto && formAberto.modo !== "editar" && (
          <LiberacaoForm
            {...(formAberto.modo === "criar"
              ? {
                  modo: "criar" as const,
                  pacienteInicial: (formAberto as { pacienteInicial?: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null }).pacienteInicial ?? null,
                  continuaAtiva: continuaAtiva,
                  continuaAtivaLoading: isClientSelection ? fetchState.loading : false,
                  continuaAtivaProvided: true,
                }
              : { modo: "renovar" as const, origem: formAberto.origem, continuaAtivaProvided: true })}
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

        {formAberto?.modo === "editar" && (
          <LiberacaoEditForm
            liberacao={formAberto.liberacao}
            perfil={props.perfil}
            onClose={() => setFormAberto(null)}
            onSalvo={() => {
              setFeedback("Liberação atualizada com sucesso.");
              setFormAberto(null);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}