import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { ORIGENS_PACIENTE, PERFIS } from "@/lib/domain/enums";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";

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
    instancia: {
      listarPacientes: vi.fn(),
      buscarPaciente: vi.fn(),
      criarPaciente: vi.fn(),
      atualizarPaciente: vi.fn(),
    },
  },
  state: { supabase: null as AuthSupabaseMock | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => state.supabase ?? authSupabase(null)),
}));

vi.mock("@/lib/auth/profile", () => ({
  getUsuarioFuncional: (...args: unknown[]) =>
    mocks.getUsuarioFuncional(...args),
}));

vi.mock("@/lib/services/paciente-service", () => ({
  PacienteService: {
    create: vi.fn(async () => mocks.instancia),
  },
}));

import {
  atualizarPacienteAction,
  criarPacienteAction,
  listarPacientesAction,
} from "@/app/actions/pacientes";

function pacienteSemCpf(sobre?: Partial<PacienteSemCpf>): PacienteSemCpf {
  return {
    id: "p1",
    gestor_sus: "123456",
    nome: "Maria",
    status: "ativo",
    origem: "regular",
    data_inicio_acompanhamento: null,
    data_fim_acompanhamento: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

function comSessao() {
  state.supabase = authSupabase({ id: "auth-user-1", email: "u@caps.local" });
}

function comPerfil(sobre?: { perfil?: string | null; statusAtivo?: boolean | null }) {
  const tem = (k: "perfil" | "statusAtivo") =>
    Object.prototype.hasOwnProperty.call(sobre ?? {}, k);
  mocks.getUsuarioFuncional.mockResolvedValue({
    id: "auth-user-1",
    perfil: tem("perfil") ? sobre!.perfil : PERFIS.GESTOR,
    statusAtivo: tem("statusAtivo") ? sobre!.statusAtivo : true,
    usuarioId: "u1",
  });
}

describe("listarPacientesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a lista via serviço e repassa a busca", async () => {
    mocks.instancia.listarPacientes.mockResolvedValue([pacienteSemCpf()]);

    const resultado = await listarPacientesAction("maria");

    expect(resultado).toEqual({ ok: true, data: [pacienteSemCpf()] });
    expect(mocks.instancia.listarPacientes).toHaveBeenCalledWith("maria");
  });

  it("normaliza erro de domínio para mensagem amigável", async () => {
    mocks.instancia.listarPacientes.mockRejectedValue(
      new AppError("ACESSO_NEGADO", "Você não tem permissão para executar esta operação.")
    );

    const resultado = await listarPacientesAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("permissão");
    }
  });

  it("NÃO vaza mensagem crua de erro desconhecido (ex.: SQL interno)", async () => {
    mocks.instancia.listarPacientes.mockRejectedValue(
      new Error('syntax error at or near "select" — SQLSTATE 42601')
    );

    const resultado = await listarPacientesAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).not.toMatch(/SQLSTATE|syntax error/);
      expect(resultado.error).toContain("inesperado");
    }
  });
});

describe("criarPacienteAction — origem derivada do perfil da sessão (Sprint 38)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessao();
    comPerfil();
  });

  it("✓ gestor cria regular (origem imposta pelo servidor)", async () => {
    comPerfil({ perfil: PERFIS.GESTOR });
    const criado = pacienteSemCpf({ nome: "Ana" });
    mocks.instancia.criarPaciente.mockResolvedValue(criado);

    const resultado = await criarPacienteAction({ gestor_sus: "789", nome: "Ana" });

    expect(resultado.ok).toBe(true);
    expect(mocks.instancia.criarPaciente).toHaveBeenCalledWith({
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.REGULAR,
    });
  });

  it("✓ profissional_autorizador cria regular", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    const criado = pacienteSemCpf({ nome: "Ana" });
    mocks.instancia.criarPaciente.mockResolvedValue(criado);

    const resultado = await criarPacienteAction({ gestor_sus: "789", nome: "Ana" });

    expect(resultado.ok).toBe(true);
    expect(mocks.instancia.criarPaciente).toHaveBeenCalledWith({
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.REGULAR,
    });
  });

  it("✓ recepcionista cria esporadico", async () => {
    comPerfil({ perfil: PERFIS.RECEPCIONISTA });
    const criado = pacienteSemCpf({ nome: "Ana", origem: ORIGENS_PACIENTE.ESPORADICO });
    mocks.instancia.criarPaciente.mockResolvedValue(criado);

    const resultado = await criarPacienteAction({ gestor_sus: "789", nome: "Ana" });

    expect(resultado.ok).toBe(true);
    expect(mocks.instancia.criarPaciente).toHaveBeenCalledWith({
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.ESPORADICO,
    });
  });

  it("✗ recepcionista NÃO consegue criar regular (mesmo forjando origem no cliente)", async () => {
    comPerfil({ perfil: PERFIS.RECEPCIONISTA });

    const resultado = await criarPacienteAction({
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.REGULAR,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("origem");
    expect(mocks.instancia.criarPaciente).not.toHaveBeenCalled();
  });

  it("✗ gestor NÃO consegue criar esporadico", async () => {
    comPerfil({ perfil: PERFIS.GESTOR });

    const resultado = await criarPacienteAction({
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.ESPORADICO,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("origem");
    expect(mocks.instancia.criarPaciente).not.toHaveBeenCalled();
  });

  it("✗ autorizador NÃO consegue criar esporadico", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });

    const resultado = await criarPacienteAction({
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.ESPORADICO,
    });

    expect(resultado.ok).toBe(false);
    expect(mocks.instancia.criarPaciente).not.toHaveBeenCalled();
  });

  it("usuário inativo é bloqueado antes do serviço", async () => {
    comPerfil({ statusAtivo: false });

    const resultado = await criarPacienteAction({ gestor_sus: "789", nome: "Ana" });

    expect(resultado.ok).toBe(false);
    expect(mocks.instancia.criarPaciente).not.toHaveBeenCalled();
  });

  it("sessão ausente é bloqueada", async () => {
    state.supabase = authSupabase(null);

    const resultado = await criarPacienteAction({ gestor_sus: "789", nome: "Ana" });

    expect(resultado.ok).toBe(false);
    expect(mocks.instancia.criarPaciente).not.toHaveBeenCalled();
  });

  it("propaga mensagem de VALIDAÇÃO do domínio", async () => {
    mocks.instancia.criarPaciente.mockRejectedValue(
      new AppError("VALIDACAO", "Gestor SUS é obrigatório (RN25).")
    );

    const resultado = await criarPacienteAction({ gestor_sus: "", nome: "Ana" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("Gestor SUS");
    }
  });
});

describe("atualizarPacienteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repassa id e dados ao serviço", async () => {
    mocks.instancia.atualizarPaciente.mockResolvedValue(
      pacienteSemCpf({ status: "inativo" })
    );

    const resultado = await atualizarPacienteAction("p1", { status: "inativo" });

    expect(resultado.ok).toBe(true);
    expect(mocks.instancia.atualizarPaciente).toHaveBeenCalledWith("p1", {
      status: "inativo",
    });
  });

  it("propaga erro de permissão sem expor detalhe de RLS", async () => {
    mocks.instancia.atualizarPaciente.mockRejectedValue(
      new AppError(
        "ACESSO_NEGADO",
        "Profissional autorizador não pode alterar o status do paciente"
      )
    );

    const resultado = await atualizarPacienteAction("p1", { status: "inativo" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("Profissional autorizador");
    }
  });
});
