// Sprint 53 — Consolidado operacional: funções PURAS de classificação e agregação.
// Reutiliza estadoPrevisao/isEstouro (RN31) e não duplica regras na UI.
// Sem dependência de banco/Next — testável em isolamento.

import { STATUS_LIBERACAO, TIPOS_LIBERACAO } from "@/lib/domain/enums";
import { estadoPrevisao } from "@/lib/domain/regras";
import type { LinhaConsolidado } from "@/lib/domain/relatorios/types";

// ---------------------------------------------------------------------------
// Situações de atenção (não são mutuamente exclusivas — uma liberação pode
// estar em múltiplas). O texto nunca chama de fraude/erro.
// ---------------------------------------------------------------------------
export const SITUACOES_CONSOLIDADO = [
  "todos",
  "estouro",
  "sem_retirada",
  "proximo_vencimento",
  "expirada_sem_uso",
] as const;
export type SituacaoConsolidado = (typeof SITUACOES_CONSOLIDADO)[number];

export function isSituacaoConsolidado(v: string | null | undefined): v is SituacaoConsolidado {
  return (SITUACOES_CONSOLIDADO as readonly string[]).includes(v ?? "");
}

// ---------------------------------------------------------------------------
// Predicados puros sobre LinhaConsolidado
// ---------------------------------------------------------------------------
export function isEstouroConsolidado(l: Pick<LinhaConsolidado, "saldo">): boolean {
  return l.saldo < 0;
}

export function isSemRetirada(l: Pick<LinhaConsolidado, "quantidadeRetirada">): boolean {
  return l.quantidadeRetirada === 0;
}

export function isExpiradaSemUso(l: Pick<LinhaConsolidado, "status" | "quantidadeRetirada">): boolean {
  return l.status === STATUS_LIBERACAO.EXPIRADA && l.quantidadeRetirada === 0;
}

// Janela objetiva de 7 dias (especificação Sprint 53 §8).
// Critério: status=ativa AND data_fim >= agora AND data_fim <= agora+7d
// Comparação por data (YYYY-MM-DD) para determinismo e independência de fuso.
export function isProximoVencimento(
  l: Pick<LinhaConsolidado, "status" | "dataFim">,
  agora: Date = new Date()
): boolean {
  if (l.status !== STATUS_LIBERACAO.ATIVA) return false;
  const hoje = isoDate(agora);
  const limite = isoDate(addDays(agora, 7));
  const fim = (l.dataFim ?? "").slice(0, 10);
  if (!fim) return false;
  return fim >= hoje && fim <= limite;
}

export function diasParaVencer(dataFim: string, agora: Date = new Date()): number | null {
  const fim = (dataFim ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) return null;
  const hoje = isoDate(agora);
  // diferença em dias inteiros (UTC, sem hora)
  const dHoje = new Date(hoje + "T00:00:00Z");
  const dFim = new Date(fim + "T00:00:00Z");
  const diff = Math.round((dFim.getTime() - dHoje.getTime()) / 86400000);
  return diff;
}

export function textoVencimento(dataFim: string, agora: Date = new Date()): string | null {
  const d = diasParaVencer(dataFim, agora);
  if (d == null) return null;
  if (d < 0) return null; // vencida não é "próximo"
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence em 1 dia";
  return `vence em ${d} dias`;
}

// ---------------------------------------------------------------------------
// Filtro de visualização (apenas filtro, não altera dado)
// ---------------------------------------------------------------------------
export function filtrarPorSituacao(
  linhas: LinhaConsolidado[],
  situacao: SituacaoConsolidado | string | null | undefined,
  agora: Date = new Date()
): LinhaConsolidado[] {
  if (!situacao || situacao === "todos") return linhas;
  switch (situacao) {
    case "estouro":
      return linhas.filter((l) => isEstouroConsolidado(l));
    case "sem_retirada":
      return linhas.filter((l) => isSemRetirada(l));
    case "proximo_vencimento":
      return linhas.filter((l) => isProximoVencimento(l, agora));
    case "expirada_sem_uso":
      return linhas.filter((l) => isExpiradaSemUso(l));
    default:
      return linhas;
  }
}

// ---------------------------------------------------------------------------
// Totais (previsto/retirado/diferença) sobre um conjunto de linhas
// ---------------------------------------------------------------------------
export type TotaisConsolidado = {
  previsto: number;
  retirado: number;
  diferenca: number;
  liberacoes: number;
};

export function calcularTotais(linhas: LinhaConsolidado[]): TotaisConsolidado {
  let previsto = 0;
  let retirado = 0;
  for (const l of linhas) {
    previsto += l.quantidadeAutorizada;
    retirado += l.quantidadeRetirada;
  }
  return { previsto, retirado, diferenca: previsto - retirado, liberacoes: linhas.length };
}

export type TotaisPorTipo = {
  continua: TotaisConsolidado;
  avulsa: TotaisConsolidado;
};

export function calcularTotaisPorTipo(linhas: LinhaConsolidado[]): TotaisPorTipo {
  const continua = linhas.filter((l) => l.tipo === TIPOS_LIBERACAO.CONTINUA);
  const avulsa = linhas.filter((l) => l.tipo === TIPOS_LIBERACAO.AVULSA);
  return {
    continua: calcularTotais(continua),
    avulsa: calcularTotais(avulsa),
  };
}

// Agrupamento por paciente: soma das liberações selecionadas (acumulado).
export type AgregadoPacienteConsolidado = {
  pacienteId: string;
  nome: string;
  gestorSus: string;
  previsto: number;
  retirado: number;
  diferenca: number;
  liberacoes: number;
};

export function agruparPorPaciente(linhas: LinhaConsolidado[]): AgregadoPacienteConsolidado[] {
  const map = new Map<string, AgregadoPacienteConsolidado>();
  for (const l of linhas) {
    const id = l.paciente?.id ?? `sem-paciente-${l.liberacaoId}`;
    const nome = l.paciente?.nome ?? "—";
    const gestorSus = l.paciente?.gestor_sus ?? "—";
    let agg = map.get(id);
    if (!agg) {
      agg = { pacienteId: id, nome, gestorSus, previsto: 0, retirado: 0, diferenca: 0, liberacoes: 0 };
      map.set(id, agg);
    }
    agg.previsto += l.quantidadeAutorizada;
    agg.retirado += l.quantidadeRetirada;
    agg.liberacoes += 1;
  }
  for (const agg of map.values()) agg.diferenca = agg.previsto - agg.retirado;
  return [...map.values()].sort((a, b) => b.previsto - a.previsto || a.nome.localeCompare(b.nome, "pt-BR"));
}

export type ContadoresConsolidado = {
  estouros: number;
  semRetirada: number;
  proximoVencimento: number;
  expiradaSemUso: number;
};

export function calcularContadores(
  linhas: LinhaConsolidado[],
  agora: Date = new Date()
): ContadoresConsolidado {
  let estouros = 0;
  let semRetirada = 0;
  let proximoVencimento = 0;
  let expiradaSemUso = 0;
  for (const l of linhas) {
    if (isEstouroConsolidado(l)) estouros += 1;
    if (isSemRetirada(l)) semRetirada += 1;
    if (isProximoVencimento(l, agora)) proximoVencimento += 1;
    if (isExpiradaSemUso(l)) expiradaSemUso += 1;
  }
  return { estouros, semRetirada, proximoVencimento, expiradaSemUso };
}

// Re-export helper de estadoPrevisao para UI (não duplica lógica)
export { estadoPrevisao };

// ---------------------------------------------------------------------------
// Helpers de data (ISO YYYY-MM-DD, UTC)
// ---------------------------------------------------------------------------
function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
