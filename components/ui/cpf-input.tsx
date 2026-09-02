"use client";

import { useRef } from "react";
import { INPUT } from "@/components/ui/visual-tokens";
import { formatCpf, normalizeCpf } from "@/lib/domain/identificacao/cpf";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (canonico: string, formatado: string) => void;
  id: string;
  label?: string;
};

// Input de CPF com máscara visual 000.000.000-00, limite 11 dígitos,
// colagem com ou sem máscara, cursor preservado.
export function CpfInput({ value, onValueChange, id, label, className, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const canonico = normalizeCpf(value);
  const formatado = formatCpf(canonico);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const digits = normalizeCpf(raw);
    const formatted = formatCpf(digits);
    // Preserva cursor de forma simples: coloca no fim após formatação
    // (suficiente para CPF, evita complexidade de máscara progressiva com cursor no meio)
    onValueChange(digits, formatted);
    requestAnimationFrame(() => {
      if (ref.current) {
        const len = formatted.length;
        ref.current.setSelectionRange(len, len);
      }
    });
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const digits = normalizeCpf(pasted);
    onValueChange(digits, formatCpf(digits));
  }

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
        type="text"
        inputMode="numeric"
        value={formatado}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder="000.000.000-00"
        maxLength={14}
        className={`${INPUT} ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}
