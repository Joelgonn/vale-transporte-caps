import { describe, it, expect, vi } from "vitest";
import { AuditoriaService } from "@/lib/services/auditoria-service";
import type { AuditoriaRepository } from "@/lib/repositories/auditoria-repository";
import type {
  FiltrosAuditoria,
  ResultadoListaAuditoria,
} from "@/lib/domain/auditoria/types";

const resultado: ResultadoListaAuditoria = {
  eventos: [
    {
      id: 1,
      acao: "retirada.registrada",
      entidadeTipo: "retiradas",
      entidadeId: "r1",
      usuarioId: "u1",
      dadosAntes: null,
      dadosDepois: { quantidade: 2 },
      dataHora: "2026-08-13T09:31:00+00:00",
      responsavel: { id: "u1", nome: "João Recep" },
    },
  ],
  total: 1,
  pagina: 1,
  porPagina: 20,
};

function makeService(repo: AuditoriaRepository) {
  return new AuditoriaService(repo);
}

describe("AuditoriaService", () => {
  it("listarEventos delega os filtros ao repositório", async () => {
    const repo = { listar: vi.fn(async () => resultado) } as unknown as AuditoriaRepository;
    const service = makeService(repo);

    const filtros: FiltrosAuditoria = { acao: "retirada.registrada", pagina: 1 };
    await service.listarEventos(filtros);

    expect(repo.listar).toHaveBeenCalledWith(filtros);
  });

  it("valida página inválida (zero ou não inteiro) sem consultar o banco", async () => {
    const repo = { listar: vi.fn() } as unknown as AuditoriaRepository;
    const service = makeService(repo);

    await expect(service.listarEventos({ pagina: 0 })).rejects.toMatchObject({
      code: "VALIDACAO",
    });
    await expect(service.listarEventos({ pagina: 1.5 })).rejects.toMatchObject({
      code: "VALIDACAO",
    });
    expect(repo.listar).not.toHaveBeenCalled();
  });

  it("o serviço de auditoria é somente leitura", async () => {
    const repo = {} as unknown as AuditoriaRepository;
    const service = makeService(repo);
    expect(service).not.toHaveProperty("criarEvento");
    expect(service).not.toHaveProperty("atualizarEvento");
    expect(service).not.toHaveProperty("excluirEvento");
  });
});
