import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";
import type { AcaoResultado } from "@/app/actions/resultado";

type AuthSupabaseMock = ReturnType<typeof authSupabase>;

function authSupabase(user: { id: string; email: string } | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: null,
      })),
    },
  };
}

const { mocks, state } = vi.hoisted(() => ({
  mocks: {
    getUsuarioFuncional: vi.fn(),
    createUsuarioService: vi.fn(),
    createUsuarioAdminService: vi.fn(),
  },
  state: { supabase: null as AuthSupabaseMock | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => state.supabase ?? authSupabase(null)),
}));

vi.mock("@/lib/auth/profile", () => ({
  getUsuarioFuncional: (...args: unknown[]) => mocks.getUsuarioFuncional(...args),
}));

vi.mock("@/lib/services/usuario-service", () => ({
  UsuarioService: {
    create: (...args: unknown[]) => mocks.createUsuarioService(...args),
  },
}));

vi.mock("@/lib/services/usuario-admin-service", () => ({
  UsuarioAdminService: {
    create: (...args: unknown[]) => mocks.createUsuarioAdminService(...args),
  },
}));

import {
  criarUsuarioCompletoAction,
  criarUsuarioFuncionalAction,
  listarUsuariosAction,
} from "@/app/actions/usuarios";

function usuario(sobre?: Partial<UsuarioFuncional>): UsuarioFuncional {
  return {
    id: "u1",
    auth_user_id: "a1",
    nome: "João",
    email: "joao@example.com",
    perfil: PERFIS.RECEPCIONISTA,
    profissao: null,
    status_ativo: true,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

function usuarioServiceFake() {
  return {
    listarUsuarios: vi.fn(async () => [usuario()]),
    criarUsuarioFuncional: vi.fn(),
    ativarUsuario: vi.fn(),
    inativarUsuario: vi.fn(),
  };
}

function usuarioAdminServiceFake() {
  return {
    criarUsuarioCompleto: vi.fn(async () => ({
      usuario: usuario(),
      senhaTemporaria: "senha-temporaria-16ch",
    })),
  };
}

function comSessaoGestor() {
  state.supabase = authSupabase({ id: "auth-user-1", email: "gestor@example.com" });
}

describe("listarUsuariosAction — autorização de gestor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessaoGestor();
  });

  it("gestor ativo lista usuários via serviço", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: true });
    const fake = usuarioServiceFake();
    mocks.createUsuarioService.mockResolvedValue(fake);

    const resultado = await listarUsuariosAction("maria");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data).toHaveLength(1);
    expect(fake.listarUsuarios).toHaveBeenCalledWith("maria");
  });

  it("recepcionista ativa é BLOQUEADA mesmo chamando a action diretamente", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true });

    const resultado = await listarUsuariosAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Gestor");
    expect(mocks.createUsuarioService).not.toHaveBeenCalled();
  });

  it("usuário inativo é bloqueado", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: false });

    const resultado = await listarUsuariosAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Gestor");
  });

  it("usuário autenticado sem vínculo é bloqueado", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: null, statusAtivo: null });

    const resultado = await listarUsuariosAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Gestor");
  });

  it("sessão ausente é bloqueada", async () => {
    state.supabase = authSupabase(null);
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: null, statusAtivo: null });

    const resultado = await listarUsuariosAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("autenticada");
  });

  it("NÃO vaza SQL cru de erro desconhecido", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: true });
    const fake = usuarioServiceFake();
    fake.listarUsuarios.mockRejectedValue(
      new Error('syntax error at or near "select" — SQLSTATE 42601')
    );
    mocks.createUsuarioService.mockResolvedValue(fake);

    const resultado = await listarUsuariosAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).not.toMatch(/SQLSTATE|syntax error/);
      expect(resultado.error).toContain("inesperado");
    }
  });

  it("erro de domínio (AppError) é exibido como mensagem amigável", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: true });
    const fake = usuarioServiceFake();
    fake.listarUsuarios.mockRejectedValue(
      new AppError("ACESSO_NEGADO", "Você não tem permissão para executar esta operação.")
    );
    mocks.createUsuarioService.mockResolvedValue(fake);

    const resultado = await listarUsuariosAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("permissão");
  });
});

describe("criarUsuarioFuncionalAction — validação de domínio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessaoGestor();
  });

  it("gestor recebe mensagem de VALIDAÇÃO quando RN02 falha", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: true });
    const fake = usuarioServiceFake();
    fake.criarUsuarioFuncional.mockRejectedValue(
      new AppError("VALIDACAO", "Profissional autorizador exige profissão (RN02).")
    );
    mocks.createUsuarioService.mockResolvedValue(fake);

    const resultado: AcaoResultado<UsuarioFuncional> = await criarUsuarioFuncionalAction({
      auth_user_id: "a9",
      nome: "Ana",
      email: "ana@example.com",
      perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
      profissao: null,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("RN02");
  });

  it("não-gestor não cria vínculo (bloqueio antes do serviço)", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true });

    const resultado = await criarUsuarioFuncionalAction({
      auth_user_id: "a9",
      nome: "Ana",
      email: "ana@example.com",
      perfil: PERFIS.GESTOR,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Gestor");
    expect(mocks.createUsuarioService).not.toHaveBeenCalled();
  });
});

describe("criarUsuarioCompletoAction (Sprint 16) — autorização de gestor", () => {
  const dados = {
    nome: "Ana Souza",
    email: "ana@example.com",
    perfil: PERFIS.RECEPCIONISTA,
    profissao: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    comSessaoGestor();
  });

  it("gestor ativo cria usuário completo e recebe a senha temporária", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: true });
    const fake = usuarioAdminServiceFake();
    mocks.createUsuarioAdminService.mockResolvedValue(fake);

    const resultado = await criarUsuarioCompletoAction(dados);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.senhaTemporaria).toBe("senha-temporaria-16ch");
      expect(resultado.data.usuario.auth_user_id).toBe("a1");
    }
    expect(fake.criarUsuarioCompleto).toHaveBeenCalledWith(dados);
  });

  it("recepcionista ativa é BLOQUEADA antes do serviço Admin", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true });

    const resultado = await criarUsuarioCompletoAction(dados);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Gestor");
    expect(mocks.createUsuarioAdminService).not.toHaveBeenCalled();
  });

  it("gestor inativo é bloqueado", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: false });

    const resultado = await criarUsuarioCompletoAction(dados);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Gestor");
    expect(mocks.createUsuarioAdminService).not.toHaveBeenCalled();
  });

  it("usuário sem vínculo é bloqueado", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: null, statusAtivo: null });

    const resultado = await criarUsuarioCompletoAction(dados);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Gestor");
    expect(mocks.createUsuarioAdminService).not.toHaveBeenCalled();
  });

  it("sessão ausente é bloqueada", async () => {
    state.supabase = authSupabase(null);
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: null, statusAtivo: null });

    const resultado = await criarUsuarioCompletoAction(dados);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("autenticada");
    expect(mocks.createUsuarioAdminService).not.toHaveBeenCalled();
  });

  it("erro de domínio vira mensagem amigável (ex.: e-mail já existe)", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: true });
    const fake = usuarioAdminServiceFake();
    fake.criarUsuarioCompleto.mockRejectedValue(
      new AppError("VALIDACAO", "Já existe uma conta para este e-mail.")
    );
    mocks.createUsuarioAdminService.mockResolvedValue(fake);

    const resultado = await criarUsuarioCompletoAction(dados);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("e-mail");
  });

  it("NÃO vaza detalhes internos do Auth em erro desconhecido", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue({ perfil: PERFIS.GESTOR, statusAtivo: true });
    const fake = usuarioAdminServiceFake();
    fake.criarUsuarioCompleto.mockRejectedValue(
      new Error('gotrue internal token "0xabc" / SUPABASE_SERVICE_ROLE_KEY=xxx')
    );
    mocks.createUsuarioAdminService.mockResolvedValue(fake);

    const resultado = await criarUsuarioCompletoAction(dados);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).not.toMatch(/gotrue|SERVICE_ROLE|0xabc/);
      expect(resultado.error).toContain("inesperado");
    }
  });
});