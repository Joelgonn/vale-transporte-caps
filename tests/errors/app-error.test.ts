import { describe, it, expect } from "vitest";
import { AppError, mapSupabaseError, mensagemDeErro } from "@/lib/domain/app-error";

describe("mapSupabaseError", () => {
  it("mapeia violação de RLS/permissão para ACESSO_NEGADO", () => {
    const err = mapSupabaseError({
      message: "new row violates row-level security policy",
      code: "42501",
    });
    expect(err?.code).toBe("ACESSO_NEGADO");
  });

  it("mapeia paciente inativo (RN01)", () => {
    const err = mapSupabaseError({ message: "Paciente sem direito ativo (RN01)", code: "P0001" });
    expect(err?.code).toBe("PACIENTE_INATIVO");
  });

  it("mapeia autorizador inválido/inativo (RN02/RN27)", () => {
    const err = mapSupabaseError({
      message: "Profissional autorizador inválido ou inativo (RN02/RN27)",
      code: "P0001",
    });
    expect(err?.code).toBe("AUTORIZADOR_INVALIDO");
  });

  it("mapeia liberação inativa", () => {
    const err = mapSupabaseError({ message: "Liberação não está ativa para retirada", code: "P0001" });
    expect(err?.code).toBe("LIBERACAO_INATIVA");
  });

  it("mapeia retirada fora da validade (RN13/RN21)", () => {
    const err = mapSupabaseError({
      message: "Retirada fora do período de validade da liberação (RN13/RN21)",
      code: "P0001",
    });
    expect(err?.code).toBe("RETIRADA_FORA_DA_VALIDADE");
  });

  it("mapeia quantidade excedida para SALDO_INSUFICIENTE", () => {
    const err = mapSupabaseError({ message: "Quantidade excede a quantidade restante da liberação", code: "P0001" });
    expect(err?.code).toBe("SALDO_INSUFICIENTE");
  });

  it("mapeia perfil sem permissão para ACESSO_NEGADO", () => {
    const err = mapSupabaseError({ message: "Perfil sem permissão para alterar pacientes", code: "P0001" });
    expect(err?.code).toBe("ACESSO_NEGADO");
  });

  it("mapeia violação de unicidade (23505) para VALIDACAO amigável", () => {
    const err = mapSupabaseError({
      message: 'duplicate key value violates unique constraint "pacientes_gestor_sus_key"',
      code: "23505",
    });
    expect(err?.code).toBe("VALIDACAO");
    expect(err?.message).toContain("Já existe");
  });

  it("mapeia check constraint (23514) para VALIDACAO", () => {
    const err = mapSupabaseError({
      message: 'new row for relation "pacientes" violates check constraint',
      code: "23514",
    });
    expect(err?.code).toBe("VALIDACAO");
  });

  it("retorna null quando não há erro", () => {
    expect(mapSupabaseError(null)).toBeNull();
  });

  it("fallback para ERRO_INTERNO em erro desconhecido", () => {
    const err = mapSupabaseError({ message: "alguma coisa inesperada", code: "XX000" });
    expect(err?.code).toBe("ERRO_INTERNO");
  });
});

describe("mensagemDeErro", () => {
  it("retorna a mensagem amigável de um AppError", () => {
    expect(mensagemDeErro(new AppError("ACESSO_NEGADO", "Bloqueado."))).toBe("Bloqueado.");
  });

  it("retorna a mensagem de um erro comum", () => {
    expect(mensagemDeErro(new Error("fallback"))).toBe("fallback");
  });

  it("retorna mensagem padrão para valores não-erro", () => {
    expect(mensagemDeErro("texto qualquer")).toBe("Ocorreu um erro inesperado.");
  });
});
