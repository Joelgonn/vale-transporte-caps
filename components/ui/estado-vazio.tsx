import type { ReactNode } from "react";

// Estado vazio (Sprint 23) — bloco tracejado padrão usado nas três jornadas
// quando a listagem não tem registros (sem busca ou sem resultado de busca).
export function EstadoVazio({
  mensagem,
  acao,
}: {
  mensagem: string;
  acao?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-16 text-center">
      <p className="text-sm text-zinc-500">{mensagem}</p>
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>  );
}