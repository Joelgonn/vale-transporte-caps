"use client";

import { BADGE_NEUTRO, BADGE_SUCESSO } from "@/components/ui/visual-tokens";

export function UsuarioStatus({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <span className={BADGE_SUCESSO}>
      ATIVO
    </span>
  ) : (
    <span className={BADGE_NEUTRO}>
      INATIVO
    </span>
  );
}