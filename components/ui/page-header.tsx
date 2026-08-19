import type { ReactNode } from "react";

// Cabeçalho de página (Sprint 23) — título + descrição + ação principal, padrão
// único para as jornadas operacionais (Pacientes/Liberações/Retiradas). Não é
// componente genérico de abstração: existe porque o mesmo bloco se repete.
export function PageHeader({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">{titulo}</h1>
        <p className="mt-1.5 text-sm text-zinc-500 sm:text-base">{descricao}</p>
      </div>
      {acao}
    </div>
  );
}
