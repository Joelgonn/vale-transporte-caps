import { describe, it, expect, vi } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { RelatorioService } from "@/lib/services/relatorio-service";
import type { RelatorioRepository } from "@/lib/repositories/relatorio-repository";
import type {
  FiltrosRelatorio,
  ResultadoListaRelatorio,
} from "@/lib/domain/relatorios/types";

const resultado: ResultadoListaRelatorio = {
  tipo: "liberacoes",
  linhas: [],
  total: 0,
  pagina: 1,
  porPagina: 20,
};

function makeService(repo: RelatorioRepository) {
  return new RelatorioService(repo);
}

function repoFake() {
  const repo = {
    listarLiberacoes: vi.fn(async () => resultado),
    listarRetiradas: vi.fn(async () => ({ ...resultado, tipo: "retiradas" as const })),
    listarConsolidado: vi.fn(async () => ({ ...resultado, tipo: "consolidado" as const })),
  } as unknown as RelatorioRepository;
  return repo;
}

describe("RelatorioService", () => {
  it("consulta o repositório certo para cada tipo de relatório", async () => {
    const repo = repoFake();
    const service = makeService(repo);

    const base: FiltrosRelatorio = { tipo: "liberacoes", pagina: 1 };

    await service.consultar({ ...base, tipo: "liberacoes" });
    expect(repo.listarLiberacoes).toHaveBeenCalledTimes(1);

    await service.consultar({ ...base, tipo: "retiradas" });
    expect(repo.listarRetiradas).toHaveBeenCalledTimes(1);

    await service.consultar({ ...base, tipo: "consolidado" });
    expect(repo.listarConsolidado).toHaveBeenCalledTimes(1);
  });

  it("rejeita tipo de relatório desconhecido", async () => {
    const service = makeService(repoFake());
    await expect(
      service.consultar({ tipo: "desconhecido" as never, pagina: 1 })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
  });

  it("rejeita página não positiva", async () => {
    const service = makeService(repoFake());
    await expect(
      service.consultar({ tipo: "liberacoes", pagina: 0 })
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      service.consultar({ tipo: "liberacoes", pagina: 1.5 })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("normaliza a página válida e repassa filtros ao repositório", async () => {
    const repo = repoFake();
    const service = makeService(repo);
    const filtros: FiltrosRelatorio = {
      tipo: "liberacoes",
      de: "2026-01-01",
      ate: "2026-01-31",
      busca: "Maria",
      pagina: 3,
    };
    await service.consultar(filtros);
    expect(repo.listarLiberacoes).toHaveBeenCalledWith(filtros);
  });
});