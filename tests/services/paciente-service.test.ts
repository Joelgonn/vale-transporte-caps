import { describe, it, expect, vi } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { ORIGENS_PACIENTE } from "@/lib/domain/enums";
import { PacienteService } from "@/lib/services/paciente-service";
import type { PacienteRepository } from "@/lib/repositories/paciente-repository";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";

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

function makeService(repo: PacienteRepository) {
  return new PacienteService(repo);
}

describe("PacienteService", () => {
  it("listarPacientes delega ao repositório", async () => {
    const repo = {
      listar: vi.fn(async () => [pacienteSemCpf()]),
    } as unknown as PacienteRepository;
    const service = makeService(repo);

    const lista = await service.listarPacientes();

    expect(repo.listar).toHaveBeenCalledOnce();
    expect(lista).toHaveLength(1);
  });

  it("listarPacientes repassa a busca ao repositório", async () => {
    const repo = {
      listar: vi.fn(async () => []),
    } as unknown as PacienteRepository;
    const service = makeService(repo);

    await service.listarPacientes("maria");

    expect(repo.listar).toHaveBeenCalledWith("maria");
  });

  it("criarPaciente válido delega ao repositório (com origem)", async () => {
    const dados = {
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.REGULAR,
    };
    const repo = {
      criar: vi.fn(async () => pacienteSemCpf({ gestor_sus: "789", nome: "Ana" })),
    } as unknown as PacienteRepository;
    const service = makeService(repo);

    const criado = await service.criarPaciente(dados);

    expect(repo.criar).toHaveBeenCalledWith(dados);
    expect(criado.nome).toBe("Ana");
  });

  it("criarPaciente esporadico delega ao repositório com a origem informada", async () => {
    const dados = {
      gestor_sus: "789",
      nome: "Ana",
      origem: ORIGENS_PACIENTE.ESPORADICO,
    };
    const repo = {
      criar: vi.fn(async () =>
        pacienteSemCpf({
          gestor_sus: "789",
          nome: "Ana",
          origem: ORIGENS_PACIENTE.ESPORADICO,
        })
      ),
    } as unknown as PacienteRepository;
    const service = makeService(repo);

    await service.criarPaciente(dados);

    expect(repo.criar).toHaveBeenCalledWith(dados);
  });

  it("criarPaciente com origem inválida lança VALIDACAO e não chama o repositório", async () => {
    const repo = { criar: vi.fn() } as unknown as PacienteRepository;
    const service = makeService(repo);

    await expect(
      service.criarPaciente({
        gestor_sus: "789",
        nome: "Ana",
        origem: "temporario" as never,
      })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("criarPaciente sem gestor_sus lança VALIDACAO e não chama o repositório", async () => {
    const repo = { criar: vi.fn() } as unknown as PacienteRepository;
    const service = makeService(repo);

    await expect(service.criarPaciente({ gestor_sus: "", nome: "Ana" })).rejects.toMatchObject({
      code: "VALIDACAO",
    });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("atualizarPaciente propaga erro de perfil sem permissão como ACESSO_NEGADO", async () => {
    const repo = {
      atualizar: vi.fn(async () => {
        throw new AppError("ACESSO_NEGADO", "Perfil sem permissão para alterar pacientes");
      }),
    } as unknown as PacienteRepository;
    const service = makeService(repo);

    await expect(
      service.atualizarPaciente("p1", { status: "inativo" })
    ).rejects.toMatchObject({ code: "ACESSO_NEGADO" });
  });

  it("buscarCpf delega ao repositório e expõe apenas o cpf", async () => {
    const repo = {
      buscarCpf: vi.fn(async () => ({ ...pacienteSemCpf(), cpf: "12345678900" })),
    } as unknown as PacienteRepository;
    const service = makeService(repo);

    const resultado = await service.buscarCpf("p1");

    expect(repo.buscarCpf).toHaveBeenCalledWith("p1");
    expect(resultado).toEqual({ cpf: "12345678900" });
  });

  it("buscarCpf retorna null quando o usuário não tem acesso (não gestor)", async () => {
    const repo = {
      buscarCpf: vi.fn(async () => null),
    } as unknown as PacienteRepository;
    const service = makeService(repo);

    expect(await service.buscarCpf("p1")).toBeNull();
  });
});
