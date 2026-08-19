"use client";

import { logout } from "@/app/actions/auth";
import { BOTAO_PRIMARIO } from "@/components/ui/visual-tokens";

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => logout()}
      className={`${BOTAO_PRIMARIO} h-10 w-full px-4`}
    >
      Sair
    </button>
  );
}