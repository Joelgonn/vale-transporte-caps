import { describe, it, expect } from "vitest";
import {
  mapearLinhaConsolidado,
  mapearLinhaLiberacoes,
  mapearLinhaRetiradas,
  somarQuantidades,
  type LinhaConsolidadoBruta,
  type LinhaLiberacaoBruta,
  type LinhaRetiradaBruta,
} from "@/lib/domain/relatorios/mapeamento";
import {
  ROTULO_TIPO_RELATORIO,
  descreverPeriodo,
  formatarData,
  formatarDataHora,
  rotuloStatusLiberacao,
  rotuloTipoLiberacao,
  rotuloTipoRelatorio,
} from "@/lib/domain/relatorios/rotulos";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";

function brutaLiberacao(sobre?: Partial<LinhaLiberacaoBruta>): LinhaLiberacaoBruta {
  return {
    id: "l1",
    paciente_id: "p1",
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade: 4,
    periodo_meses: 3,
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-04-01T00:00:00.000Z",
    status: "ativa",
    profissional_autorizador_id: "u1",
    pacientes: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    autorizador: { id: "u1", nome: "Dr. João" },
    retiradas: [{ quantidade: 2 }, { quantidade: 1 }],
    ...sobre,
  };
}

describe("mapeamento dos relatórios (funções puras)", () => {
  it("mapearLinhaLiberacoes soma o total retirado e preserva embeds", () => {
    const linha = mapearLinhaLiberacoes(brutaLiberacao());
    expect(linha.id).toBe("l1");
    expect(linha.paciente?.nome).toBe("Maria da Silva");
    expect(linha.autorizador?.nome).toBe("Dr. João");
    expect(linha.periodoMeses).toBe(3);
    expect(linha.totalRetirado).toBe(3);
  });

  it("normaliza embed to-one como array vazio (PostgREST antigo)", () => {
    const linha = mapearLinhaLiberacoes(
      brutaLiberacao({ pacientes: [], autorizador: [], retiradas: null })
    );
    expect(linha.paciente).toBeNull();
    expect(linha.autorizador).toBeNull();
    expect(linha.totalRetirado).toBe(0);
  });

  it("somarQuantidades ignora ausências e valores não positivos", () => {
    expect(somarQuantidades(null)).toBe(0);
    expect(somarQuantidades([])).toBe(0);
    expect(somarQuantidades([{ quantidade: 2 }, { quantidade: 0 }, {}, { quantidade: -1 }])).toBe(2);
  });

  it("mapearLinhaRetiradas preserva data, paciente, liberação e recepcionista", () => {
    const bruta: LinhaRetiradaBruta = {
      id: "r1",
      data_hora: "2026-01-05T10:30:00.000000+00:00",
      paciente_id: "p1",
      liberacao_id: "l1",
      recepcionista_id: "u2",
      quantidade: 2,
      pacientes: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
      liberacoes: { id: "l1", tipo: TIPOS_LIBERACAO.CONTINUA, quantidade: 4 },
      recepcionista: { id: "u2", nome: "Joana Recep" },
    };
    const linha = mapearLinhaRetiradas(bruta);
    expect(linha.dataHora).toBe(bruta.data_hora);
    expect(linha.paciente?.nome).toBe("Maria da Silva");
    expect(linha.liberacao?.quantidade).toBe(4);
    expect(linha.recepcionista?.nome).toBe("Joana Recep");
    expect(linha.quantidade).toBe(2);
  });

  it("mapearLinhaConsolidado deriva saldo = autorizada − retirada", () => {
    const bruta: LinhaConsolidadoBruta = {
      id: "l1",
      paciente_id: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 4,
      data_inicio: "2026-01-01T00:00:00.000Z",
      data_fim: "2026-01-02T00:00:00.000Z",
      status: "ativa",
      periodo_meses: null,
      pacientes: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
      retiradas: [{ quantidade: 1 }, { quantidade: 2 }],
    };
    const linha = mapearLinhaConsolidado(bruta);
    expect(linha.quantidadeAutorizada).toBe(4);
    expect(linha.quantidadeRetirada).toBe(3);
    expect(linha.saldo).toBe(1);
  });

  it("mapearLinhaConsolidado admite saldo negativo (retirada acima do autorizado)", () => {
    const bruta: LinhaConsolidadoBruta = {
      id: "l2",
      paciente_id: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
      data_inicio: "2026-01-01T00:00:00.000Z",
      data_fim: "2026-01-02T00:00:00.000Z",
      status: "ativa",
      periodo_meses: null,
      pacientes: null,
      retiradas: [{ quantidade: 3 }],
    };
    const linha = mapearLinhaConsolidado(bruta);
    expect(linha.saldo).toBe(-2);
    expect(linha.paciente).toBeNull();
  });
});

describe("rótulos e formatação dos relatórios", () => {
  it("rotula os três tipos de relatório", () => {
    expect(ROTULO_TIPO_RELATORIO.resumo).toBe("Resumo");
  expect(ROTULO_TIPO_RELATORIO.liberacoes).toBe("Liberações");
    expect(ROTULO_TIPO_RELATORIO.retiradas).toBe("Retiradas");
    expect(ROTULO_TIPO_RELATORIO.consolidado).toBe("Consolidado");
    expect(rotuloTipoRelatorio("consolidado")).toBe("Consolidado");
    expect(rotuloTipoRelatorio("desconhecido")).toBe("Relatórios");
  });

  it("reutiliza rótulos canônicos de liberação (sem duplicar valores)", () => {
    expect(rotuloTipoLiberacao(TIPOS_LIBERACAO.CONTINUA)).toBe("Contínua");
    expect(rotuloTipoLiberacao(TIPOS_LIBERACAO.AVULSA)).toBe("Avulsa");
    expect(rotuloStatusLiberacao("expirada")).toBe("Expirada");
    expect(rotuloStatusLiberacao("desconhecido")).toBe("desconhecido");
  });

  it("formata datas de forma determinística (sem fuso local)", () => {
    expect(formatarData("2026-01-01T00:00:00.000Z")).toBe("01/01/2026");
    expect(formatarDataHora("2026-01-05T10:30:00.000000+00:00")).toBe("05/01/2026 · 10:30");
  });

  it("descreve período: avulsa mostra só o dia; contínua mostra 'de a'", () => {
    expect(
      descreverPeriodo({
        tipo: TIPOS_LIBERACAO.AVULSA,
        dataInicio: "2026-01-01T00:00:00.000Z",
        dataFim: "2026-01-02T00:00:00.000Z",
      })
    ).toBe("01/01/2026");
    expect(
      descreverPeriodo({
        tipo: TIPOS_LIBERACAO.CONTINUA,
        dataInicio: "2026-01-01T00:00:00.000Z",
        dataFim: "2026-04-01T00:00:00.000Z",
      })
    ).toBe("01/01/2026 a 01/04/2026");
  });
});