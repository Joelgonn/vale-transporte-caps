"use client";

import { BOTAO_PRIMARIO } from "@/components/ui/visual-tokens";

export default function DashboardError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-brand-900">
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Não foi possível carregar esta página. Tente novamente.
        </p>
        <button type="button" onClick={reset} className={`${BOTAO_PRIMARIO} mt-6`}>
          Tentar novamente
        </button>
      </main>
    </div>
  );
}