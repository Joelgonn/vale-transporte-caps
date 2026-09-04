// Sprint 54 — Liberações operacionais: funções PURAS de classificação e agregação.
// Reutiliza lógica de vencimento do Consolidado (7 dias) e Define situações
// próprias (inclui múltiplas ativas). Sem dependência de banco/Next.

import { STATUS_LIBERACAO, TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type { LinhaLiberacoes } from "@/lib/domain/relatorios/types";

export const SITUACOES_LIBERACOES = [
  "todos",
  "proximo_vencimento",
  "sem_retirada",
  "expirada_sem_uso",
  "multiplas_ativas",
] as const;
export type SituacaoLiberacoes = (typeof SITUACOES_LIBERACOES)[number];

export function isSituacaoLiberacoes(v: string | null | undefined): v is SituacaoLiberacoes {
  return (SITUACOES_LIBERACOES as readonly string[]).includes(v ?? "");
}

// ---------------------------------------------------------------------------
// Predicados puros
// ---------------------------------------------------------------------------
export function isSemRetiradaLiberacoes(l: Pick<LinhaLiberacoes, "totalRetirado">): boolean {
  return l.totalRetirado === 0;
}

export function isExpiradaSemUsoLiberacoes(l: Pick<LinhaLiberacoes, "status" | "totalRetirado">): boolean {
  return l.status === STATUS_LIBERACAO.EXPIRADA && l.totalRetirado === 0;
}

export function isProximoVencimentoLiberacoes(
  l: Pick<LinhaLiberacoes, "status" | "dataFim">,
  agora: Date = new Date()
): boolean {
  if (l.status !== STATUS_LIBERACAO.ATIVA) return false;
  const hoje = isoDate(agora);
  const limite = isoDate(addDays(agora, 7));
  const fim = (l.dataFim ?? "").slice(0, 10);
  if (!fim) return false;
  return fim >= hoje && fim <= limite;
}

export function diasParaVencerLiberacoes(dataFim: string, agora: Date = new Date()): number | null {
  const fim = (dataFim ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) return null;
  const hoje = isoDate(agora);
  const dHoje = new Date(hoje + "T00:00:00Z");
  const dFim = new Date(fim + "T00:00:00Z");
  return Math.round((dFim.getTime() - dHoje.getTime()) / 86400000);
}

export function textoVencimentoLiberacoes(dataFim: string, agora: Date = new Date()): string | null {
  const d = diasParaVencerLiberacoes(dataFim, agora);
  if (d == null) return null;
  if (d < 0) return null;
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence em 1 dia";
  return `vence em ${d} dias`;
}

// Múltiplas ativas: paciente com >1 liberação ativa no conjunto filtrado
export function calcularPacientesMultiplasAtivas(linhas: LinhaLiberacoes[]): Set<string> {
  const contagem = new Map<string, number>();
  for (const l of linhas) {
    if (l.status !== STATUS_LIBERACAO.ATIVA) continue;
    const pid = l.paciente?.id;
    if (!pid) continue;
    contagem.set(pid, (contagem.get(pid) ?? 0) + 1);
  }
  const multiplas = new Set<string>();
  for (const [pid, c] of contagem) if (c > 1) multiplas.add(pid);
  return multiplas;
}

export function isMultiplaAtiva(
  l: LinhaLiberacoes,
  multiplas: Set<string>
): boolean {
  if (l.status !== STATUS_LIBERACAO.ATIVA) return false;
  const pid = l.paciente?.id;
  if (!pid) return false;
  return multiplas.has(pid);
}

// Filtro de visualização
export function filtrarPorSituacaoLiberacoes(
  linhas: LinhaLiberacoes[],
  situacao: SituacaoLiberacoes | string | null | undefined,
  agora: Date = new Date()
): LinhaLiberacoes[] {
  if (!situacao || situacao === "todos") return linhas;
  switch (situacao) {
    case "sem_retirada":
      return linhas.filter((l) => isSemRetiradaLiberacoes(l));
    case "proximo_vencimento":
      return linhas.filter((l) => isProximoVencimentoLiberacoes(l, agora));
    case "expirada_sem_uso":
      return linhas.filter((l) => isExpiradaSemUsoLiberacoes(l));
    case "multiplas_ativas": {
      const multiplas = calcularPacientesMultiplasAtivas(linhas);
      return linhas.filter((l) => isMultiplaAtiva(l, multiplas));
    }
    default:
      return linhas;
  }
}

// Totais operacionais
export type TotaisLiberacoes = {
  total: number;
  ativas: number;
  continuas: number;
  avulsas: number;
  proximasVencimento: number;
  semRetirada: number;
};

export function calcularTotaisLiberacoes(
  linhas: LinhaLiberacoes[],
  agora: Date = new Date()
): TotaisLiberacoes {
  let ativas = 0;
  let continuas = 0;
  let avulsas = 0;
  let proximas = 0;
  let semRetirada = 0;
  for (const l of linhas) {
    if (l.status === STATUS_LIBERACAO.ATIVA) ativas += 1;
    if (l.tipo === TIPOS_LIBERACAO.CONTINUA) continuas += 1;
    else if (l.tipo === TIPOS_LIBERACAO.AVULSA) avulsas += 1;
    if (isProximoVencimentoLiberacoes(l, agora)) proximas += 1;
    if (isSemRetiradaLiberacoes(l)) semRetirada += 1;
  }
  return { total: linhas.length, ativas, continuas, avulsas, proximasVencimento: proximas, semRetirada };
}

export type ContadoresLiberacoes = {
  proximasVencimento: number;
  semRetirada: number;
  expiradaSemUso: number;
  multiplasAtivas: number; // pacientes com >1 ativa
  multiplasAtivasLiberacoes: number; // liberações que pertencem a esses pacientes
};

export function calcularContadoresLiberacoes(
  linhas: LinhaLiberacoes[],
  agora: Date = new Date()
): ContadoresLiberacoes {
  let proximas = 0;
  let semRetirada = 0;
  let expiradaSemUso = 0;
  for (const l of linhas) {
    if (isProximoVencimentoLiberacoes(l, agora)) proximas += 1;
    if (isSemRetiradaLiberacoes(l)) semRetirada += 1;
    if (isExpiradaSemUsoLiberacoes(l)) expiradaSemUso += 1;
  }
  const multiplas = calcularPacientesMultiplasAtivas(linhas);
  const multiplasAtivas = multiplas.size;
  let multiplasAtivasLiberacoes = 0;
  for (const l of linhas) if (isMultiplaAtiva(l, multiplas)) multiplasAtivasLiberacoes += 1;
  return { proximasVencimento: proximas, semRetirada, expiradaSemUso, multiplasAtivas, multiplasAtivasLiberacoes };
}

// Helpers data UTC
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
