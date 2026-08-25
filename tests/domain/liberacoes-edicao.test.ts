import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import {
  CAMPOS_EDICAO_LIBERACAO_POR_PERFIL,
  filtrarCamposEdicaoLiberacao,
  validarAtualizacaoLiberacao,
} from "@/lib/domain/regras";

describe("CAMPOS_EDICAO_LIBERACAO_POR_PERFIL (Sprint 42)", () => {
  it("gestor pode editar SOMENTE status e unidade", () => {
    expect(CAMPOS_EDICAO_LIBERACAO_POR_PERFIL[PERFIS.GESTOR]).toEqual([
      "status",
      "unidade_id",
    ]);
  });

  it("autorizador edita previsão/vigencia/admin — nunca campos históricos ou status", () => {
    const campos = CAMPOS_EDICAO_LIBERACAO_POR_PERFIL[
      PERFIS.PROFISSIONAL_AUTORIZADOR
    ] as readonly string[];
    expect(campos).toContain("quantidade");
    expect(campos).toContain("data_inicio");
    expect(campos).toContain("data_fim");
    expect(campos).toContain("justificativa");
    expect(campos).not.toContain("status");
    expect(campos).not.toContain("paciente_id");
    expect(campos).not.toContain("tipo");
    expect(campos).not.toContain("renovacao_de_id");
    expect(campos).not.toContain("profissional_autorizador_id");
  });

  it("recepcionista não tem nenhum campo de edição", () => {
    expect(CAMPOS_EDICAO_LIBERACAO_POR_PERFIL[PERFIS.RECEPCIONISTA]).toEqual([]);
  });
});

describe("filtrarCamposEdicaoLiberacao (Sprint 42)", () => {
  it("gestor: mantém apenas status/unidade; descarta quantidade/datas/paciente", () => {
    const filtrado = filtrarCamposEdicaoLiberacao(PERFIS.GESTOR, {
      status: "cancelada",
      unidade_id: null,
      quantidade: 8,
      data_fim: "2027-01-01",
      pacienteId: "p2",
    });
    expect(filtrado).toEqual({ status: "cancelada", unidade_id: null });
  });

  it("autorizador: mantém previsão/vigência; descarta status e históricos", () => {
    const filtrado = filtrarCamposEdicaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, {
      quantidade: 8,
      data_fim: "2027-01-01",
      justificativa: "correção",
      status: "cancelada",
      paciente_id: "p2",
      tipo: "avulsa",
    });
    expect(filtrado).toEqual({
      quantidade: 8,
      data_fim: "2027-01-01",
      justificativa: "correção",
    });
  });
});

describe("validarAtualizacaoLiberacao (Sprint 42)", () => {
  it("payload vazio é rejeitado", () => {
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, {})
    ).toThrow(AppError);
  });

  it("status é aceito apenas para o gestor e apenas com valor válido", () => {
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.GESTOR, { status: "cancelada" })
    ).not.toThrow();
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, { status: "cancelada" })
    ).toThrow(/Somente o Gestor/);
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.GESTOR, { status: "expirada" })
    ).not.toThrow();
  });

  it("Sprint 42.1 — previsão livre: aceita 12/96; rejeita 0, negativo e >999", () => {
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, { quantidade: 96 })
    ).not.toThrow();
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, { quantidade: 0 })
    ).toThrow(/RN04/);
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, { quantidade: 1000 })
    ).toThrow(/RN04/);
  });

  it("vigência invertida é rejeitada", () => {
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, {
        data_inicio: "2026-06-01",
        data_fim: "2026-01-01",
      })
    ).toThrow(/posterior/);
  });

  it("edição coerente do autorizador passa", () => {
    expect(() =>
      validarAtualizacaoLiberacao(PERFIS.PROFISSIONAL_AUTORIZADOR, {
        quantidade: 8,
        data_inicio: "2026-01-01",
        data_fim: "2026-07-01",
        justificativa: "previsão revisada",
      })
    ).not.toThrow();
  });
});
