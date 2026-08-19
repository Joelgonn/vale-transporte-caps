// @vitest-environment node

import { describe, it, expect } from "vitest";
import {
  mensagemUsuario,
  mensagemRetirada,
  MENSAGEM_SALDO_INSUFICIENTE,
} from "@/components/ui/mensagens";

describe("mensagemUsuario (apresentação sem códigos técnicos)", () => {
  it("remove códigos técnicos (RN…) das mensagens do domínio", () => {
    expect(
      mensagemUsuario("Quantidade excede o saldo disponível da liberação (RN14).")
    ).toBe("Quantidade excede o saldo disponível da liberação.");
  });

  it("remove códigos compostos (ex.: RN13/RN21)", () => {
    expect(
      mensagemUsuario("Retirada fora do período de validade da liberação (RN13/RN21).")
    ).toBe("Retirada fora do período de validade da liberação.");
  });

  it("preserva mensagens sem código técnico", () => {
    expect(mensagemUsuario("Liberação não está ativa para retirada.")).toBe(
      "Liberação não está ativa para retirada."
    );
  });
});

describe("mensagemRetirada (SALDO_INSUFICIENTE claro)", () => {
  it("converte erro de saldo em orientação acionável", () => {
    expect(
      mensagemRetirada("Quantidade excede o saldo disponível da liberação (RN14).")
    ).toBe(MENSAGEM_SALDO_INSUFICIENTE);
    expect(MENSAGEM_SALDO_INSUFICIENTE).toMatch(/saldo disponível/i);
    expect(MENSAGEM_SALDO_INSUFICIENTE).not.toMatch(/RN14/);
  });

  it("mantém outros erros sem código técnico", () => {
    expect(mensagemRetirada("Liberação não está ativa para retirada (RN21).")).toBe(
      "Liberação não está ativa para retirada."
    );
  });
});