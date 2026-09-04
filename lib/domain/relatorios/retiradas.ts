// Sprint 55 — Retiradas operacionais: funções PURAS de agregação e classificação.
// Reutiliza semântica de previsto/retirado do Consolidado (RN31).

import type { LinhaRetiradas } from "@/lib/domain/relatorios/types";

export const SITUACOES_RETIRADAS = ["todos", "acima_previsao", "fora_vigencia"] as const;
export type SituacaoRetiradas = (typeof SITUACOES_RETIRADAS)[number];

export function isSituacaoRetiradas(v: string | null | undefined): v is SituacaoRetiradas {
  return (SITUACOES_RETIRADAS as readonly string[]).includes(v ?? "");
}

// Totais operacionais sobre conjunto filtrado
export type TotaisRetiradas = {
  registros: number;
  valesRetirados: number;
  pacientesDistintos: number;
  avulsas: number;
  continuas: number;
};

export function calcularTotaisRetiradas(linhas: LinhaRetiradas[]): TotaisRetiradas {
  let vales = 0;
  let avulsas = 0;
  let continuas = 0;
  const pacientes = new Set<string>();
  for (const l of linhas) {
    vales += l.quantidade;
    if (l.paciente?.id) pacientes.add(l.paciente.id);
    if (l.liberacao?.tipo === "avulsa") avulsas += 1;
    else if (l.liberacao?.tipo === "continua") continuas += 1;
  }
  return {
    registros: linhas.length,
    valesRetirados: vales,
    pacientesDistintos: pacientes.size,
    avulsas,
    continuas,
  };
}

// Classificação "Acima da previsão": retirado acumulado da liberação > previsto.
// Precisa do total por liberação. Calcula mapa liberacaoId -> {previsto, totalRetirado}
function mapaTotalPorLiberacao(linhas: LinhaRetiradas[]): Map<string, { previsto: number; total: number }> {
  const m = new Map<string, { previsto: number; total: number }>();
  for (const l of linhas) {
    const id = l.liberacao?.id;
    if (!id) continue;
    const previsto = l.liberacao?.quantidade ?? 0;
    const cur = m.get(id) ?? { previsto, total: 0 };
    // previsto deve ser estável (mesma liberacao); se divergir, mantém primeiro
    cur.total += l.quantidade;
    m.set(id, cur);
  }
  return m;
}

export function isAcimaPrevisao(l: LinhaRetiradas, mapa?: Map<string, { previsto: number; total: number }>): boolean {
  const id = l.liberacao?.id;
  if (!id || l.liberacao?.quantidade == null) return false;
  const previsto = l.liberacao.quantidade;
  if (mapa) {
    const entry = mapa.get(id);
    if (!entry) return false;
    return entry.total > previsto;
  }
  // fallback: se mapa não fornecido, não podemos decidir — retorna false para não gerar falso positivo
  return false;
}

export function isForaVigencia(l: LinhaRetiradas): boolean {
  const liber = l.liberacao as unknown as { data_inicio?: string; data_fim?: string } | null;
  if (!liber || !liber.data_inicio || !liber.data_fim) return false;
  const dh = l.dataHora;
  // comparação lexicográfica ISO (UTC)
  return dh < liber.data_inicio || dh > liber.data_fim;
}

export type ContadoresRetiradas = {
  acimaPrevisao: number;
  foraVigencia: number;
};

export function calcularContadoresRetiradas(linhas: LinhaRetiradas[]): ContadoresRetiradas {
  const mapa = mapaTotalPorLiberacao(linhas);
  let acima = 0;
  let fora = 0;
  for (const l of linhas) {
    if (isAcimaPrevisao(l, mapa)) acima += 1;
    if (isForaVigencia(l)) fora += 1;
  }
  return { acimaPrevisao: acima, foraVigencia: fora };
}

export function filtrarPorSituacaoRetiradas(
  linhas: LinhaRetiradas[],
  situacao: SituacaoRetiradas | string | null | undefined
): LinhaRetiradas[] {
  if (!situacao || situacao === "todos") return linhas;
  if (situacao === "acima_previsao") {
    const mapa = mapaTotalPorLiberacao(linhas);
    return linhas.filter((l) => isAcimaPrevisao(l, mapa));
  }
  if (situacao === "fora_vigencia") {
    return linhas.filter((l) => isForaVigencia(l));
  }
  return linhas;
}
