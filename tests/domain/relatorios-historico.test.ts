import { describe, it, expect } from "vitest";
import {
  mapearItemHistorico,
  ehRenovacao,
  ehOriginal,
  somarQuantidades,
  type ItemHistorico,
  type LinhaHistoricoBruta,
} from "@/lib/domain/relatorios/historico";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";

function brutaHistorica(sobre?: Partial<LinhaHistoricoBruta>): LinhaHistoricoBruta {
  return {
    id: "l1",
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-04-01T00:00:00.000Z",
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade: 4,
    periodo_meses: 3,
    status: "ativa",
    renovacao_de_id: null,
    autorizador: { id: "u1", nome: "Dr. João" },
    registrador: { id: "u2", nome: "Joana Recep" },
    retiradas: [{ data_hora: "2026-01-05T10:30:00.000000+00:00", quantidade: 2 }],
    origem: {
      id: "l0",
      data_inicio: "2025-01-01T00:00:00.000Z",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
    },
    ...sobre,
  };
}

describe("mapeamento dos relatórios — histórico por paciente", () => {
  it("mapearItemHistorico origens: original (renovacao_de_id nulo)", () => {
    const linha = brutaHistorica();
    const item = mapearItemHistorico(linha);
    expect(ehRenovacao(item)).toBe(false);
    expect(ehOriginal(item)).toBe(true);
    expect(item.origem?.id).toBe("l0");
    expect(item.origem?.dataInicio).toBe("2025-01-01T00:00:00.000Z");
    expect(item.origem?.tipo).toBe("avulsa");
    expect(item.quantidadeRetirada).toBe(2);
    expect(item.numeroRetiradas).toBe(1);
    expect(item.saldo).toBe(2);
    expect(item.ultimaRetirada).toBe("2026-01-05T10:30:00.000000+00:00");
  });

  it("mapearItemHistorico: renovacao (renovacao_de_id com valor)", () => {
    const linha = {
      ...brutaHistorica(),
      renovacao_de_id: "l0",
      origem: {
        id: "l0",
        data_inicio: "2025-01-01T00:00:00.000Z",
        tipo: "avulsa",
        quantidade: 1,
      },
    } as LinhaHistoricoBruta;
    const item = mapearItemHistorico(linha);
    expect(ehRenovacao(item)).toBe(true);
    expect(ehOriginal(item)).toBe(false);
    expect(item.renovacaoDeId).toBe("l0");
    expect(item.origem?.dataInicio).toBe("2025-01-01T00:00:00.000Z");
    expect(item.saldo).toBe(2);
  });

  it("somarQuantidades de retiradas", () => {
    expect(somarQuantidades([{ quantidade: 2 }, { quantidade: 1 }])).toBe(3);
    expect(somarQuantidades(null)).toBe(0);
    expect(somarQuantidades([])).toBe(0);
    expect(
      somarQuantidades([
        { quantidade: 2 },
        { quantidade: 0 },
        {},
        { quantidade: -1 },
      ])
    ).toBe(2);
  });

it("ultimaRetiradaDe: maior data_hora", () => {
    const linha = brutaHistorica();
    const item = mapearItemHistorico(linha);
    expect(item.ultimaRetirada).toBe("2026-01-05T10:30:00.000000+00:00");
  });

  it("ultimaRetiradaDe: retorna null para ausências", () => {
    const item = mapearItemHistorico({
      ...brutaHistorica(),
      retiradas: null,
    });
    expect(item.ultimaRetirada).toBeNull();
  });

  it("predicados da cadeia", () => {
    const original = { renovacaoDeId: null } as Pick<ItemHistorico, "renovacaoDeId">;
    const renovacao = { renovacaoDeId: "l1" } as Pick<ItemHistorico, "renovacaoDeId">;
    expect(ehRenovacao(renovacao)).toBe(true);
    expect(ehOriginal(original)).toBe(true);
  });
});