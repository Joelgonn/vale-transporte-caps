import type { ReactNode } from "react";

// Feedback de sucesso/erro (Sprint 23) — padrão único em todas as jornadas.
// Sucesso usa role="status" (aria-live polido implícito); erro usa role="alert"
// (live assertivo). Nenhuma mensagem fica só na cor: sempre acompanhada de
// rótulo textual legível.
export function FeedbackSucesso({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
    >
      {children}
    </p>
  );
}

export function FeedbackErro({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {children}
    </p>
  );
}