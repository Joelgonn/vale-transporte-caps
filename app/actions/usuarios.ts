"use server";

import { AppError } from "@/lib/domain/app-error";
import {
  PERFIS,
  type PerfilUsuario,
  type Profissao,
} from "@/lib/domain/enums";
import type { NovoUsuario, UsuarioFuncional } from "@/lib/domain/usuarios/types";
import { getUsuarioFuncional } from "@/lib/auth/profile";
import { UsuarioService } from "@/lib/services/usuario-service";
import type { AcaoResultado } from "@/app/actions/resultado";

// Dados aceitos do cliente para criar um usuário completo. O auth_user_id NUNCA
// vem do browser: ele é capturado do retorno real da Admin API no servidor.
export type CriarUsuarioCompletoDados = {
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  profissao: Profissao | null;
};

export type CriarUsuarioCompletoResultado = {
  usuario: UsuarioFuncional;
  senhaTemporaria: string;
};

// Só mensagens de domínio (AppError) são exibíveis. Qualquer erro não mapeado
// vira mensagem genérica — SQLSTATE/stack/RLS nunca chegam à UI.
function mensagemDaAcao(erro: unknown): string {
  return erro instanceof AppError
    ? erro.message
    : "Ocorreu um erro inesperado.";
}

// Autorização explícita no servidor: somente o Gestor ATIVO gerencia usuários.
// Não é a autoridade de segurança (o banco/RLS é), mas evita consulta e bloqueia
// perfis que não têm permissão por policy. Usuário inativo/sem vínculo é
// bloqueado também aqui (perfil_atual()/usuario_ativo_atual() via infra real).
async function exigeGestorAtivo(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("ACESSO_NEGADO", "Sessão não autenticada.");
  }

  const usuario = await getUsuarioFuncional(supabase, user);
  if (usuario?.perfil !== PERFIS.GESTOR || usuario.statusAtivo !== true) {
    throw new AppError(
      "ACESSO_NEGADO",
      "Somente o Gestor ativo pode gerenciar usuários."
    );
  }
}

export async function listarUsuariosAction(
  busca?: string
): Promise<AcaoResultado<UsuarioFuncional[]>> {
  try {
    await exigeGestorAtivo();
    const service = await UsuarioService.create();
    return { ok: true, data: await service.listarUsuarios(busca) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

export async function criarUsuarioFuncionalAction(
  dados: NovoUsuario
): Promise<AcaoResultado<UsuarioFuncional>> {
  try {
    await exigeGestorAtivo();
    const service = await UsuarioService.create();
    return { ok: true, data: await service.criarUsuarioFuncional(dados) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

// Sprint 16 — criação COMPLETA: Auth (Admin API server-only) + vínculo em
// public.usuarios. A autorização é verificada aqui no servidor (identidade,
// perfil e status ativo); a Admin API e a SERVICE_ROLE_KEY nunca atravessam a
// fronteira client/server.
export async function criarUsuarioCompletoAction(
  dados: CriarUsuarioCompletoDados
): Promise<AcaoResultado<CriarUsuarioCompletoResultado>> {
  try {
    await exigeGestorAtivo();
    const { UsuarioAdminService } = await import(
      "@/lib/services/usuario-admin-service"
    );
    const service = await UsuarioAdminService.create();
    return { ok: true, data: await service.criarUsuarioCompleto(dados) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

export async function ativarUsuarioAction(
  id: string
): Promise<AcaoResultado<UsuarioFuncional>> {
  try {
    await exigeGestorAtivo();
    const service = await UsuarioService.create();
    return { ok: true, data: await service.ativarUsuario(id) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}

export async function inativarUsuarioAction(
  id: string
): Promise<AcaoResultado<UsuarioFuncional>> {
  try {
    await exigeGestorAtivo();
    const service = await UsuarioService.create();
    return { ok: true, data: await service.inativarUsuario(id) };
  } catch (erro) {
    return { ok: false, error: mensagemDaAcao(erro) };
  }
}