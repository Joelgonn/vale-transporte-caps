import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";

const { instancia } = vi.hoisted(() => ({
  instancia: {
    listarPacientes: vi.fn(),
    buscarPaciente: vi.fn(),
    criarPaciente: vi.fn(),
    atualizarPaciente: vi.fn(),
  },
}));

vi.mock("@/lib/services/paciente-service", () => ({
  PacienteService: {
    create: vi.fn(async () => instancia),
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
    data_inicio_acompanhamento: null,
    data_fim_acompanhamento: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

describe("listarPacientesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a lista via serviço e repassa a busca", async () => {
    instancia.listarPacientes.mockResolvedValue([pacienteSemCpf()]);

    const resultado = await listarPacientesAction("maria");

    expect(resultado).toEqual({ ok: true, data: [pacienteSemCpf()] });
    expect(instancia.listarPacientes).toHaveBeenCalledWith("maria");
  });

  it("normaliza erro de domínio para mensagem amigável", async () => {
    instancia.listarPacientes.mockRejectedValue(
      new AppError("ACESSO_NEGADO", "Você não tem permissão para executar esta operação.")
    );

    const resultado = await listarPacientesAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("permissão");
    }
  });

  it("NÃO vaza mensagem crua de erro desconhecido (ex.: SQL interno)", async () => {
    instancia.listarPacientes.mockRejectedValue(
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

describe("criarPacienteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delega ao serviço e retorna o paciente criado", async () => {
    const criado = pacienteSemCpf({ gestor_sus: "789", nome: "Ana" });
    instancia.criarPaciente.mockResolvedValue(criado);

    const resultado = await criarPacienteAction({ gestor_sus: "789", nome: "Ana" });

    expect(resultado).toEqual({ ok: true, data: criado });
    expect(instancia.criarPaciente).toHaveBeenCalledWith({ gestor_sus: "789", nome: "Ana" });
  });

  it("propaga mensagem de VALIDAÇÃO do domínio", async () => {
    instancia.criarPaciente.mockRejectedValue(
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
    instancia.atualizarPaciente.mockResolvedValue(
      pacienteSemCpf({ status: "inativo" })
    );

    const resultado = await atualizarPacienteAction("p1", { status: "inativo" });

    expect(resultado.ok).toBe(true);
    expect(instancia.atualizarPaciente).toHaveBeenCalledWith("p1", {
      status: "inativo",
    });
  });

  it("propaga erro de permissão sem expor detalhe de RLS", async () => {
    instancia.atualizarPaciente.mockRejectedValue(
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
