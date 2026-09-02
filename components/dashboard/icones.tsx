import type { ReactNode } from "react";
import type { IconeId } from "@/components/dashboard/navegacao";

// Ícones dos módulos (Sprint 30) — compartilhados entre a sidebar do shell e a
// home do dashboard. Traço consistente (strokeWidth 1.6); a cor é herdada via
// currentColor pelo contexto (ativo branco, inativo neutro, tiles de ação).
// Todos os ícones são decorativos (aria-hidden) — o rótulo está sempre em texto.

function Svg({ children, className = "h-6 w-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ICONE_DASHBOARD = (
  <Svg className="h-5 w-5">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Svg>
);

export const ICONES_MODULO: Record<IconeId, ReactNode> = {
  pacientes: (
    <Svg>
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      <circle cx="12" cy="12" r="4" />
    </Svg>
  ),
  liberacoes: (
    <Svg>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </Svg>
  ),
  retiradas: (
    <Svg>
      <path d="M4 20h16M6 20V8h12v12M9 8V6a3 3 0 0 1 6 0v2" />
    </Svg>
  ),
  usuarios: (
    <Svg>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
    </Svg>
  ),
  auditoria: (
    <Svg>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </Svg>
  ),
  relatorios: (
    <Svg>
      <path d="M4 19V5m0 14h16" />
      <rect x="7" y="10" width="2.5" height="6" rx="0.75" />
      <rect x="11" y="7" width="2.5" height="9" rx="0.75" />
      <rect x="15" y="12" width="2.5" height="4" rx="0.75" />
    </Svg>
  ),
  historico: (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </Svg>
  ),
};