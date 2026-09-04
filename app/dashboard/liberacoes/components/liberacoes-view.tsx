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
  BOTAO_SECUNDARIO,
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

  // Sprint 73 — fluxo cognitivo: o paciente selecionado pode vir do servidor (query ?paciente=)
  // ou de seleção client-side via PatientSearch. Mantém sincronizado com props e permite
  // verificação reativa da situação.
  const [selecionado, setSelecionado] = useState(props.pacienteSelecionado ?? null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelecionado(props.pacienteSelecionado ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pacienteSelecionado?.id, props.pacienteSelecionado?.gestor_sus]);

  // Sprint 73 — verificação da situação (tipo=continua status=ativa) com loading/erro/race
  const requestIdRef = useRef(0);
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string | null; continua: LiberacaoComPaciente | null }>({
    loading: false,
    error: null,
    continua: null,
  });
  const [retryTick, setRetryTick] = useState(0);

  const isClientSelection = !!selecionado && selecionado.id !== props.pacienteSelecionado?.id;

  useEffect(() => {
    if (!selecionado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFetchState({ loading: false, error: null, continua: null });
      return;
    }
    // Quando o selecionado coincide com o prop do servidor, a situação já vem de
    // liberacoesIniciais / erroInicial — não refetch imediato (evita flicker nos testes).
    if (!isClientSelection && retryTick === 0) {
      // Sincroniza estado de fetch com dados do servidor para consistência de error
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado?.id, isClientSelection, retryTick, props.erroInicial]);

  // Efeito para sincronizar erro do servidor quando há retryTick ou quando isClientSelection false
  // (garante fail-closed mesmo sem client fetch)

  // Feedback pós-salvar (Sprint 19): banner transitório após criar/renovar.
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const vazio = props.liberacoesIniciais.length === 0;
  const podeRenovar = permissoes.podeRenovar;

  // Situação efetiva: se seleção client-side pendente, usa fetchState; senão usa dados do servidor
  const continuaAtivaServer = selecionado ? props.liberacoesIniciais.find((l) => l.tipo === "continua" && l.status === "ativa") ?? null : null;
  // Quando há divergência (client selection) ou erro server capturado via fetchState, prioriza fetchState
  const continuaAtiva = isClientSelection ? fetchState.continua : continuaAtivaServer;
  const temContinuaAtiva = !!continuaAtiva;
  const isEsporadico = selecionado?.origem === ORIGENS_PACIENTE.ESPORADICO;
  const loadingSituacao = isClientSelection ? fetchState.loading : false;
  // erro da situação: client fetch error OU erroInicial do servidor quando há paciente selecionado
  const erroSituacao = isClientSelection ? fetchState.error : props.erroInicial && selecionado ? props.erroInicial : fetchState.error;

  const descricao =
    props.perfil === "recepcionista"
      ? "Liberações ativas do vale-transporte — apenas as liberações vigentes."
      : "Liberações registradas no CAPS — busque por paciente ou Gestor SUS.";

  const novaLiberacaoDesabilitada =
    !selecionado || loadingSituacao || !!erroSituacao || isEsporadico || temContinuaAtiva;

  let motivoDesabilitado: string | undefined;
  if (!selecionado) {
    motivoDesabilitado = "Pesquise e selecione um paciente para iniciar uma nova liberação.";
  } else if (loadingSituacao) {
    motivoDesabilitado = "Verificando situação do paciente...";
  } else if (erroSituacao) {
    motivoDesabilitado = erroSituacao;
  } else if (isEsporadico) {
    motivoDesabilitado = "Paciente esporádico não pode receber liberação contínua.";
  } else if (temContinuaAtiva) {
    motivoDesabilitado = "Este paciente já possui uma liberação contínua ativa.";
  }

  function handleSelect(p: PacienteSemCpf) {
    setSelecionado({ id: p.id, gestor_sus: p.gestor_sus, nome: p.nome, origem: (p as unknown as { origem?: string | null }).origem ?? null });
    router.push(`/dashboard/liberacoes?paciente=${p.id}`);
  }

  // Sprint 73.1 — invalidação imediata ao iniciar nova busca (texto ≠ seleção)
  function handleQueryChange(q: string) {
    // Qualquer alteração de texto após seleção deve invalidar a seleção anterior
    // e a situação verificada (continuaAtiva, erro, loading)
    if (selecionado) {
      requestIdRef.current++;
      setSelecionado(null);
      setFetchState({ loading: false, error: null, continua: null });
      if (props.pacienteSelecionado) {
        router.push("/dashboard/liberacoes");
      }
      return;
    }
    // Mesmo sem seleção, limpa situação residual (card anterior, erro)
    if (fetchState.continua || fetchState.error || fetchState.loading) {
      requestIdRef.current++;
      setFetchState({ loading: false, error: null, continua: null });
    }
    void q;
  }

  function handleRetry() {
    setRetryTick((n) => n + 1);
  }

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader titulo="Liberações" descricao={descricao} />

        {/* Sprint 73.1 — composição: busca e ação no MESMO NÍVEL VISUAL (desktop)
            [ PatientSearch...................... ] [ Nova liberação ]
            Mobile empilha naturalmente. */}
        <div className={`${CARTAO} p-4`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <PatientSearch
                id="busca-liberacoes"
                label="Buscar por paciente ou Gestor SUS"
                placeholder="🔎 Nome ou Gestor SUS..."
                onSelect={handleSelect}
                onQueryChange={handleQueryChange}
              />
            </div>
            <div className="flex shrink-0 flex-col gap-2 md:pb-[22px]">
              <div className="flex items-center gap-3">
                {permissoes.podeCriarContinua ? (
                  <button
                    type="button"
                    disabled={novaLiberacaoDesabilitada}
                    title={motivoDesabilitado}
                    aria-describedby={novaLiberacaoDesabilitada ? "nova-liberacao-ajuda" : undefined}
                    onClick={() => {
                      if (novaLiberacaoDesabilitada) return;
                      setFormAberto({ modo: "criar", pacienteInicial: selecionado! });
                    }}
                    className={`${BOTAO_PRIMARIO} disabled:opacity-50 disabled:cursor-not-allowed`}
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
          </div>
          {!selecionado && motivoDesabilitado && (
            <p id="nova-liberacao-ajuda" className="mt-3 text-sm text-zinc-500">
              {motivoDesabilitado}
            </p>
          )}
          {erroSituacao && !selecionado && (
            <div className="mt-3 flex flex-col gap-2">
              <p id="nova-liberacao-ajuda" role="alert" className="text-sm text-red-600">
                {erroSituacao}
              </p>
              <button type="button" onClick={handleRetry} className={BOTAO_SECUNDARIO}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        {/* Sprint 73.2 — card contextual único: paciente + situação + ações */}
        {selecionado ? (
          <div className={`${CARTAO} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-900">{selecionado.nome}</p>
                <p className="text-xs text-zinc-500">
                  Gestor SUS {selecionado.gestor_sus}
                  {selecionado.origem === "esporadico" ? " · Esporádico" : selecionado.origem === "regular" ? " · Regular" : ""}
                </p>
              </div>
              <button type="button" onClick={() => router.push("/dashboard/liberacoes")} className={BOTAO_SECUNDARIO}>
                Limpar
              </button>
            </div>

            <div className="mt-3">
              {loadingSituacao ? (
                <p className="text-sm text-zinc-500">Verificando situação...</p>
              ) : erroSituacao ? (
                <div className="flex flex-col gap-2">
                  <p role="alert" className="text-sm text-red-600">
                    {erroSituacao}
                  </p>
                  <button type="button" onClick={handleRetry} className={`${BOTAO_SECUNDARIO} self-start`}>
                    Tentar novamente
                  </button>
                </div>
              ) : isEsporadico ? (
                <p className="text-sm font-medium text-amber-900">Paciente esporádico não pode receber liberação contínua.</p>
              ) : temContinuaAtiva && continuaAtiva ? (
                <div className="border-l-4 border-l-amber-400 pl-3">
                  <p className="text-sm font-semibold text-amber-900">Este paciente já possui uma liberação contínua ativa.</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {ROTULO_TIPO_LIBERACAO[continuaAtiva.tipo]} · {periodoTexto(continuaAtiva)} · {continuaAtiva.quantidade} previstos
                    {(continuaAtiva as unknown as { vales_por_dia?: number | null }).vales_por_dia
                      ? ` · ${(continuaAtiva as unknown as { vales_por_dia?: number | null }).vales_por_dia} vales/dia`
                      : " · Quantidade diária não informada"}{" "}
                    · {continuaAtiva.status}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/dashboard/liberacoes?paciente=${selecionado?.id}#lib-${continuaAtiva.id}`} className={BOTAO_SECUNDARIO}>
                      Ver liberação
                    </Link>
                    <Link href="/dashboard/retiradas" className={BOTAO_SECUNDARIO}>
                      Registrar retirada
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Paciente elegível para uma nova liberação contínua.</p>
              )}
            </div>
          </div>
        ) : null}

        {props.erroInicial && !selecionado && <FeedbackErro>{props.erroInicial}</FeedbackErro>}

        {feedback && <FeedbackSucesso>{feedback}</FeedbackSucesso>}

        {!vazio && !props.erroInicial && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            {props.liberacoesIniciais.length}{" "}
            {props.liberacoesIniciais.length === 1 ? "liberação" : "liberações"}
            {selecionado || props.busca
              ? " para esta busca."
              : props.liberacoesIniciais.length === 1
                ? " registrada."
                : " registradas."}
          </p>
        )}

        {vazio ? (
          <EstadoVazio
            mensagem={
              selecionado || props.busca
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
                    <th className="px-4 py-3 font-medium">Previsto</th>
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
                      <td className="px-4 py-3 text-zinc-600">
                        {periodoTexto(lib)}
                      </td>
                      <td className="px-4 py-3">
                        <LiberacaoStatus status={lib.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {(permissoes.podeEditar || permissoes.podeAlterarStatus) && (
                            <button
                              type="button"
                              onClick={() => setFormAberto({ modo: "editar", liberacao: lib })}
                              className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 motion-reduce:transition-none"
                            >
                              Editar
                            </button>
                          )}
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
                  id={`lib-${lib.id}`}
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
                      <dt className="text-xs text-zinc-500">Previsto</dt>
                      <dd className="font-medium text-brand-900">{lib.quantidade}</dd>
                    </div>
                    <div className="w-full sm:w-auto">
                      <dt className="text-xs text-zinc-500">Período</dt>
                      <dd className="font-medium text-brand-900">{periodoTexto(lib)}</dd>
                    </div>
                  </dl>

                  {(permissoes.podeEditar || permissoes.podeAlterarStatus) && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setFormAberto({ modo: "editar", liberacao: lib })}
                        className={BOTAO_SECUNDARIO}
                      >
                        Editar
                      </button>
                    </div>
                  )}

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

        {formAberto && formAberto.modo !== "editar" && (
          <LiberacaoForm
            {...(formAberto.modo === "criar"
              ? {
                  modo: "criar" as const,
                  pacienteInicial: (formAberto as { pacienteInicial?: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null }).pacienteInicial ?? null,
                }
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
