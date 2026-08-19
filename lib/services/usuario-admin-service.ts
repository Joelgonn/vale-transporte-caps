// Sprint 16 — Caso de uso de CRIAÇÃO COMPLETA de usuário (Auth + vínculo funcional).
//
// Fluxo (o ponto crítico da Sprint 16 — evitar Auth criado sem vínculo em
// public.usuarios):
//   1. validar dados (nome/e-mail/RN02) e verificar duplicidade de e-mail;
//   2. gerar senha temporária forte (nunca é gravada, logada ou persistida);
//   3. criar o usuário no Supabase Auth via Admin API (email_confirm: true);
//   4. capturar o UUID REAL retornado pelo Auth;
//   5. criar o vínculo em public.usuarios com esse auth_user_id;
//   6. se o vínculo falhar → COMPENSAÇÃO: remover o Auth recém-criado e
//      retornar erro seguro (Auth e public.usuarios nunca ficam inconsistentes).
//
// O INSERT em public.usuarios usa o client do usuário autenticado (RLS do
// Gestor) e NÃO o service role: assim o trigger de auditoria registra o Gestor
// real (auth.uid()) e as policies usuarios_insert_gestor continuam valendo.

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/domain/app-error";
import type { PerfilUsuario, Profissao } from "@/lib/domain/enums";
import { validarCriacaoUsuario } from "@/lib/domain/regras";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";
import {
  UsuarioRepositoryPostgres,
  type UsuarioRepository,
} from "@/lib/repositories/usuario-repository";

// Adaptador da Admin API — injetável para testes (mockado nos unit tests;
// SERVICE_ROLE_KEY real nunca aparece em testes).
export interface AdminAuthAdapter {
  criarUsuario(email: string, password: string): Promise<{ id: string }>;
  removerUsuario(id: string): Promise<void>;
  // Sprint 17 — marca o primeiro acesso do usuário como concluído
  // (app_metadata.precisa_trocar_senha=false). Somente a Admin API pode
  // escrever app_metadata; o cliente nunca consegue limpar esse flag.
  concluirPrimeiroAcesso(id: string): Promise<void>;
}

export class SupabaseAdminAuth implements AdminAuthAdapter {
  constructor(private readonly admin: SupabaseClient) {}

  async criarUsuario(email: string, password: string): Promise<{ id: string }> {
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // Sprint 17 — todo usuário criado pelo Gestor nasce em "primeiro acesso":
      // precisa trocar a senha temporária antes de entrar no dashboard. O flag
      // vive em app_metadata (não gravável pelo cliente, só via Admin API).
      app_metadata: { precisa_trocar_senha: true },
    });
    if (error) throw mapAdminAuthError(error);
    return { id: data.user.id };
  }

  async removerUsuario(id: string): Promise<void> {
    const { error } = await this.admin.auth.admin.deleteUser(id);
    if (error) throw mapAdminAuthError(error);
  }

  async concluirPrimeiroAcesso(id: string): Promise<void> {
    // Preserva app_metadata existente (provider/providers/etc.) — apenas limpa
    // o flag de primeiro acesso.
    const { data, error } = await this.admin.auth.admin.getUserById(id);
    if (error) throw mapAdminAuthError(error);
    const atual = (data.user.app_metadata ?? {}) as Record<string, unknown>;
    const { error: erro } = await this.admin.auth.admin.updateUserById(id, {
      app_metadata: { ...atual, precisa_trocar_senha: false },
    });
    if (erro) throw mapAdminAuthError(erro);
  }
}

// Traduz erros da Admin API para AppError com mensagens seguras (nunca a chave
// nem detalhes internos do Auth).
function mapAdminAuthError(error: {
  message?: string;
  status?: number;
  code?: string;
}): AppError {
  const message = error?.message ?? "";
  if (
    error?.code === "user_exists" ||
    error?.code === "email_exists" ||
    /already (been )?registered|already exists|already taken|já registrado|já existe/i.test(
      message
    )
  ) {
    return new AppError("VALIDACAO", "Já existe uma conta para este e-mail.");
  }
  if (
    /invalid.*email|email.*invalid|validation_failed/i.test(message)
  ) {
    return new AppError("VALIDACAO", "E-mail inválido para criação de acesso.");
  }
  if (/forbidden|denied|insufficient/i.test(message)) {
    return new AppError(
      "ACESSO_NEGADO",
      "Operação de provisionamento não permitida."
    );
  }
  return new AppError(
    "ERRO_INTERNO",
    "Não foi possível criar o acesso do usuário."
  );
}

// Senha temporária forte, aleatória (12 bytes → 16 caracteres base64url).
// Entregue ao Gestor UMA vez na tela de sucesso; não é armazenada em lugar
// algum (nem auth, que guarda apenas o hash, nem public.usuarios, nem logs).
export function gerarSenhaTemporaria(): string {
  return randomBytes(12).toString("base64url");
}

export class UsuarioAdminService {
  constructor(
    private readonly repo: UsuarioRepository,
    private readonly adminAuth: AdminAuthAdapter
  ) {}

  static async create(): Promise<UsuarioAdminService> {
    const { createClient } = await import("@/lib/supabase/server");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    return new UsuarioAdminService(
      new UsuarioRepositoryPostgres(await createClient()),
      new SupabaseAdminAuth(createAdminClient())
    );
  }

  async criarUsuarioCompleto(dados: {
    nome: string;
    email: string;
    perfil: PerfilUsuario;
    profissao?: Profissao | null;
  }): Promise<{ usuario: UsuarioFuncional; senhaTemporaria: string }> {
    const nome = String(dados.nome ?? "").trim();
    const email = String(dados.email ?? "").trim().toLowerCase();
    const perfil = dados.perfil;
    const profissao = dados.profissao ?? null;

    validarCriacaoUsuario({ nome, email, perfil, profissao });

    // Duplicidade em public.usuarios detectada ANTES de criar o Auth
    // (evita Auth órfão para um caso 100% previsível).
    const existente = await this.repo.buscarPorEmail(email);
    if (existente) {
      throw new AppError("VALIDACAO", "Já existe um usuário com este e-mail.");
    }

    const senhaTemporaria = gerarSenhaTemporaria();

    let authUserId: string;
    try {
      const criado = await this.adminAuth.criarUsuario(email, senhaTemporaria);
      authUserId = criado.id;
    } catch (erro) {
      // O adaptador mapeia para AppError; mesmo assim, nunca deixamos um erro
      // cru (gotrue/SQL) vazar para a UI — sempre AppError com mensagem segura.
      if (erro instanceof AppError) throw erro;
      throw mapAdminAuthError(
        erro as { message?: string; status?: number; code?: string }
      );
    }

    try {
      const usuario = await this.repo.criar({
        auth_user_id: authUserId,
        nome,
        email,
        perfil,
        profissao,
        unidade_id: null,
      });
      return { usuario, senhaTemporaria };
    } catch (erro) {
      // Falha parcial: o Auth foi criado mas o vínculo não. COMPENSAÇÃO.
      const compensou = await this.compensarCriacaoAuth(authUserId);
      if (erro instanceof AppError && erro.code === "VALIDACAO") {
        throw new AppError(
          "VALIDACAO",
          "Já existe um usuário com este e-mail."
        );
      }
      throw new AppError(
        "ERRO_INTERNO",
        compensou
          ? "Não foi possível concluir o cadastro. Nenhum acesso foi mantido."
          : "Não foi possível concluir o cadastro. Procure a gestão do CAPS."
      );
    }
  }

  // Melhor esforço: remove o Auth recém-criado. Se falhar, o erro ainda é
  // seguro e o usuário Auth fica SEM vínculo — nunca enganosamente ativo.
  private async compensarCriacaoAuth(authUserId: string): Promise<boolean> {
    try {
      await this.adminAuth.removerUsuario(authUserId);
      return true;
    } catch {
      return false;
    }
  }
}
