import Link from "next/link";

// Marca institucional (Sprint 29) — ícone e palavra-símbolo reutilizados na
// Landing, no Dashboard e nas telas de acesso. O texto permanece "Vale
// Transporte CAPS" como accessible name para preservar os contratos testados.

export function MarcaIcone({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 shadow-md shadow-brand-900/20 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[55%] w-[55%] text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8a3 3 0 0 0 0 8v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a3 3 0 0 1 0-8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1Z" />
        <path d="M12 7v10" strokeDasharray="2 2" />
      </svg>
    </span>
  );
}

type MarcaSistemaProps = {
  href?: string;
  tamanho?: string;
};

export function MarcaSistema({ href = "/", tamanho = "text-base" }: MarcaSistemaProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
    >
      <MarcaIcone />
      <span className={`${tamanho} font-bold tracking-tight text-brand-900`}>
        <span className="text-accent-600">Vale</span> Transporte CAPS
      </span>
    </Link>
  );
}
