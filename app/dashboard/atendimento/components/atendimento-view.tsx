"use client";

import { useState } from "react";
import Link from "next/link";
import { criarPacienteAction } from "@/app/actions/pacientes";
import { criarLiberacaoAction } from "@/app/actions/liberacoes";
import { listarLiberacoesAction } from "@/app/actions/liberacoes";
import { registrarRetiradaAction } from "@/app/actions/retiradas";
import { PatientSearch } from "@/components/ui/patient-search";
import { ORIGENS_PACIENTE, TIPOS_LIBERACAO, type PerfilUsuario } from "@/lib/domain/enums";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CARTAO,
  CONTAINER,
  INPUT,
  ROTULO,
} from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { FeedbackErro } from "@/components/ui/feedback";

type Props = { perfil: PerfilUsuario };

const PASSOS = [
  { id: 1, rotulo: "Paciente" },
  { id: 2, rotulo: "Liberação" },
  { id: 3, rotulo: "Retirada" },
  { id: 4, rotulo: "Concluído" },
];

export default function AtendimentoView(props: Props) {
  void props.perfil;
  const [passo, setPasso] = useState(1);

  // Paciente
  const [paciente, setPaciente] = useState<PacienteSemCpf | null>(null);
  // Criar esporádico
  const [novoSUS, setNovoSUS] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [criandoPaciente, setCriandoPaciente] = useState(false);
  const [erroCriarPaciente, setErroCriarPaciente] = useState<string | null>(null);

  // Liberação
  const [modoAtendimento, setModoAtendimento] = useState<"avulsa" | "continua">("avulsa");
  const [liberacoes, setLiberacoes] = useState<LiberacaoComPaciente[]>([]);
  const [carregandoLib, setCarregandoLib] = useState(false);
  const [liberacaoSelecionada, setLiberacaoSelecionada] = useState<LiberacaoComPaciente | null>(null);
  const [quantidadeAvulsa, setQuantidadeAvulsa] = useState(4);
  const [criandoLiberacao, setCriandoLiberacao] = useState(false);
  const [liberacaoCriada, setLiberacaoCriada] = useState<LiberacaoComPaciente | null>(null);
  const [erroLiberacao, setErroLiberacao] = useState<string | null>(null);

  // Retirada
  const [quantidadeRetirada, setQuantidadeRetirada] = useState(2);
  const [registrando, setRegistrando] = useState(false);
  const [erroRetirada, setErroRetirada] = useState<string | null>(null);
  const [retiradaOk, setRetiradaOk] = useState(false);
  const [retiradaDetalhe, setRetiradaDetalhe] = useState<{ paciente: string; quantidade: number; tipo: string } | null>(null);

  function selecionarPaciente(p: PacienteSemCpf) {
    setPaciente(p);
    // Carregar liberações para decidir modo
    carregarLiberacoes(p);
  }

  async function carregarLiberacoes(p: PacienteSemCpf) {
    setCarregandoLib(true);
    const r = await listarLiberacoesAction(p.gestor_sus);
    setCarregandoLib(false);
    if (r.ok) {
      const filtradas = r.data.filter((l) => l.paciente_id === p.id);
      setLiberacoes(filtradas);
      const temContinuaAtiva = filtradas.some((l) => l.tipo === TIPOS_LIBERACAO.CONTINUA && l.status === "ativa");
      // Se paciente esporádico, força avulsa
      if (p.origem === ORIGENS_PACIENTE.ESPORADICO) {
        setModoAtendimento("avulsa");
      } else if (temContinuaAtiva) {
        // mantém escolha atual, mas sugere operação de contínua
      }
    }
  }

  async function criarPacienteEsporadico() {
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
    setPaciente(r.data);
    setNovoSUS("");
    setNovoNome("");
    await carregarLiberacoes(r.data);
  }

  function podeAvancar1() {
    return !!paciente;
  }
  function podeAvancar2() {
    if (modoAtendimento === "avulsa") return quantidadeAvulsa >= 1 && quantidadeAvulsa <= 999;
    return !!liberacaoSelecionada;
  }

  async function avancarParaRetirada() {
    if (modoAtendimento === "avulsa") {
      if (!paciente) return;
      // Validar RN29 localmente
      if (paciente.origem === ORIGENS_PACIENTE.ESPORADICO && modoAtendimento !== "avulsa") {
        setErroLiberacao("Paciente esporádico somente recebe liberação avulsa (RN29).");
        return;
      }
      setCriandoLiberacao(true);
      setErroLiberacao(null);
      const r = await criarLiberacaoAction({
        pacienteId: paciente.id,
        tipo: TIPOS_LIBERACAO.AVULSA,
        quantidade: quantidadeAvulsa,
        periodoMeses: null,
      });
      setCriandoLiberacao(false);
      if (!r.ok) {
        setErroLiberacao(r.error);
        return;
      }
      setLiberacaoCriada(r.data);
      setLiberacaoSelecionada(r.data);
      setPasso(3);
    } else {
      if (!liberacaoSelecionada) {
        setErroLiberacao("Selecione a liberação contínua para operar.");
        return;
      }
      setLiberacaoCriada(null);
      setPasso(3);
    }
  }

  async function registrarRetirada() {
    const alvo = liberacaoSelecionada ?? liberacaoCriada;
    if (!paciente || !alvo) return;
    setRegistrando(true);
    setErroRetirada(null);
    const r = await registrarRetiradaAction({ liberacaoId: alvo.id, pacienteId: paciente.id, quantidade: quantidadeRetirada });
    setRegistrando(false);
    if (!r.ok) {
      setErroRetirada(r.error);
      return;
    }
    setRetiradaDetalhe({ paciente: paciente.nome, quantidade: quantidadeRetirada, tipo: alvo.tipo });
    setRetiradaOk(true);
    setPasso(4);
  }

  return (
    <div className="flex flex-1 flex-col py-8">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader titulo="Atendimento" descricao="Recepção — localizar ou cadastrar paciente esporádico, criar liberação avulsa e registrar retirada em fluxo único." />

        {/* Stepper */}
        <div className={`${CARTAO} p-3`}>
          <ol className="flex flex-wrap gap-2">
            {PASSOS.map((p) => {
              const ativo = p.id === passo;
              const concluido = p.id < passo;
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${concluido ? "bg-green-100 text-green-800" : ativo ? "bg-brand-600 text-white" : "bg-zinc-200 text-zinc-600"}`}>{concluido ? "✓" : p.id}</span>
                  <span className={ativo ? "font-medium text-brand-900" : "text-zinc-500"}>{p.rotulo}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Passo 1 — Paciente */}
        {passo === 1 && (
          <div className={`${CARTAO} p-4 flex flex-col gap-4`}>
            <h3 className="font-semibold text-brand-900">1. Paciente — localizar ou cadastrar</h3>
            {paciente ? (
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div>
                  <p className="font-medium text-brand-900">{paciente.nome}</p>
                  <p className="text-xs text-zinc-500">SUS {paciente.gestor_sus} · {paciente.origem === ORIGENS_PACIENTE.ESPORADICO ? "Esporádico" : "Regular"}</p>
                </div>
                <button type="button" onClick={() => { setPaciente(null); setLiberacoes([]); setLiberacaoSelecionada(null); }} className={BOTAO_SECUNDARIO}>Trocar</button>
              </div>
            ) : (
              <>
                <PatientSearch
                  showCreate={true}
                  id="atendimento-paciente"
                  label="Paciente"
                  placeholder="🔎 Nome ou Gestor SUS..."
                  onSelect={selecionarPaciente}
                />

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="text-sm font-semibold text-amber-900">Paciente não encontrado? Cadastrar como esporádico</h4>
                  <p className="text-xs text-amber-700">Origem: <strong>Esporádico</strong> — somente liberação avulsa. Paciente será reutilizado nos próximos atendimentos.</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className={ROTULO}>Gestor SUS</label><input value={novoSUS} onChange={(e) => setNovoSUS(e.target.value.toUpperCase())} placeholder="Ex.: 123456" className={`${INPUT} uppercase`} /></div>
                    <div><label className={ROTULO}>Nome</label><input value={novoNome} onChange={(e) => setNovoNome(e.target.value.toUpperCase())} placeholder="Nome completo" className={`${INPUT} uppercase`} /></div>
                  </div>
                  {erroCriarPaciente && <FeedbackErro>{erroCriarPaciente}</FeedbackErro>}
                  <button type="button" disabled={criandoPaciente} onClick={criarPacienteEsporadico} className={`${BOTAO_PRIMARIO} mt-3`}>{criandoPaciente ? "Salvando..." : "Cadastrar paciente esporádico"}</button>
                </div>
              </>
            )}
            <div className="flex justify-end">
              <button type="button" disabled={!podeAvancar1()} onClick={() => setPasso(2)} className={BOTAO_PRIMARIO}>Continuar</button>
            </div>
          </div>
        )}

        {/* Passo 2 — Liberação */}
        {passo === 2 && paciente && (
          <div className={`${CARTAO} p-4 flex flex-col gap-4`}>
            <h3 className="font-semibold text-brand-900">2. Liberação — {paciente.origem === ORIGENS_PACIENTE.ESPORADICO ? "somente avulsa (RN29)" : "avulsa ou operar contínua existente"}</h3>
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm">
              <p><span className="text-zinc-500">Paciente:</span> <span className="font-medium text-brand-900">{paciente.nome}</span> <span className="text-xs text-zinc-500">· {paciente.origem === ORIGENS_PACIENTE.ESPORADICO ? "Esporádico" : "Regular"}</span></p>
            </div>

            {/* Escolha do modo */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setModoAtendimento("avulsa")} className={`flex-1 rounded-xl border px-4 py-3 text-left ${modoAtendimento === "avulsa" ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 hover:bg-zinc-50"}`}>
                <p className="font-medium">Criar liberação avulsa</p>
                <p className={`text-xs ${modoAtendimento === "avulsa" ? "text-white/80" : "text-zinc-500"}`}>Para atendimento pontual (1 dia). Vale para regular e esporádico.</p>
              </button>
              <button type="button" disabled={paciente.origem === ORIGENS_PACIENTE.ESPORADICO} onClick={() => setModoAtendimento("continua")} className={`flex-1 rounded-xl border px-4 py-3 text-left ${modoAtendimento === "continua" ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 hover:bg-zinc-50"} ${paciente.origem === ORIGENS_PACIENTE.ESPORADICO ? "opacity-40 cursor-not-allowed" : ""}`}>
                <p className="font-medium">Operar liberação contínua</p>
                <p className={`text-xs ${modoAtendimento === "continua" ? "text-white/80" : "text-zinc-500"}`}>Localizar autorização contínua já existente.</p>
              </button>
            </div>
            {paciente.origem === ORIGENS_PACIENTE.ESPORADICO && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Paciente esporádico: somente avulsa (RN29). A opção contínua está desabilitada.</p>}

            {modoAtendimento === "avulsa" ? (
              <div className="flex flex-col gap-2">
                <label className={ROTULO}>Quantidade prevista (avulsa)</label>
                <input type="number" min={1} max={999} value={quantidadeAvulsa} onChange={(e) => setQuantidadeAvulsa(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} className={INPUT} />
                <p className="text-xs text-zinc-500">Previsão administrativa — não limita a retirada. Será criada uma liberação avulsa para este paciente.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {carregandoLib ? <p className="text-sm text-zinc-500">Carregando liberações...</p> : liberacoes.filter((l) => l.tipo === TIPOS_LIBERACAO.CONTINUA && l.status === "ativa").length === 0 ? <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">Nenhuma liberação contínua ativa encontrada para este paciente.</p> : (
                  <ul className="flex flex-col gap-2">
                    {liberacoes.filter((l) => l.tipo === TIPOS_LIBERACAO.CONTINUA && l.status === "ativa").map((lib) => (
                      <li key={lib.id}>
                        <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${liberacaoSelecionada?.id === lib.id ? "border-brand-600 bg-brand-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
                          <span><span className="font-medium text-brand-900">Contínua · {lib.quantidade} previstos</span><span className="ml-2 text-xs text-zinc-500">{lib.data_inicio.slice(0,10)} → {lib.data_fim.slice(0,10)}</span></span>
                          <input type="radio" name="lib-continua" checked={liberacaoSelecionada?.id === lib.id} onChange={() => setLiberacaoSelecionada(lib)} className="sr-only" />
                          <span className="text-xs font-medium text-brand-700">{liberacaoSelecionada?.id === lib.id ? "Selecionada" : "Selecionar"}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {erroLiberacao && <FeedbackErro>{erroLiberacao}</FeedbackErro>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setPasso(1)} className={BOTAO_SECUNDARIO}>Voltar</button>
              <button type="button" disabled={!podeAvancar2() || criandoLiberacao} onClick={avancarParaRetirada} className={BOTAO_PRIMARIO}>{criandoLiberacao ? "Criando..." : "Continuar"}</button>
            </div>
          </div>
        )}

        {/* Passo 3 — Retirada */}
        {passo === 3 && (
          <div className={`${CARTAO} p-4 flex flex-col gap-4`}>
            <h3 className="font-semibold text-brand-900">3. Retirada — quantidade a entregar</h3>
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm">
              <p>Paciente: <span className="font-medium">{paciente?.nome}</span> · Liberação: <span className="font-medium">{(liberacaoSelecionada ?? liberacaoCriada)?.tipo === TIPOS_LIBERACAO.AVULSA ? "Avulsa" : "Contínua"}</span> · Previsto: <span className="font-medium">{(liberacaoSelecionada ?? liberacaoCriada)?.quantidade}</span></p>
            </div>
            <div>
              <label className={ROTULO}>Quantidade a retirar</label>
              <input type="number" min={1} value={quantidadeRetirada} onChange={(e) => setQuantidadeRetirada(Math.max(1, Number(e.target.value) || 1))} className={INPUT} />
              <p className="text-xs text-zinc-500">Diferença = Previsto − Retirado (pode ser negativa, sem bloqueio).</p>
            </div>
            {erroRetirada && <FeedbackErro>{erroRetirada}</FeedbackErro>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setPasso(2)} className={BOTAO_SECUNDARIO}>Voltar</button>
              <button type="button" disabled={registrando} onClick={registrarRetirada} className={BOTAO_PRIMARIO}>{registrando ? "Registrando..." : "Registrar retirada"}</button>
            </div>
          </div>
        )}

        {/* Passo 4 — Concluído */}
        {passo === 4 && retiradaOk && retiradaDetalhe && (
          <div className={`${CARTAO} p-6 text-center`}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div>
            <h3 className="mt-3 text-lg font-semibold text-brand-900">Retirada registrada</h3>
            <p className="mt-1 text-sm text-zinc-500">Paciente <span className="font-medium text-brand-900">{retiradaDetalhe.paciente}</span> · {retiradaDetalhe.quantidade} vale(s) · {retiradaDetalhe.tipo === TIPOS_LIBERACAO.AVULSA ? "Avulsa" : "Contínua"}</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/dashboard/retiradas" className={BOTAO_SECUNDARIO}>Ver retiradas</Link>
              <button type="button" onClick={() => { setPasso(1); setPaciente(null); setLiberacoes([]); setLiberacaoSelecionada(null); setLiberacaoCriada(null); setRetiradaOk(false); setQuantidadeRetirada(2); }} className={BOTAO_PRIMARIO}>Novo atendimento</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


