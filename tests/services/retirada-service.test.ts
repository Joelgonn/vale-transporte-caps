import { describe, it, expect, vi } from "vitest";
import { RetiradaService } from "@/lib/services/retirada-service";
import type { RetiradaRepository } from "@/lib/repositories/retirada-repository";
import type { Retirada, RetiradaComDetalhes } from "@/lib/domain/retiradas/types";

function retirada(sobre?: Partial<Retirada>): Retirada {
  return {
    id: "r1",
    liberacao_id: "l1",
    paciente_id: "p1",
    recepcionista_id: "u1",
    quantidade: 1,
    data_hora: "2026-01-05T10:00:00.000Z",
    unidade_id: null,
    ...sobre,
  };
}

function makeService(repo: RetiradaRepository) {
  return new RetiradaService(repo);
}

describe("RetiradaService", () => {
  it("registrarRetirada válida delega ao repositório", async () => {
    const dados = { liberacaoId: "l1", pacienteId: "p1", quantidade: 1 };
    const repo = { criar: vi.fn(async () => retirada()) } as unknown as RetiradaRepository;
    const service = makeService(repo);

    await service.registrarRetirada(dados);

    expect(repo.criar).toHaveBeenCalledWith(dados);
  });

  it("registrarRetirada NÃO envia recepcionista_id nem data_hora (banco é a autoridade)", async () => {
    const repo = { criar: vi.fn(async () => retirada()) } as unknown as RetiradaRepository;
    const service = makeService(repo);

    await service.registrarRetirada({ liberacaoId: "l1", pacienteId: "p1", quantidade: 1 });

    const chamada = (repo.criar as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(chamada).not.toHaveProperty("recepcionista_id");
    expect(chamada).not.toHaveProperty("recepcionistaId");
    expect(chamada).not.toHaveProperty("data_hora");
    expect(chamada).not.toHaveProperty("dataHora");
  });

  it("registrarRetirada rejeita quantidade zero/negativa", async () => {
    const repo = { criar: vi.fn() } as unknown as RetiradaRepository;
    const service = makeService(repo);

    await expect(
      service.registrarRetirada({ liberacaoId: "l1", pacienteId: "p1", quantidade: 0 })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    await expect(
      service.registrarRetirada({ liberacaoId: "l1", pacienteId: "p1", quantidade: -1 })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("o serviço não expõe update/delete de retiradas", async () => {
    const repo = {} as unknown as RetiradaRepository;
    const service = makeService(repo);
    expect(service).not.toHaveProperty("atualizarRetirada");
    expect(service).not.toHaveProperty("excluirRetirada");
  });

  it("buscarRetirada e listarRetiradas delegam ao repositório", async () => {
    const repo = {
      buscarPorId: vi.fn(async () => retirada()),
      listar: vi.fn(async () => [retirada()]),
    } as unknown as RetiradaRepository;
    const service = makeService(repo);

    expect((await service.buscarRetirada("r1"))?.id).toBe("r1");
    expect(await service.listarRetiradas()).toHaveLength(1);
  });

  it("listarRetiradas devolve as retiradas enriquecidas com as FKs embutidas", async () => {
    const detalhada: RetiradaComDetalhes = {
      ...retirada(),
      paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
      liberacao: {
        id: "l1",
        tipo: "continua",
        quantidade: 4,
        data_inicio: "2026-01-01T00:00:00.000Z",
        data_fim: "2026-04-01T00:00:00.000Z",
      },
      recepcionista: { id: "u1", nome: "João Recep" },
    };
    const repo = { listar: vi.fn(async () => [detalhada]) } as unknown as RetiradaRepository;
    const service = makeService(repo);

    const lista = await service.listarRetiradas();

    expect(lista[0].paciente?.nome).toBe("Maria da Silva");
    expect(lista[0].liberacao?.tipo).toBe("continua");
    expect(lista[0].recepcionista?.nome).toBe("João Recep");
  });
});
