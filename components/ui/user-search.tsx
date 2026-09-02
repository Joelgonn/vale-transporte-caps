"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { listarUsuariosAction } from "@/app/actions/usuarios";
import { ROTULO_PERFIL } from "@/lib/domain/enums";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";
import { INPUT } from "@/components/ui/visual-tokens";
import { FeedbackErro } from "@/components/ui/feedback";

type Props = {
  id?: string;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  defaultValue?: string;
  onSelect: (usuario: UsuarioFuncional) => void;
};

export function UserSearch({
  id = "user-search",
  label = "Buscar usuário",
  placeholder = "🔎 Nome ou e-mail...",
  autoFocus = false,
  defaultValue = "",
  onSelect,
}: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [resultados, setResultados] = useState<UsuarioFuncional[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const lastIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2) {
      setResultados(null);
      setMostrar(false);
      setBuscando(false);
      setErro(null);
      return;
    }
    const myId = ++lastIdRef.current;
    setBuscando(true);
    setErro(null);
    const t = setTimeout(() => {
      listarUsuariosAction(termo).then((res) => {
        if (myId !== lastIdRef.current) return;
        setBuscando(false);
        if (!res.ok) {
          setErro(res.error);
          setResultados(null);
          setMostrar(true);
          return;
        }
        setResultados(res.data);
        setMostrar(true);
        setAtivo(-1);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  function selecionar(u: UsuarioFuncional) {
    onSelect(u);
    setQuery("");
    setResultados(null);
    setMostrar(false);
    setAtivo(-1);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-zinc-600">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={`${id}-list`}
          aria-activedescendant={ativo >= 0 && resultados?.[ativo] ? `usuario-${resultados[ativo].id}` : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMostrar(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2 && resultados) setMostrar(true);
          }}
          onBlur={() => setTimeout(() => setMostrar(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtivo((i) => Math.min((resultados?.length ?? 1) - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((i) => Math.max(-1, i - 1));
            } else if (e.key === "Enter") {
              if (ativo >= 0 && resultados?.[ativo]) {
                e.preventDefault();
                selecionar(resultados[ativo]);
              }
            } else if (e.key === "Escape") {
              setMostrar(false);
              setAtivo(-1);
            }
          }}
          placeholder={placeholder}
          className={INPUT}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        {buscando && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">Buscando...</span>}
        {mostrar && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-zinc-200 bg-white shadow-lg"
          >
            {buscando ? (
              <li className="px-4 py-3 text-sm text-zinc-500">Buscando...</li>
            ) : erro ? (
              <li className="px-4 py-3">
                <FeedbackErro>{erro}</FeedbackErro>
              </li>
            ) : resultados && resultados.length === 0 ? (
              <li className="px-4 py-3">
                <p className="text-sm font-medium text-zinc-700">Nenhum usuário encontrado</p>
                <p className="text-xs text-zinc-500">Verifique o nome ou e-mail.</p>
              </li>
            ) : resultados && resultados.length > 0 ? (
              resultados.map((u, idx) => {
                const isAtivo = idx === ativo;
                return (
                  <li key={u.id} id={`usuario-${u.id}`} role="option" aria-selected={isAtivo}>
                    <button
                      type="button"
                      onMouseEnter={() => setAtivo(idx)}
                      onClick={() => selecionar(u)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left ${isAtivo ? "bg-brand-50" : "hover:bg-zinc-50"}`}
                    >
                      <span className="text-sm font-medium text-brand-900">{u.nome}</span>
                      <span className="text-xs text-zinc-500">
                        {u.email} · {ROTULO_PERFIL[u.perfil] ?? u.perfil}
                      </span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-3 text-sm text-zinc-500">Digite pelo menos 2 caracteres.</li>
            )}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-zinc-500">Digite nome ou e-mail. A seleção filtra por ID.</p>
    </div>
  );
}
