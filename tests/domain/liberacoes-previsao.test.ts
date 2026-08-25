import { describe, it, expect } from "vitest";
import {
  calcularPrevisaoVales,
  periodoParaSemanas,
  SEMANAS_POR_MES,
} from "@/lib/domain/liberacoes/previsao";
import { agregarResumo } from "@/lib/domain/relatorios/resumo";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";

describe("calcularPrevisaoVales (Sprint 42.1)", () => {
  it("4 vales/dia × 2 dias/semana × 1 mês (4 semanas) = 32", () => {
    const p = calcularPrevisaoVales(4, 2, 1);
    expect(p.valesPorSemana).toBe(8);
    expect(p.semanas).toBe(4);
    expect(p.previsaoTotal).toBe(32);
  });

  it("4 × 2 × 3 meses = 96", () => {
    const p = calcularPrevisaoVales(4, 2, 3);
    expect(p.semanas).toBe(12);
    expect(p.previsaoTotal).toBe(96);
  });

  it("4 × 2 × 6 meses = 192", () => {
    const p = calcularPrevisaoVales(4, 2, 6);
    expect(p.semanas).toBe(24);
    expect(p.previsaoTotal).toBe(192);
  });

  it("SEMANAS_POR_MES = 4 e periodoParaSemanas converte meses", () => {
    expect(SEMANAS_POR_MES).toBe(4);
    expect(periodoParaSemanas(3)).toBe(12);
    expect(periodoParaSemanas(0)).toBe(0);
  });

  it("entradas inválidas/negativas são tratadas como 0 (resultado ≥ 0)", () => {
    expect(calcularPrevisaoVales(-1, 2, 3).previsaoTotal).toBe(0);
    expect(calcularPrevisaoVales(4, -2, 3).previsaoTotal).toBe(0);
    expect(calcularPrevisaoVales(NaN, 2, 3).previsaoTotal).toBe(0);
    expect(Number.isInteger(calcularPrevisaoVales(4, 2, 6).previsaoTotal)).toBe(true);
  });

  // "alteração de qualquer input recalcula": a função é pura — entradas
  // diferentes produzem totais diferentes, cobrindo o recálculo em tempo real.
  it("recalcula quando qualquer parâmetro muda", () => {
    const base = calcularPrevisaoVales(4, 2, 3);
    expect(calcularPrevisaoVales(5, 2, 3).previsaoTotal).not.toBe(base.previsaoTotal);
    expect(calcularPrevisaoVales(4, 3, 3).previsaoTotal).not.toBe(base.previsaoTotal);
    expect(calcularPrevisaoVales(4, 2, 6).previsaoTotal).not.toBe(base.previsaoTotal);
  });
});

// Sprint 42.2 — Cenário 8: retirado > previsto continua permitido (RN31).
// Previsto: 32 · Retirado: 40 · Diferença: -8 — estado válido e visível.
describe("previsão não limita o consumo agregado (Sprint 42.2)", () => {
  it("previsto 32 com retirado 40 produz diferença -8 sem erro", () => {
    const resumo = agregarResumo(
      [
        {
          paciente_id: "p1",
          tipo: TIPOS_LIBERACAO.CONTINUA,
          quantidade: 32,
          pacientes: { id: "p1", gestor_sus: "1", nome: "Maria" },
        },
      ],
      [
        {
          paciente_id: "p1",
          quantidade: 20,
          pacientes: { id: "p1", gestor_sus: "1", nome: "Maria" },
        },
        {
          paciente_id: "p1",
          quantidade: 20,
          pacientes: { id: "p1", gestor_sus: "1", nome: "Maria" },
        },
      ]
    );

    expect(resumo.totalValesAutorizados).toBe(32);
    expect(resumo.totalValesRetirados).toBe(40);
    expect(resumo.saldoTotal).toBe(-8);
    expect(resumo.linhas[0].saldo).toBe(-8); // diferença negativa é válida
  });
});
