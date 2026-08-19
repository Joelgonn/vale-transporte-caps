"use client";

import type { PointerEvent } from "react";

type CorGlow = "accent" | "branco";

const GLOW_CORES: Record<CorGlow, string> = {
  accent: "rgba(56,179,176,0.16)",
  branco: "rgba(255,255,255,0.24)",
};

// Atualiza as variáveis CSS --glow-x/--glow-y direto no DOM (sem estado React e
// sem re-render por movimento do mouse). O glow do CardGlow lê essas variáveis.
export function aoMoverCursor(event: PointerEvent<HTMLElement>) {
  const alvo = event.currentTarget;
  const retangulo = alvo.getBoundingClientRect();
  alvo.style.setProperty("--glow-x", `${event.clientX - retangulo.left}px`);
  alvo.style.setProperty("--glow-y", `${event.clientY - retangulo.top}px`);
}

type CardGlowProps = {
  cor?: CorGlow;
  className?: string;
};

// "Cursor-following glow" (Sprint 33): camada sutil de destaque que acompanha o
// ponteiro dentro do card interativo. Nada de tilt 3D — só um radial que segue o
// cursor (movimento ≤16px) e volta suavemente ao repouso ao sair. A camada cobre
// o card para receber o rastreio; cliques vazam para o Link pai (o card inteiro
// é o alvo). Em prefers-reduced-motion a camada é removida por completo.
export function CardGlow({ cor = "accent", className = "" }: CardGlowProps) {
  return (
    <span
      aria-hidden="true"
      onPointerMove={aoMoverCursor}
      className={`absolute inset-0 opacity-0 transition-opacity duration-[250ms] ease-out group-hover:opacity-100 motion-reduce:hidden ${className}`}
      style={{
        background: `radial-gradient(130px circle at var(--glow-x, 72%) var(--glow-y, 28%), ${GLOW_CORES[cor]}, transparent 72%)`,
      }}
    />
  );
}
