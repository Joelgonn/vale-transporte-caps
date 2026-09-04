import { describe, it, expect } from "vitest";

function textoQuantidadeDiaria(tipo: string, valesPorDia?: number | null): string {
  if (tipo !== "continua") return "";
  if (valesPorDia != null && valesPorDia >= 1 && valesPorDia <= 10) return `${valesPorDia} vales/dia`;
  return "Quantidade diária não informada";
}

describe("Sprint 70 — vales_por_dia display", () => {
  it("continua com 4 → 4 vales/dia", () => {
    expect(textoQuantidadeDiaria("continua", 4)).toBe("4 vales/dia");
  });
  it("continua com null → não informada", () => {
    expect(textoQuantidadeDiaria("continua", null)).toBe("Quantidade diária não informada");
  });
  it("avulsa não tem diária", () => {
    expect(textoQuantidadeDiaria("avulsa", 4)).toBe("");
  });
});

describe("Sprint 70 — quantidade inicial da retirada", () => {
  function quantidadeInicial(tipo: string, valesPorDia?: number | null): number {
    if (tipo === "continua") return valesPorDia && valesPorDia >=1 && valesPorDia <=10 ? valesPorDia : 2;
    return 2;
  }
  it("continua 4 → 4", () => expect(quantidadeInicial("continua", 4)).toBe(4));
  it("continua null → 2 sugestão", () => expect(quantidadeInicial("continua", null)).toBe(2));
  it("avulsa → 2", () => expect(quantidadeInicial("avulsa", 4)).toBe(2));
  it("avulsa null → 2", () => expect(quantidadeInicial("avulsa", null)).toBe(2));
});
