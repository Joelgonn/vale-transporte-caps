"use server";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/domain/app-error";

export type TrocarSenhaState = {
  error?: string;
};

// Sprint 17 — troca obrigatória de senha no primeiro acesso. A action revalida
// no servidor (mesmas regras da UI), envia a nova senha SOMENTE ao Supabase Auth
// e só então limpa o flag de primeiro acesso (app_metadata via Admin API).
// A senha nunca é persistida/logada/colocada em URL; o redirect ocorre fora do
// try/catch (regra do Next: redirect lança para interromper o render).
export async function trocarSenhaPrimeiroAcesso(
  _prevState: TrocarSenhaState,
  formData: FormData
): Promise<TrocarSenhaState> {
  const novaSenha = formData.get("novaSenha");
  const confirmacao = formData.get("confirmacao");

  if (typeof novaSenha !== "string" || typeof confirmacao !== "string") {
    return { error: "Informe e confirme a nova senha." };
  }

  try {
    const { PrimeiroAcessoService } = await import(
      "@/lib/services/primeiro-acesso-service"
    );
    const service = await PrimeiroAcessoService.create();
    await service.trocarSenha({ novaSenha, confirmacao });
  } catch (erro) {
    return {
      error:
        erro instanceof AppError
          ? erro.message
          : "Não foi possível concluir. Tente novamente em instantes.",
    };
  }

  redirect("/dashboard");
}
