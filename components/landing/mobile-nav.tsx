"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { MarcaIcone } from "@/components/ui/marca";
import { BOTAO_PRIMARIO, NAV_LINK } from "@/components/ui/visual-tokens";

// Identidade institucional Sprint 29 — Drawer Mobile.
// Mesma linguagem visual da Landing (marca, superfícies leves e paleta
// brand/accent). Mantém os contratos de acessibilidade testados: "Abrir menu",
// dialog "Menu de navegação", "Fechar menu" e âncoras das seções.

const ITENS = [
  { href: "#organiza", label: "O que organiza" },
  { href: "#fluxo", label: "Como funciona" },
  { href: "#seguranca", label: "Controle e segurança" },
  { href: "#fluxo", label: "Fluxo" },
];

export default function MobileNav() {
  const menuId = useId();
  const [aberto, setAberto] = useState(false);

  // Trava o scroll do body enquanto o menu estiver aberto
  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclarEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", aoTeclarEscape);
    return () => window.removeEventListener("keydown", aoTeclarEscape);
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={aberto}
        aria-controls={menuId}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-600 ring-1 ring-zinc-900/10 transition-all hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h12M4 17h16" />
        </svg>
      </button>

      {aberto && (
        <div
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          className="fixed inset-0 z-50 md:hidden"
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-zinc-950/30 backdrop-blur-sm"
            aria-label="Fechar fundo do menu"
          />

          <div className="absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl ring-1 ring-zinc-900/[0.06]">
            <div className="flex items-center justify-between border-b border-zinc-900/[0.06] p-5">
              <div className="flex items-center gap-2.5">
                <MarcaIcone className="h-8 w-8" />
                <p className="text-sm font-bold tracking-tight text-brand-950">
                  Vale Transporte CAPS
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setAberto(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 px-3 py-5">
              <nav aria-label="Navegação da página mobile">
                <ul className="flex flex-col gap-1">
                  {ITENS.map((item) => (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        onClick={() => setAberto(false)}
                        className={`${NAV_LINK} flex items-center justify-between`}
                      >
                        {item.label}
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div className="border-t border-zinc-900/[0.06] bg-zinc-50/60 p-5">
              <Link
                href="/login"
                onClick={() => setAberto(false)}
                className={`${BOTAO_PRIMARIO} flex w-full justify-center`}
              >
                Entrar no sistema
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
