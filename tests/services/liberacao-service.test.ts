import { describe, it, expect, vi } from "vitest";
import { LiberacaoService } from "@/lib/services/liberacao-service";
import type { LiberacaoRepository } from "@/lib/repositories/liberacao-repository";
import { PERFIS, TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type { Liberacao, NovaLiberacao } from "@/lib/domain/liberacoes/types";

function liberacao(sobre?: Partial<Liberacao>): Liberacao {
  return {
    id: "l1",
    paciente_id: "p1",
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade: 4,
    periodo_meses: 3,
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-04-01T00:00:00.000Z",
    profissional_autorizador_id: "u1",
    registrado_por_id: "u1",
    renovacao_de_id: null,
    status: "ativa",
    justificativa: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

function makeService(repo: LiberacaoRepository) {
  return new LiberacaoService(repo);
}

describe("LiberacaoService", () => {
  it("criarLiberacao contínua de 3 meses delega ao repositório", async () => {
    const dados: NovaLiberacao = {
      pacienteId: "p1",
      profissionalAutorizadorId: "u1",
      tipo: TIPOS_LIBERACAO.CONTINUA,
      quantidade: 4,
      periodoMeses: 3,
    };
    const repo = { criar: vi.fn(async () => liberacao()) } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await service.criarLiberacao(dados);

    expect(repo.criar).toHaveBeenCalledWith(dados);
  });

  it("criarLiberacao avulsa sem período é aceita", async () => {
    const dados: NovaLiberacao = {
      pacienteId: "p1",
      profissionalAutorizadorId: "u1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 2,
      periodoMeses: null,
    };
    const repo = { criar: vi.fn(async () => liberacao()) } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await expect(service.criarLiberacao(dados)).resolves.toBeTruthy();
  });

  it("criarLiberacao rejeita quantidade inválida (Sprint 42.1: previsão válida até 999)", async () => {
    const repo = {
      criar: vi.fn(async () => liberacao()),
    } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await expect(
      service.criarLiberacao({
        pacienteId: "p1",
        profissionalAutorizadorId: "u1",
        tipo: TIPOS_LIBERACAO.AVULSA,
        quantidade: 1000,
      } as unknown as NovaLiberacao)
    ).rejects.toMatchObject({ code: "VALIDACAO" });

    // 7 agora é uma previsão válida (RN04 atualizada na Sprint 42.1)
    await expect(
      service.criarLiberacao({
        pacienteId: "p1",
        profissionalAutorizadorId: "u1",
        tipo: TIPOS_LIBERACAO.AVULSA,
        quantidade: 7,
      })
    ).resolves.toBeTruthy();
    expect(repo.criar).toHaveBeenCalledTimes(1);
  });

  it("criarLiberacao rejeita contínua sem período", async () => {
    const repo = { criar: vi.fn() } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await expect(
      service.criarLiberacao({
        pacienteId: "p1",
        profissionalAutorizadorId: "u1",
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 4,
        periodoMeses: null,
      } as unknown as NovaLiberacao)
    ).rejects.toMatchObject({ code: "VALIDACAO" });
  });

  it("criarLiberacao rejeita avulsa com período", async () => {
    const repo = { criar: vi.fn() } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await expect(
      service.criarLiberacao({
        pacienteId: "p1",
        profissionalAutorizadorId: "u1",
        tipo: TIPOS_LIBERACAO.AVULSA,
        quantidade: 1,
        periodoMeses: 3,
      } as unknown as NovaLiberacao)
    ).rejects.toMatchObject({ code: "VALIDACAO" });
  });

  it("RN29 — rejeita contínua para paciente esporádico sem chamar o banco", async () => {
    const repo = { criar: vi.fn() } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await expect(
      service.criarLiberacao(
        {
          pacienteId: "p1",
          profissionalAutorizadorId: "u1",
          tipo: TIPOS_LIBERACAO.CONTINUA,
          quantidade: 4,
          periodoMeses: 3,
        },
        "esporadico"
      )
    ).rejects.toMatchObject({ code: "VALIDACAO", message: expect.stringContaining("RN29") });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("RN29 — aceita avulsa para paciente esporádico", async () => {
    const repo = {
      criar: vi.fn(async () => liberacao({ tipo: TIPOS_LIBERACAO.AVULSA })),
    } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await expect(
      service.criarLiberacao(
        {
          pacienteId: "p1",
          profissionalAutorizadorId: "u1",
          tipo: TIPOS_LIBERACAO.AVULSA,
          quantidade: 1,
          periodoMeses: null,
        },
        "esporadico"
      )
    ).resolves.toBeTruthy();
  });

  it("criarLiberacao NÃO envia registrado_por_id nem data_fim (banco é a autoridade)", async () => {
    const repo = { criar: vi.fn(async () => liberacao()) } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await service.criarLiberacao({
      pacienteId: "p1",
      profissionalAutorizadorId: "u1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
    });

    const chamada = (repo.criar as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(chamada).not.toHaveProperty("registrado_por_id");
    expect(chamada).not.toHaveProperty("registradoPorId");
    expect(chamada).not.toHaveProperty("data_fim");
    expect(chamada).not.toHaveProperty("dataFim");
  });

  it("Sprint 42: expõe atualizarLiberacao (com validação) e NUNCA delete", async () => {
    const repo = {
      atualizar: vi.fn(async () => liberacao()),
    } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    // update existe e valida o payload filtrado antes do repasse
    await expect(
      service.atualizarLiberacao("l1", PERFIS.GESTOR, { status: "cancelada" })
    ).resolves.toHaveProperty("id", "l1");
    expect(repo.atualizar).toHaveBeenCalledWith("l1", { status: "cancelada" });

    await expect(
      service.atualizarLiberacao("l1", PERFIS.PROFISSIONAL_AUTORIZADOR, {})
    ).rejects.toMatchObject({ code: "VALIDACAO" });

    // delete continua inexistente
    expect(service).not.toHaveProperty("excluirLiberacao");
  });

  it("buscarLiberacao e listarLiberacoes delegam ao repositório", async () => {
    const repo = {
      buscarPorId: vi.fn(async () => liberacao()),
      listar: vi.fn(async () => [liberacao()]),
    } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    expect((await service.buscarLiberacao("l1"))?.id).toBe("l1");
    expect((await service.listarLiberacoes())).toHaveLength(1);
  });

  it("listarLiberacoes repassa a busca ao repositório (mesmo padrão de Pacientes)", async () => {
    const repo = {
      listar: vi.fn(async () => [liberacao()]),
    } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await service.listarLiberacoes("maria");

    expect(repo.listar).toHaveBeenCalledWith("maria");
  });

  it("renovação repassa renovacaoDeId e o autorizador original ao repositório", async () => {
    const repo = { criar: vi.fn(async () => liberacao()) } as unknown as LiberacaoRepository;
    const service = makeService(repo);

    await service.criarLiberacao({
      pacienteId: "p1",
      profissionalAutorizadorId: "u1",
      tipo: TIPOS_LIBERACAO.CONTINUA,
      quantidade: 4,
      periodoMeses: 3,
      renovacaoDeId: "l-origem",
    });

    const chamada = (repo.criar as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(chamada.renovacaoDeId).toBe("l-origem");
    expect(chamada.profissionalAutorizadorId).toBe("u1");
  });
});
