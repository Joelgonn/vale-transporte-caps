"use client";

import { useEffect } from "react";
import { BOTAO_PRIMARIO } from "@/components/ui/visual-tokens";

export default function ErroAuditoria({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na página de auditoria:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-brand-900">
          Não foi possível carregar a auditoria
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Ocorreu um erro inesperado. Tente novamente em instantes.
        </p>
        <button type="button" onClick={reset} className={`${BOTAO_PRIMARIO} mt-6`}>
          Tentar novamente
        </button>
      </main>
    </div>
  );
}
