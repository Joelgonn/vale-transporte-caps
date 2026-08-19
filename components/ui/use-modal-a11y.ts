import { useEffect, useRef } from "react";

const SELETOR_FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Acessibilidade de diálogos de formulário (Sprint 23, trap de Tab na Sprint 28):
// foco no painel ao abrir, fechamento por Escape, ciclo de Tab preso dentro do
// diálogo e restauração do foco ao gatilho no fechamento. Usado pelos quatro
// formulários das jornadas operacionais — comportamento igual, sem duplicar a
// lógica em cada um.
export function useModalA11y(onClose: () => void, fecharPorEsc = true) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const fecharPorEscRef = useRef(fecharPorEsc);
  const gatilhoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    fecharPorEscRef.current = fecharPorEsc;
  });

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      gatilhoRef.current = document.activeElement;
    }
    ref.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      gatilhoRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        if (!fecharPorEscRef.current) return;
        evento.preventDefault();
        onCloseRef.current();
        return;
      }
      if (evento.key !== "Tab") return;
      const painel = ref.current;
      if (!painel) return;
      const focaveis = Array.from(
        painel.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS)
      );
      if (focaveis.length === 0) {
        evento.preventDefault();
        painel.focus();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (evento.shiftKey) {
        if (ativo === primeiro || !painel.contains(ativo)) {
          evento.preventDefault();
          ultimo.focus();
        }
      } else {
        if (ativo === ultimo || !painel.contains(ativo)) {
          evento.preventDefault();
          primeiro.focus();
        }
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return ref;
}