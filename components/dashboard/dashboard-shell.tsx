"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import LogoutButton from "@/app/dashboard/logout-button";
import {
  ICONE_DASHBOARD,
  ICONES_MODULO,
} from "@/components/dashboard/icones";
import { MarcaIcone, MarcaSistema } from "@/components/ui/marca";
import {
  CARTAO,
  CHIP,
  CONTEINER_PAINEL,
  NAV_LINK,
  NAV_LINK_ATIVO,
} from "@/components/ui/visual-tokens";
import { ROTULO_PERFIL, type PerfilUsuario } from "@/lib/domain/enums";
import { capacidadeDashboard, estadoUsuario } from "@/lib/domain/regras";
import {
  moduloAtual,
  modulosPorCapacidade,
} from "@/components/dashboard/navegacao";

type DashboardShellProps = {
  email: string;
  perfil: PerfilUsuario | null;
  statusAtivo: boolean | null;
  children: ReactNode;
};

type ItemNav = { href: string; label: string; ativo: boolean; icone: ReactNode };

export default function DashboardShell({
  email,
  perfil,
  statusAtivo,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const menuId = useId();
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoMenuRef = useRef<HTMLButtonElement>(null);
  const fecharMenuRef = useRef<HTMLButtonElement>(null);
  const focoOrigemRef = useRef<HTMLElement | null>(null);

  const estado = estadoUsuario(perfil, statusAtivo);
  const rotulo = perfil ? ROTULO_PERFIL[perfil] : null;
  const capacidade = capacidadeDashboard(perfil, statusAtivo);
  const modulos = modulosPorCapacidade(capacidade);
  const moduloAtualBc = moduloAtual(pathname, capacidade);

  function abrirMenu() {
    focoOrigemRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMenuAberto(true);
  }

  function fecharMenu() {
    setMenuAberto(false);
  }

  useEffect(() => {
    if (menuAberto) {
      fecharMenuRef.current?.focus();
      return;
    }
    if (focoOrigemRef.current) {
      focoOrigemRef.current.focus();
      focoOrigemRef.current = null;
    }
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto) return;
    function aoTeclarEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuAberto(false);
    }
    window.addEventListener("keydown", aoTeclarEscape);
    return () => window.removeEventListener("keydown", aoTeclarEscape);
  }, [menuAberto]);

  const ehAtivo = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const itens: ItemNav[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      ativo: ehAtivo("/dashboard"),
      icone: ICONE_DASHBOARD,
    },
    ...modulos.map((modulo) => ({
      href: modulo.href,
      label: modulo.rotulo,
      ativo: ehAtivo(modulo.href),
      icone: ICONES_MODULO[modulo.slug],
    })),
  ];

  function classeLink(item: ItemNav) {
    return `group ${item.ativo ? NAV_LINK_ATIVO : NAV_LINK}`;
  }

  function navegacao(aoNavegar?: () => void) {
    return (
      <nav aria-label="Navegação principal">
        <ul className="flex flex-col gap-1">
          {itens.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={aoNavegar}
                aria-current={item.ativo ? "page" : undefined}
                className={classeLink(item)}
              >
                {item.ativo && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent-400"
                  />
                )}
                <span
                  className={`shrink-0 transition-all duration-150 ease-out ${
                    item.ativo
                      ? "text-white"
                      : "text-zinc-400 group-hover:translate-x-0.5 group-hover:text-brand-700 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  }`}
                >
                  {item.icone}
                </span>
                <span className="min-w-0 flex-1">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  function resumoConta() {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-brand-900">{rotulo ?? "Usuário"}</p>
          <p className="truncate text-xs text-zinc-500">{email}</p>
          {rotulo && (
            <p className="text-xs text-zinc-500">
              {estado === "ativo"
                ? "Ativo"
                : estado === "inativo"
                  ? "Inativo"
                  : "Sem perfil funcional"}
            </p>
          )}
        </div>
        <LogoutButton />
      </div>
    );
  }

  function breadcrumb() {
    if (!moduloAtualBc) return null;
    return (
      <nav
        aria-label="Navegação estrutural"
        className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6"
      >
        <ol className="flex items-center gap-2 text-sm text-zinc-500">
          <li>
            <Link
              href="/dashboard"
              className="font-medium text-accent-600 underline-offset-2 transition-colors hover:text-accent-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              Dashboard
            </Link>
          </li>
          {moduloAtualBc && (
            <li className="flex min-w-0 items-center gap-2" aria-current="page">
              <span aria-hidden="true" className="text-zinc-300">
                /
              </span>
              <span className="truncate font-medium text-brand-900">
                {moduloAtualBc.rotulo}
              </span>
            </li>
          )}
        </ol>
      </nav>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-900/[0.06] bg-white/85 backdrop-blur-md">
        <div
          aria-hidden="true"
          className="h-0.5 bg-gradient-to-r from-brand-700 via-accent-500 to-green-500"
        />
        <div className={`${CONTEINER_PAINEL} flex h-16 items-center justify-between gap-3`}>
          <div className="flex min-w-0 items-center gap-1">
            <button
              ref={botaoMenuRef}
              type="button"
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              aria-controls={menuId}
              onClick={abrirMenu}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-accent-50 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <MarcaSistema href="/dashboard" />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {rotulo && (
              <span className="hidden sm:inline-flex">
                <span className={CHIP}>{rotulo}</span>
              </span>
            )}
            <span className="hidden max-w-48 truncate text-sm text-zinc-500 md:inline">
              {email}
            </span>
          </div>
        </div>
      </header>

      <div className={`${CONTEINER_PAINEL} flex flex-1 gap-6 py-6`}>
        <aside className="sticky top-[5.5rem] hidden h-max shrink-0 flex-col gap-4 lg:flex">
          <nav aria-label="Navegação principal" className={`w-60 p-2.5 ${CARTAO}`}>
            <ul className="flex flex-col gap-1">
              {itens.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.ativo ? "page" : undefined}
                    className={classeLink(item)}
                  >
                    {item.ativo && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent-400"
                      />
                    )}
                    <span
                      className={`shrink-0 transition-colors ${
                        item.ativo
                          ? "text-white"
                          : "text-zinc-400 group-hover:text-brand-700"
                      }`}
                    >
                      {item.icone}
                    </span>
                    <span className="min-w-0 flex-1">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={`mt-auto w-60 p-4 ${CARTAO}`}>{resumoConta()}</div>
        </aside>

        <main className="min-w-0 flex-1 flex-col">
          {breadcrumb()}
          {children}
        </main>
      </div>

      {menuAberto && (
        <div
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          className="fixed inset-0 z-40 lg:hidden"
        >
          <button
            type="button"
            aria-hidden="true"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={fecharMenu}
            className="absolute inset-0 bg-zinc-950/30 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-xl ring-1 ring-zinc-900/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <MarcaIcone className="h-8 w-8" />
                <p className="truncate text-sm font-bold text-brand-950">
                  Vale Transporte CAPS
                </p>
              </div>
              <button
                ref={fecharMenuRef}
                type="button"
                aria-label="Fechar menu"
                onClick={fecharMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-accent-50 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {navegacao(fecharMenu)}
            <div className="flex flex-1" />
            <div className="border-t border-zinc-900/[0.06] pt-4">{resumoConta()}</div>
          </div>
        </div>
      )}
    </div>
  );
}