import { describe, it, expect } from "vitest";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";
import {
  agregarResumo,
  type LiberacaoResumoBruta,
  type RetiradaResumoBruta,
} from "@/lib/domain/relatorios/resumo";

function liberacao(sobre: Partial<LiberacaoResumoBruta> = {}): LiberacaoResumoBruta {
  return {
    paciente_id: "p1",
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade: 4,
    pacientes: { id: "p1", gestor_sus: "111", nome: "Ana" },
    ...sobre,
  };
}

function retirada(sobre: Partial<RetiradaResumoBruta> = {}): RetiradaResumoBruta {
  return {
    paciente_id: "p1",
    quantidade: 1,
    pacientes: { id: "p1", gestor_sus: "111", nome: "Ana" },
    ...sobre,
  };
}

describe("agregarResumo (Sprint 40)", () => {
  it("deriva saldo = autorizado − retirado por paciente", () => {
    const resumo = agregarResumo([liberacao({ quantidade: 4 })], [retirada({ quantidade: 3 })]);
    expect(resumo.linhas[0].quantidadeAutorizada).toBe(4);
    expect(resumo.linhas[0].quantidadeRetirada).toBe(3);
    expect(resumo.linhas[0].saldo).toBe(1);
    expect(resumo.saldoTotal).toBe(1);
  });

  it("soma múltiplas liberações do mesmo paciente", () => {
    const resumo = agregarResumo(
      [liberacao({ quantidade: 4 }), liberacao({ quantidade: 2, tipo: TIPOS_LIBERACAO.AVULSA })],
      []
    );
    const linha = resumo.linhas[0];
    expect(linha.quantidadeLiberacoes).toBe(2);
    expect(linha.quantidadeAutorizada).toBe(6);
    expect(resumo.totalLiberacoes).toBe(2);
    expect(resumo.totalValesAutorizados).toBe(6);
  });

  it("soma múltiplas retiradas do mesmo paciente", () => {
    const resumo = agregarResumo(
      [liberacao({ quantidade: 8 })],
      [retirada({ quantidade: 2 }), retirada({ quantidade: 4 }), retirada({ quantidade: 1 })]
    );
    expect(resumo.linhas[0].quantidadeRetirada).toBe(7);
    expect(resumo.totalValesRetirados).toBe(7);
    expect(resumo.linhas[0].saldo).toBe(1);
  });

  it("paciente sem retirada tem saldo igual ao autorizado", () => {
    const resumo = agregarResumo([liberacao({ quantidade: 4 })], []);
    expect(resumo.linhas[0].quantidadeRetirada).toBe(0);
    expect(resumo.linhas[0].saldo).toBe(4);
    expect(resumo.saldoTotal).toBe(4);
  });

  it("período sem dados retorna zeros e nenhuma linha", () => {
    const resumo = agregarResumo([], []);
    expect(resumo).toEqual({
      totalPacientes: 0,
      totalLiberacoes: 0,
      totalValesAutorizados: 0,
      totalValesRetirados: 0,
      saldoTotal: 0,
      totalLiberacoesContinuas: 0,
      totalLiberacoesAvulsas: 0,
      linhas: [],
    });
  });

  it("conta corretamente contínuas e avulsas", () => {
    const resumo = agregarResumo(
      [
        liberacao({ tipo: TIPOS_LIBERACAO.CONTINUA }),
        liberacao({ tipo: TIPOS_LIBERACAO.CONTINUA, paciente_id: "p2" }),
        liberacao({ tipo: TIPOS_LIBERACAO.AVULSA, paciente_id: "p3" }),
      ],
      []
    );
    expect(resumo.totalLiberacoesContinuas).toBe(2);
    expect(resumo.totalLiberacoesAvulsas).toBe(1);
    expect(resumo.totalPacientes).toBe(3);
  });

  it("agrega retirada de paciente sem liberação no período (linha só-retirada)", () => {
    const resumo = agregarResumo(
      [liberacao({ paciente_id: "p1" })],
      [
        retirada({
          paciente_id: "p2",
          quantidade: 2,
          pacientes: { id: "p2", gestor_sus: "222", nome: "José" },
        }),
      ]
    );
    expect(resumo.totalPacientes).toBe(2);
    expect(resumo.totalValesRetirados).toBe(2);
    // Saldo total coerente com os cards: autorizado − retirado.
    expect(resumo.saldoTotal).toBe(4 - 2);
    const p2 = resumo.linhas.find((l) => l.pacienteId === "p2")!;
    expect(p2.nomePaciente).toBe("José");
    expect(p2.gestorSus).toBe("222");
    expect(p2.quantidadeAutorizada).toBe(0);
    expect(p2.saldo).toBe(-2);
  });

  it("paciente só-retirada recebe nome/SUS mesmo quando a retirada chega ANTES da liberação", () => {
    // Ordem invertida: primeiro um embed vazio, depois a liberação com dados —
    // o acumulador não deve sobrescrever um nome já conhecido nem permanecer
    // com "—" quando a identificação chega depois.
    const resumo = agregarResumo(
      [liberacao({ paciente_id: "p1" })],
      [retirada({ paciente_id: "p1", pacientes: null })]
    );
    expect(resumo.linhas[0].nomePaciente).toBe("Ana");
    expect(resumo.linhas[0].gestorSus).toBe("111");
  });

  it("consistência CARD × TABELA em cenário combinado (Sprint 40.1)", () => {
    const resumo = agregarResumo(
      [
        // p1: ambos — múltiplas liberações e múltiplas retiradas.
        liberacao({ paciente_id: "p1", tipo: TIPOS_LIBERACAO.CONTINUA, quantidade: 4 }),
        liberacao({ paciente_id: "p1", tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 2 }),
        // p2: somente liberação.
        liberacao({
          paciente_id: "p2",
          tipo: TIPOS_LIBERACAO.CONTINUA,
          quantidade: 8,
          pacientes: { id: "p2", gestor_sus: "222", nome: "Bruno" },
        }),
        // p3 (via retiradas): somente retirada.
      ],
      [
        retirada({ paciente_id: "p1", quantidade: 3 }),
        retirada({ paciente_id: "p1", quantidade: 1 }),
        retirada({
          paciente_id: "p3",
          quantidade: 5,
          pacientes: { id: "p3", gestor_sus: "333", nome: "Carla" },
        }),
      ]
    );

    const somaAutorizado = resumo.linhas.reduce((s, l) => s + l.quantidadeAutorizada, 0);
    const somaRetirado = resumo.linhas.reduce((s, l) => s + l.quantidadeRetirada, 0);
    const somaSaldo = resumo.linhas.reduce((s, l) => s + l.saldo, 0);

    expect(somaAutorizado).toBe(resumo.totalValesAutorizados);
    expect(somaRetirado).toBe(resumo.totalValesRetirados);
    expect(somaSaldo).toBe(resumo.saldoTotal);
    expect(resumo.totalPacientes).toBe(resumo.linhas.length);
    expect([somaAutorizado, somaRetirado, somaSaldo]).toEqual([14, 9, 5]);
  });

  it("ordena pela maior quantidade autorizada primeiro", () => {
    const resumo = agregarResumo(
      [
        liberacao({ paciente_id: "p1", quantidade: 2, pacientes: { id: "p1", gestor_sus: "1", nome: "Bruno" } }),
        liberacao({ paciente_id: "p2", quantidade: 8, pacientes: { id: "p2", gestor_sus: "2", nome: "Ana" } }),
        liberacao({ paciente_id: "p3", quantidade: 4, pacientes: { id: "p3", gestor_sus: "3", nome: "Carla" } }),
      ],
      []
    );
    expect(resumo.linhas.map((l) => l.nomePaciente)).toEqual(["Ana", "Carla", "Bruno"]);
  });

  it("ignora quantidades inválidas sem quebrar a soma", () => {
    const resumo = agregarResumo(
      [liberacao({ quantidade: 4 }), liberacao({ quantidade: undefined as unknown as number })],
      [retirada({ quantidade: 0 })]
    );
    expect(resumo.totalValesAutorizados).toBe(4);
    expect(resumo.totalLiberacoes).toBe(2);
    expect(resumo.totalValesRetirados).toBe(0);
  });
});
