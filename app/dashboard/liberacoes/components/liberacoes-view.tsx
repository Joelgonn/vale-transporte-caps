"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ORIGENS_PACIENTE, ROTULO_TIPO_LIBERACAO, type PerfilUsuario } from "@/lib/domain/enums";
import { permissoesLiberacoes } from "@/lib/domain/regras";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";
import { listarLiberacoesAction } from "@/app/actions/liberacoes";
import {
  BOTAO_AVISO,
  BOTAO_PRIMARIO,
  CARTAO,
  CONTAINER,
} from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro, FeedbackSucesso } from "@/components/ui/feedback";
import { PatientSearch } from "@/components/ui/patient-search";
import { LiberacaoStatus } from "./liberacao-status";
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

  const [selecionado, setSelecionado] = useState(props.pacienteSelecionado ?? null);
  // Sincroniza com props quando a navegação do servidor muda o paciente (ex: URL ?paciente=)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelecionado(props.pacienteSelecionado ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dependemos da identidade do paciente (id/SUS), não da referência do objeto
  }, [props.pacienteSelecionado?.id, props.pacienteSelecionado?.gestor_sus]);

  const requestIdRef = useRef(0);
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string | null; continua: LiberacaoComPaciente | null }>({
    loading: false, error: null, continua: null,
  });
  const [retryTick, setRetryTick] = useState(0);

  const isClientSelection = !!selecionado && selecionado.id !== props.pacienteSelecionado?.id;

  useEffect(() => {
    if (!selecionado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state sync based on conditions is intentional
      setFetchState({ loading: false, error: null, continua: null });
      return;
    }
    if (!isClientSelection && retryTick === 0) {
      if (props.erroInicial) {
        setFetchState({ loading: false, error: props.erroInicial, continua: null });
      } else {
        setFetchState({ loading: false, error: null, continua: null });
      }
      return;
    }
    const myId = ++requestIdRef.current;
    setFetchState({ loading: true, error: null, continua: null });
    listarLiberacoesAction(undefined, selecionado.id)
      .then((r) => {
        if (myId !== requestIdRef.current) return;
        if (!r) {
          setFetchState({ loading: false, error: null, continua: null });
          return;
        }
        if (!r.ok) {
          setFetchState({ loading: false, error: r.error, continua: null });
        } else {
          const encontrada = r.data.find((l) => l.tipo === "continua" && l.status === "ativa") ?? null;
          setFetchState({ loading: false, error: null, continua: encontrada });
        }
      })
      .catch(() => {
        if (myId !== requestIdRef.current) return;
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
  const podeRenovar = permissoes.podeRenovar;

  const continuaAtivaServer = selecionado ? props.liberacoesIniciais.find((l) => l.tipo === "continua" && l.status === "ativa") ?? null : null;
  const continuaAtiva = isClientSelection ? fetchState.continua : continuaAtivaServer;
  const temContinuaAtiva = !!continuaAtiva;
  const isEsporadico = selecionado?.origem === ORIGENS_PACIENTE.ESPORADICO;
  const loadingSituacao = isClientSelection ? fetchState.loading : false;

  const erroDaSituacao = isClientSelection
    ? fetchState.error
    : props.erroInicial;
  const temErroSituacao = !!erroDaSituacao;
  const mensagemErroSituacao = erroDaSituacao ?? null;

  const descricao =
    props.perfil === "recepcionista"
      ? "Liberações ativas do vale-transporte — apenas as liberações vigentes."
      : "Liberações registradas no CAPS — busque por paciente ou Gestor SUS.";

  const novaLiberacaoDesabilitada =
    !selecionado || loadingSituacao || temErroSituacao || isEsporadico || temContinuaAtiva;

  let motivoDesabilitado: string | undefined;
  if (!selecionado) {
    motivoDesabilitado = "Pesquise e selecione um paciente para iniciar uma nova liberação.";
  } else if (loadingSituacao) {
    motivoDesabilitado = "Verificando situação do paciente...";
  } else if (temErroSituacao) {
    motivoDesabilitado = mensagemErroSituacao ?? "Erro ao verificar situação.";
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

  const isDisabled = novaLiberacaoDesabilitada;

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
              {permissoes.podeCriarContinua ? (
                <button
                  type="button"
                  disabled={isDisabled}
                  title={motivoDesabilitado}
                  aria-describedby="nova-liberacao-descricao"
                  onClick={() => {
                    if (isDisabled) return;
                    setFormAberto({ modo: "criar", pacienteInicial: selecionado! });
                  }}
                  className={`${BOTAO_PRIMARIO} ${isDisabled ? "bg-zinc-200 text-zinc-400 ring-1 ring-zinc-900/10 shadow-none cursor-not-allowed hover:bg-zinc-200 hover:shadow-none hover:-translate-y-0 hover:text-zinc-400" : ""}`}
                >
                  Nova liberação
                </button>
              ) : permissoes.podeCriarAvulsa ? (
                <Link href="/dashboard/atendimento" className={BOTAO_PRIMARIO}>
                  Novo atendimento
                </Link>
              ) : null}
            </div>
          </div>

          <p id="nova-liberacao-descricao" className="sr-only" aria-live="polite">
            {motivoDesabilitado ?? ""}
          </p>

          {selecionado && (
            <div className="mt-3 flex flex-col gap-2" role="status" aria-live="polite">
              {loadingSituacao ? (
                <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-hidden="true"></span>
                  Verificando situação...
                </p>
              ) : temErroSituacao ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex flex-col gap-2">
                  <p role="alert" className="text-sm text-red-700 flex items-center gap-1.5">
                    <span aria-hidden="true" className="flex-shrink-0">✕</span>
                    Não foi possível verificar a situação deste paciente.
                  </p>
                  <button type="button" onClick={handleRetry} className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 self-start">
                    Tentar novamente
                  </button>
                </div>
              ) : isEsporadico ? (
                <p className="text-sm text-amber-800 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 border border-amber-100">
                  <span aria-hidden="true" className="flex-shrink-0">⚠</span>
                  <span>Paciente esporádico não pode receber liberação contínua.</span>
                </p>
              ) : temContinuaAtiva ? (
                <p className="text-sm text-amber-800 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 border border-amber-100">
                  <span aria-hidden="true" className="flex-shrink-0">⚠</span>
                  <span>Contínua ativa — nova liberação indisponível.</span>
                </p>
              ) : null}
            </div>
          )}
          {!selecionado && motivoDesabilitado && (
            <p className="mt-3 text-sm text-zinc-500">
              {motivoDesabilitado}
            </p>
          )}
        </div>

        {props.erroInicial && !selecionado && <FeedbackErro>{props.erroInicial}</FeedbackErro>}

        {feedback && <FeedbackSucesso>{feedback}</FeedbackSucesso>}

{!vazio && !props.erroInicial && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            {props.liberacoesIniciais.length === 1
              ? "1 liberação encontrada"
              : `${props.liberacoesIniciais.length} liberações encontradas.`}
          </p>
        )}

        {vazio ? (
          <EstadoVazio
            mensagem={
              selecionado
                ? "Nenhuma liberação encontrada para este paciente."
                : props.busca
                ? "Nenhuma liberação encontrada para esta busca."
                : props.perfil === "recepcionista"
                ? "Nenhuma liberação ativa no momento."
                : "Nenhuma liberação registrada ainda."
            }
          />
        ) : (
          <>
            <div className={`${CARTAO} hidden overflow-x-auto md:block`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Paciente</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Previsto</th>
                    <th className="px-4 py-3 font-medium">Período</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 w-[280px]">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {props.liberacoesIniciais.map((lib) => (
                    <tr
                      key={lib.id}
                      id={`lib-${lib.id}`}
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
                      <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                        {periodoTexto(lib)}
                      </td>
                      <td className="px-4 py-3">
                        <LiberacaoStatus status={lib.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          {(permissoes.podeEditar || permissoes.podeAlterarStatus) && (
                            <button
                              type="button"
                              onClick={() => setFormAberto({ modo: "editar", liberacao: lib })}
                              className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 motion-reduce:transition-none whitespace-nowrap"
                            >
                              Editar
                            </button>
                          )}
                          {lib.status === "ativa" && (
                            <Link href="/dashboard/retiradas" className="inline-flex items-center justify-center rounded-full h-9 px-4 text-sm font-semibold text-brand-900 ring-1 ring-zinc-900/10 transition-colors hover:bg-brand-50/60 hover:text-brand-700 hover:ring-brand-900/15 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 whitespace-nowrap">
                              Registrar retirada
                            </Link>
                          )}
                          {podeRenovar && lib.status === "ativa" && (
                            <button
                              type="button"
                              onClick={() => setFormAberto({ modo: "renovar", origem: lib })}
                              className={`${BOTAO_AVISO} h-9 whitespace-nowrap`}
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

            <ul className="flex flex-col gap-3 md:hidden">
              {props.liberacoesIniciais.map((lib) => (
                <li key={lib.id} id={`lib-${lib.id}`} className={`${CARTAO} p-4`}>
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
                      <dt className="text-xs text-zinc-500">Previsto</dt>
                      <dd className="font-medium text-brand-900">{lib.quantidade}</dd>
                    </div>
                    <div className="w-full sm:w-auto">
                      <dt className="text-xs text-zinc-500">Período</dt>
                      <dd className="font-medium text-brand-900 whitespace-nowrap">{periodoTexto(lib)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    {(permissoes.podeEditar || permissoes.podeAlterarStatus) && (
                      <button
                        type="button"
                        onClick={() => setFormAberto({ modo: "editar", liberacao: lib })}
                        className="inline-flex items-center justify-center rounded-full h-10 px-4 text-sm font-medium text-zinc-700 ring-1 ring-zinc-900/10 transition-colors hover:bg-zinc-50 hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 whitespace-nowrap"
                      >
                        Editar
                      </button>
                    )}
                    {lib.status === "ativa" && (
                      <Link href="/dashboard/retiradas" className="inline-flex items-center justify-center rounded-full h-10 px-4 text-sm font-semibold text-brand-900 ring-1 ring-zinc-900/10 transition-colors hover:bg-brand-50/60 hover:text-brand-700 hover:ring-brand-900/15 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 whitespace-nowrap">
                        Registrar retirada
                      </Link>
                    )}
                    {podeRenovar && lib.status === "ativa" && (
                      <button
                        type="button"
                        onClick={() => setFormAberto({ modo: "renovar", origem: lib })}
                        className={`${BOTAO_AVISO} h-10 whitespace-nowrap`}
                      >
                        Renovar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
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
