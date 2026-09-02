import { describe, it, expect } from "vitest";
import { normalizeCpf, formatCpf } from "@/lib/domain/identificacao/cpf";

describe("normalizeCpf", () => {
  it("12345678900 → 12345678900", () => expect(normalizeCpf("12345678900")).toBe("12345678900"));
  it("123.456.789-00 → 12345678900", () => expect(normalizeCpf("123.456.789-00")).toBe("12345678900"));
  it("123 456 789 00 → 12345678900", () => expect(normalizeCpf("123 456 789 00")).toBe("12345678900"));
  it("remove não numéricos", () => expect(normalizeCpf("abc123.456.789-00xyz")).toBe("12345678900"));
  it("vazia → ''", () => expect(normalizeCpf("")).toBe(""));
  it("parcial", () => expect(normalizeCpf("123.45")).toBe("12345"));
  it("maior que 11 → corta", () => expect(normalizeCpf("12345678900123")).toBe("12345678900"));
});

describe("formatCpf", () => {
  it("12345678900 → 123.456.789-00", () => expect(formatCpf("12345678900")).toBe("123.456.789-00"));
  it("já mascarada", () => expect(formatCpf("123.456.789-00")).toBe("123.456.789-00"));
  it("parcial", () => {
    expect(formatCpf("123")).toBe("123");
    expect(formatCpf("1234")).toBe("123.4");
    expect(formatCpf("123456")).toBe("123.456");
    expect(formatCpf("1234567")).toBe("123.456.7");
  });
  it("vazia → ''", () => expect(formatCpf("")).toBe(""));
});
