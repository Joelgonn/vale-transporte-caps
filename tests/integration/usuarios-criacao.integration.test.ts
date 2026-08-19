// Testes de INTEGRAÇÃO — criação de usuário Auth + vínculo funcional (Sprint 16).
//
// Exercitam o fluxo REAL contra o Supabase usando o próprio caso de uso de
// produção (UsuarioAdminService: Admin API + INSERT em public.usuarios com RLS
// do Gestor). São ENV-GUARDED (describe.skipIf) e NUNCA criam usuários que
// acumulam: cada usuário criado pelo teste é removido no `finally` (primeiro a
// linha de public.usuarios — a FK auth.users é ON DELETE RESTRICT — e depois o
// usuário em auth.users). A SERVICE_ROLE_KEY aparece AQUI apenas como
// credencial de provisionamento/limpeza do teste, nunca em unit tests.
//
// Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY e as credenciais do gestor de teste (TEST_GESTOR_*).
//
// Sprint 37 — Fase A: uma ÚNICA sessão por perfil é criada no `beforeAll`
// (helpers/supabase-clients.ts) e reutilizada por todos os testes — 2 signIns
// no lugar de 5.

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS, PROFISSOES } from "@/lib/domain/enums";
import {
  SupabaseAdminAuth,
  UsuarioAdminService,
} from "@/lib/services/usuario-admin-service";
import { UsuarioRepositoryPostgres } from "@/lib/repositories/usuario-repository";
import {
  adminClient,
  clientesPorPerfil,
  credencialPerfilPresente,
  credenciaisPublicasPresentes,
} from "../helpers/supabase-clients";

const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const habilitado = Boolean(
  credenciaisPublicasPresentes() &&
    serviceRole &&
    credencialPerfilPresente("gestor") &&
    credencialPerfilPresente("recepcionista")
);

let gestor: SupabaseClient;
let recepcionista: SupabaseClient;

beforeAll(async () => {
  const clientes = await clientesPorPerfil(["gestor", "recepcionista"]);
  gestor = clientes.gestor!;
  recepcionista = clientes.recepcionista!;
});

async function limparUsuario(admin: SupabaseClient, authUserId: string) {
  // Ordem importa: FK auth.users é ON DELETE RESTRICT — remove a linha antes.
  const { error: delRow } = await admin
    .from("usuarios")
    .delete()
    .eq("auth_user_id", authUserId);
  if (delRow) throw delRow;
  const { error: delAuth } = await admin.auth.admin.deleteUser(authUserId);
  if (delAuth) throw delAuth;
}

describe.skipIf(!habilitado)("Integração — criação de usuário Auth (Sprint 16)", () => {
  it("gestor ativo cria usuário: auth_user_id real, vínculo, perfil, status e senha 1x", async () => {
    const admin = adminClient();
    const service = new UsuarioAdminService(
      new UsuarioRepositoryPostgres(gestor),
      new SupabaseAdminAuth(admin)
    );
    const email = `criacao.integracao.${randomUUID()}@caps.local`;
    let authUserId: string | null = null;

    try {
      const resultado = await service.criarUsuarioCompleto({
        nome: "Usuário de Integração",
        email,
        perfil: PERFIS.RECEPCIONISTA,
        profissao: null,
      });

      authUserId = resultado.usuario.auth_user_id;

      expect(resultado.senhaTemporaria).toHaveLength(16);
      expect(resultado.usuario.email).toBe(email);
      expect(resultado.usuario.perfil).toBe(PERFIS.RECEPCIONISTA);
      expect(resultado.usuario.status_ativo).toBe(true);

      // A senha temporária NÃO aparece em public.usuarios (nenhum campo de senha).
      const { data: linha, error } = await admin
        .from("usuarios")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(linha).not.toBeNull();
      expect(linha).not.toHaveProperty("senha");
      expect(linha).not.toHaveProperty("password");
      expect(String(linha!.auth_user_id)).toBe(authUserId);
    } finally {
      if (authUserId) await limparUsuario(admin, authUserId);
    }
  });

  it("e-mail já vinculado em public.usuarios é barrado antes de criar o Auth", async () => {
    const admin = adminClient();
    const service = new UsuarioAdminService(
      new UsuarioRepositoryPostgres(gestor),
      new SupabaseAdminAuth(admin)
    );

    const recepcionistaEmail = process.env.TEST_RECEPCIONISTA_EMAIL!;
    const erro = await service
      .criarUsuarioCompleto({
        nome: "Duplicado",
        email: recepcionistaEmail,
        perfil: PERFIS.RECEPCIONISTA,
        profissao: null,
      })
      .then(() => null, (e: unknown) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).code).toBe("VALIDACAO");
    expect((erro as AppError).message).toContain("e-mail");
  });

  it("e-mail duplicado no Auth vira mensagem segura (sem vínculo criado)", async () => {
    const admin = adminClient();
    const service = new UsuarioAdminService(
      new UsuarioRepositoryPostgres(gestor),
      new SupabaseAdminAuth(admin)
    );
    // O usuário sem vínculo existe NO AUTH mas NÃO em public.usuarios: passa na
    // checagem de duplicidade de vínculo e exercita o erro real do Auth.
    const semVinculoEmail = process.env.TEST_SEM_VINCULO_EMAIL!;
    const erro = await service
      .criarUsuarioCompleto({
        nome: "Duplicado no Auth",
        email: semVinculoEmail,
        perfil: PERFIS.RECEPCIONISTA,
        profissao: null,
      })
      .then(() => null, (e: unknown) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).code).toBe("VALIDACAO");
    expect((erro as AppError).message).toContain("Já existe uma conta");
  });

  it("autorizador/recepcionista NÃO cria vínculo (RLS usuarios_insert_gestor)", async () => {
    const repo = new UsuarioRepositoryPostgres(recepcionista);

    const erro = await repo
      .criar({
        auth_user_id: randomUUID(),
        nome: "Invasora",
        email: `inv.${randomUUID()}@caps.local`,
        perfil: PERFIS.RECEPCIONISTA,
        profissao: null,
      })
      .then(() => null, (e: unknown) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).code).toBe("ACESSO_NEGADO");
  });

  it("autorizador com profissão pode ser criado pelo gestor", async () => {
    const admin = adminClient();
    const service = new UsuarioAdminService(
      new UsuarioRepositoryPostgres(gestor),
      new SupabaseAdminAuth(admin)
    );
    const email = `criacao.autorizador.${randomUUID()}@caps.local`;
    let authUserId: string | null = null;

    try {
      const resultado = await service.criarUsuarioCompleto({
        nome: "Autorizadora de Teste",
        email,
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: PROFISSOES.PSICOLOGO,
      });
      authUserId = resultado.usuario.auth_user_id;

      expect(resultado.usuario.perfil).toBe(PERFIS.PROFISSIONAL_AUTORIZADOR);
      expect(resultado.usuario.profissao).toBe(PROFISSOES.PSICOLOGO);
    } finally {
      if (authUserId) await limparUsuario(admin, authUserId);
    }
  });
});