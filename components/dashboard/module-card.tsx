import Link from "next/link";
import type { ReactNode } from "react";
import { CardGlow } from "@/components/ui/card-glow";
import {
  CARTAO,
  CARTAO_INTERATIVO,
} from "@/components/ui/visual-tokens";

type ModuleCardProps = {
  href: string;
  titulo: string;
  descricao: string;
  icone: ReactNode;
  destaque?: boolean;
};

// Módulos do dashboard (Sprint 30) com microinterações (Sprint 33). A variante
// "destaque" — aplicada ao primeiro módulo — cria hierarquia visual (superfície
// brand em gradiente, textos brancos), enquanto os demais permanecem superfícies
// brancas com tile neutro. Desde a Sprint 41 a estrutura da grade é uniforme:
// todos os cards ocupam uma única coluna de largura igual. Nenhuma métrica ou
// dado é inventado: apenas títulos, descrições e links reais. Todas as
// interações são pequenas (1–4px), respeitam prefers-reduced-motion e nunca
// animam o conteúdo.
export default function ModuleCard({
  href,
  titulo,
  descricao,
  icone,
  destaque = false,
}: ModuleCardProps) {
  if (destaque) {
    return (
      <Link
        href={href}
        className="group relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white shadow-[0_20px_45px_-20px_rgba(44,88,153,0.55)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_26px_50px_-20px_rgba(44,88,153,0.62)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-[0_20px_45px_-20px_rgba(44,88,153,0.55)]"
      >
        <CardGlow cor="accent" className="rounded-3xl" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl transition-transform duration-[250ms] ease-out group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-6 h-24 w-24 rounded-full border-[12px] border-white/10 transition-transform duration-[250ms] ease-out group-hover:-translate-y-2 group-hover:translate-x-2 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:-translate-y-0"
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
          {icone}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xl font-bold tracking-tight">{titulo}</p>
          <p className="max-w-md text-sm leading-6 text-brand-100">{descricao}</p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          Abrir
          <span
            aria-hidden="true"
            className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          >
            →
          </span>
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`group relative flex flex-col gap-4 p-5 ${CARTAO} ${CARTAO_INTERATIVO} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600`}
    >
      <CardGlow cor="accent" className="rounded-2xl" />
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-brand-700 ring-1 ring-zinc-900/[0.04] transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:bg-brand-50 group-hover:text-brand-800 group-hover:shadow-[0_8px_18px_-8px_rgba(44,88,153,0.35)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:shadow-none">
        {icone}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-brand-900 transition-colors duration-200 group-hover:text-brand-700">
          {titulo}
        </p>
        <p className="text-sm leading-6 text-zinc-600">{descricao}</p>
      </div>
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-600">
        Abrir
        <span
          aria-hidden="true"
          className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        >
          →
        </span>
      </p>
    </Link>
  );
}
