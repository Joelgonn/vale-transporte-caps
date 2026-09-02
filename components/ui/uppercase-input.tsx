"use client";

import { INPUT } from "@/components/ui/visual-tokens";
import { useRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  id: string;
};

// Input que exibe e armazena em CAIXA ALTA para campos de identificação.
// Preserva posição do cursor ao transformar.
export function UppercaseInput({ id, label, className, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-zinc-600">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        {...props}
        className={`${INPUT} uppercase ${className ?? ""}`}
        onChange={(e) => {
          const start = e.target.selectionStart;
          const end = e.target.selectionEnd;
          const upper = e.target.value.toUpperCase();
          e.target.value = upper;
          // Restaura cursor
          requestAnimationFrame(() => {
            if (ref.current) ref.current.setSelectionRange(start, end);
          });
          onChange?.(e);
        }}
      />
    </div>
  );
}
