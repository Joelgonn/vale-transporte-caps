import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import {
  CAMPOS_EDICAO_PACIENTE_POR_PERFIL,
  filtrarCamposEdicaoPaciente,
  validarAtualizacaoPaciente,
} from "@/lib/domain/regras";

describe("CAMPOS_EDICAO_PACIENTE_POR_PERFIL (Sprint 41)", () => {
  it("gestor pode editar SOMENTE status", () => {
    expect(CAMPOS_EDICAO_PACIENTE_POR_PERFIL[PERFIS.GESTOR]).toEqual(["status"]);
  });

  it("autorizador edita dados cadastrais — nunca status/gestor_sus/cpf/origem", () => {
    const campos = CAMPOS_EDICAO_PACIENTE_POR_PERFIL[
      PERFIS.PROFISSIONAL_AUTORIZADOR
    ] as readonly string[];
    expect(campos).toContain("nome");
    expect(campos).toContain("data_inicio_acompanhamento");
    expect(campos).toContain("data_fim_acompanhamento");
    expect(campos).not.toContain("status");
    expect(campos).not.toContain("origem");
    expect(campos).not.toContain("gestor_sus");
    expect(campos).not.toContain("cpf");
  });

  it("recepcionista não tem nenhum campo de edição", () => {
    expect(CAMPOS_EDICAO_PACIENTE_POR_PERFIL[PERFIS.RECEPCIONISTA]).toEqual([]);
  });
});

describe("filtrarCamposEdicaoPaciente (Sprint 41)", () => {
  it("gestor: mantém apenas status; descarta nome/datas/unidade/cpf/gestor_sus", () => {
    const filtrado = filtrarCamposEdicaoPaciente(PERFIS.GESTOR, {
      status: "inativo",
      nome: "Novo Nome",
      gestor_sus: "999",
      cpf: "123",
      unidade_id: "u1",
      data_inicio_acompanhamento: "2026-01-01",
    });
    expect(filtrado).toEqual({ status: "inativo" });
  });

  it("autorizador: mantém dados cadastrais; descarta status e campos sensíveis", () => {
    const filtrado = filtrarCamposEdicaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, {
      nome: "Ana",
      data_fim_acompanhamento: "2026-12-31",
      status: "inativo",
      gestor_sus: "999",
      cpf: "123",
    });
    expect(filtrado).toEqual({ nome: "Ana", data_fim_acompanhamento: "2026-12-31" });
  });

  it("campo com valor undefined não entra no payload", () => {
    const filtrado = filtrarCamposEdicaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, {
      nome: undefined,
      unidade_id: null,
    });
    expect(filtrado).toEqual({ unidade_id: null });
  });
});

describe("validarAtualizacaoPaciente (Sprint 41)", () => {
  it("payload vazio é rejeitado (nada a atualizar)", () => {
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, {})
    ).toThrow(AppError);
  });

  it("status é aceito apenas para o gestor", () => {
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.GESTOR, { status: "inativo" })
    ).not.toThrow();
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, { status: "inativo" })
    ).toThrow(/Somente o Gestor/);
  });

  it("status inválido é rejeitado mesmo para o gestor", () => {
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.GESTOR, { status: "expirada" })
    ).toThrow(/Status do paciente inválido/);
  });

  it("nome vazio é rejeitado", () => {
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, { nome: "   " })
    ).toThrow(/Nome do paciente é obrigatório/);
  });

  it("nome preenchido é aceito", () => {
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, { nome: "Ana" })
    ).not.toThrow();
  });

  it("janela de acompanhamento invertida é rejeitada", () => {
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, {
        data_inicio_acompanhamento: "2026-06-01",
        data_fim_acompanhamento: "2026-01-01",
      })
    ).toThrow(/anterior à data de início/);
  });

  it("janela coerente é aceita", () => {
    expect(() =>
      validarAtualizacaoPaciente(PERFIS.PROFISSIONAL_AUTORIZADOR, {
        data_inicio_acompanhamento: "2026-01-01",
        data_fim_acompanhamento: "2026-06-01",
      })
    ).not.toThrow();
  });
});
