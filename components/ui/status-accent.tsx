// Sprint 59 — Linguagem visual única de status para relatórios
// Estados: normal (verde), atencao (âmbar), critico (vermelho), neutro (cinza)
// Reutiliza paleta existente (emerald/amber/red/zinc) sem nova dependência.

import * as React from "react";
import { CARTAO } from "@/components/ui/visual-tokens";

export type StatusVisual = "normal" | "atencao" | "critico" | "neutro";

const BORDA: Record<StatusVisual, string> = {
  normal: "border-l-emerald-500",
  atencao: "border-l-amber-400",
  critico: "border-l-red-500",
  neutro: "border-l-zinc-200",
};

export function statusBorda(status: StatusVisual): string {
  return BORDA[status] ?? BORDA.neutro;
}

// Card com lingueta lateral estreita (4px) — não pinta o fundo
export function StatusCard({
  status = "neutro",
  children,
  className = "",
  ...props
}: {
  status?: StatusVisual;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${CARTAO} border-l-4 ${statusBorda(status)} ${className}`} {...props}>
      {children}
    </div>
  );
}

// Classificações puras reutilizando domínio existente quando possível
export function classificarDiferenca(diferenca: number): StatusVisual {
  return diferenca < 0 ? "critico" : "normal";
}

export function classificarSituacaoConsolidado(situacao: string | null): StatusVisual {
  if (!situacao || situacao === "todos") return "neutro";
  if (situacao === "estouro") return "critico";
  if (situacao === "expirada_sem_uso") return "critico";
  return "atencao"; // sem_retirada, proximo_vencimento
}

export function classificarSituacaoLiberacoes(situacao: string | null): StatusVisual {
  if (!situacao || situacao === "todos") return "neutro";
  if (situacao === "expirada_sem_uso") return "critico";
  return "atencao";
}

export function classificarSituacaoRetiradas(situacao: string | null): StatusVisual {
  if (!situacao || situacao === "todos") return "neutro";
  return "critico"; // acima_previsao, fora_vigencia
}
