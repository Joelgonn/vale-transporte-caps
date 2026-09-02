"use client";
import { CONTAINER, CARTAO, BOTAO_PRIMARIO } from "@/components/ui/visual-tokens";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col py-8">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <div className={`${CARTAO} p-6`}>
          <h2 className="text-lg font-semibold text-brand-900">Erro no atendimento</h2>
          <p className="mt-1 text-sm text-zinc-500">Tente novamente.</p>
          {error?.message && <p className="mt-2 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-600">{error.message}</p>}
          <button type="button" onClick={() => reset()} className={`${BOTAO_PRIMARIO} mt-4`}>Tentar novamente</button>
        </div>
      </div>
    </div>
  );
}
