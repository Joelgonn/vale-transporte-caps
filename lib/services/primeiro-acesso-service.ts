// Sprint 17 — Primeiro acesso: troca obrigatória da senha temporária.
//
// Estratégia de segurança (documentada em SECURITY.md):
//   * o estado de "primeiro acesso pendente" vive em `app_metadata.precisa_trocar_senha`
//     no Supabase Auth — NÃO em user_metadata (gravável pelo próprio cliente) e
//     NÃO em banco próprio (nenhuma migration/RLS nova);
//   * a limpeza do flag só é possível via Admin API (server-only, SERVICE_ROLE);
//   * a nova senha vai SOMENTE ao Supabase Auth (`auth.updateUser`) — nunca é
//     persistida pela aplicação, nunca vai a public.usuarios, nunca é logada,
//     nunca aparece em URL/localStorage/sessionStorage;
//   * após a troca, a sessão é renovada (`refreshSession`) para os tokens
//     refletirem o flag limpo.

import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/domain/app-error";
import { validarTrocaDeSenha } from "@/lib/domain/regras";
import type { AdminAuthAdapter } from "@/lib/services/usuario-admin-service";

// Mapeia erros do `auth.updateUser` (gotrue) para mensagens seguras — nunca
// revela detalhes internos/SQL/tokens.
function mapTrocaSenhaError(error: unknown): AppError {
  const e = error as { code?: string; status?: number; message?: string } | null;
  const code = e?.code ?? "";
  const status = e?.status ?? 0;
  const message = e?.message ?? "";

  if (/weak_password/i.test(code) || /weak|muito fraca|minimum/i.test(message)) {
    return new AppError(
      "VALIDACAO",
      "A nova senha é muito fraca. Escolha uma senha mais forte."
    );
  }
  if (
    /over_request_rate_limit/i.test(code) ||
    status === 429 ||
    /rate limit/i.test(message)
  ) {
    return new AppError(
      "VALIDACAO",
      "Muitas tentativas seguidas. Aguarde um instante e tente novamente."
    );
  }
  return new AppError(
    "ERRO_INTERNO",
    "Não foi possível alterar a senha agora. Tente novamente em instantes."
  );
}

export class PrimeiroAcessoService {
  constructor(
    private readonly supabase: Pick<SupabaseClient, "auth">,
    private readonly adminAuth: AdminAuthAdapter
  ) {}

  static async create(): Promise<PrimeiroAcessoService> {
    const { createClient } = await import("@/lib/supabase/server");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { SupabaseAdminAuth } = await import(
      "@/lib/services/usuario-admin-service"
    );
    return new PrimeiroAcessoService(
      await createClient(),
      new SupabaseAdminAuth(createAdminClient())
    );
  }

  async trocarSenha(dados: {
    novaSenha: string;
    confirmacao: string;
  }): Promise<void> {
    validarTrocaDeSenha({
      novaSenha: String(dados.novaSenha ?? ""),
      confirmacao: String(dados.confirmacao ?? ""),
    });

    const {
      data: { user },
      error: erroUsuario,
    } = await this.supabase.auth.getUser();
    if (erroUsuario || !user) {
      throw new AppError("ACESSO_NEGADO", "Sessão não autenticada.");
    }

    // 1. Troca da senha — somente ao Supabase Auth (a aplicação não conhece a
    //    nova senha após esta chamada; nada é persistido/logado).
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: dados.novaSenha,
      });
      if (error) throw error;
    } catch (erro) {
      throw mapTrocaSenhaError(erro);
    }

    // 2. Marca o primeiro acesso como concluído (app_metadata via Admin API).
    //    Só após a senha ter sido trocada com sucesso: nunca limpamos o flag se
    //    a troca falhar (o usuário não pode "pular" o primeiro acesso).
    try {
      await this.adminAuth.concluirPrimeiroAcesso(user.id);
    } catch (erro) {
      if (erro instanceof AppError) throw erro;
      throw new AppError(
        "ERRO_INTERNO",
        "Não foi possível concluir o primeiro acesso. Tente novamente."
      );
    }

    // 3. Renova a sessão para os tokens refletirem o flag limpo (a sessão atual
    //    do cliente ainda carregava app_metadata com precisar trocar = true).
    const { error: erroRefresh } = await this.supabase.auth.refreshSession();
    if (erroRefresh) {
      throw new AppError(
        "ERRO_INTERNO",
        "Não foi possível concluir o primeiro acesso. Entre novamente."
      );
    }
  }
}
