import { describe, it, expect } from "vitest";
import {
  rotuloAcaoAuditoria,
  rotuloEntidadeAuditoria,
  rotuloCampoAuditoria,
  formatarValorCampoAuditoria,
  paresAntesDepois,
  ACOES_AUDITORIA,
  ENTIDADES_AUDITORIA,
} from "@/lib/domain/auditoria/labels";

describe("rotulos da auditoria", () => {
  it("rotula ações canônicas da fn_auditoria", () => {
    expect(rotuloAcaoAuditoria("retirada.registrada")).toBe("Retirada registrada");
    expect(rotuloAcaoAuditoria("usuario.status_alterado")).toBe(
      "Status de usuário alterado"
    );
  });

  it("rotulo de ação desconhecida cai em fallback técnico (não inventa)", () => {
    expect(rotuloAcaoAuditoria("x.desconhecida")).toBe("x.desconhecida");
  });

  it("rotula entidades", () => {
    expect(rotuloEntidadeAuditoria("liberacoes")).toBe("Liberação");
    expect(rotuloEntidadeAuditoria("desconhecida")).toBe("desconhecida");
  });

  it("expõe as listas canônicas para os filtros", () => {
    expect(ACOES_AUDITORIA).toContain("retirada.cancelada");
    expect(ENTIDADES_AUDITORIA).toEqual(["pacientes", "usuarios", "liberacoes", "retiradas"]);
  });
});

describe("rotulos de campo e valores", () => {
  it("rotula campos conhecidos por entidade e humaniza desconhecidos", () => {
    expect(rotuloCampoAuditoria("usuarios", "perfil")).toBe("Perfil");
    expect(rotuloCampoAuditoria("pacientes", "gestor_sus")).toBe("Gestor SUS");
    expect(rotuloCampoAuditoria("liberacoes", "desconhecido_xyz")).toBe("Desconhecido xyz");
  });

  it("formata valores de enum com os rótulos do produto", () => {
    expect(
      formatarValorCampoAuditoria("usuarios", "perfil", "profissional_autorizador")
    ).toBe("Profissional autorizador");
    expect(formatarValorCampoAuditoria("liberacoes", "tipo", "continua")).toBe("Contínua");
    expect(
      formatarValorCampoAuditoria("liberacoes", "status", "cancelada")
    ).toBe("Cancelada");
  });

  it("formata booleano, datas e valores simples de forma determinística", () => {
    expect(formatarValorCampoAuditoria("usuarios", "status_ativo", true)).toBe("Sim");
    expect(
      formatarValorCampoAuditoria("pacientes", "data_inicio_acompanhamento", "2026-08-13T00:00:00Z")
    ).toBe("13/08/2026");
    expect(
      formatarValorCampoAuditoria("retiradas", "data_hora", "2026-08-13T09:31:00Z")
    ).toBe("13/08/2026 · 09:31");
    expect(formatarValorCampoAuditoria("liberacoes", "quantidade", 4)).toBe("4");
  });

  it("valor nulo vira travessão", () => {
    expect(formatarValorCampoAuditoria("liberacoes", "justificativa", null)).toBe("—");
  });
});

describe("paresAntesDepois", () => {
  it("monta pares a partir dos jsonb antes/depois", () => {
    const pares = paresAntesDepois(
      "usuarios",
      { perfil: "recepcionista", status_ativo: true, nome: "Maria" },
      { perfil: "gestor", status_ativo: true, nome: "Maria" }
    );

    expect(pares).toHaveLength(3);
    const perfil = pares.find((p) => p.campo === "perfil");
    expect(perfil?.antes).toBe("Recepcionista");
    expect(perfil?.depois).toBe("Gestor");
  });

  it("campo novo aparece apenas em Depois (e vice-versa)", () => {
    const pares = paresAntesDepois("usuarios", { nome: "Maria" }, { nome: "Maria", perfil: "gestor" });

    const perfil = pares.find((p) => p.campo === "perfil");
    expect(perfil?.antes).toBeNull();
    expect(perfil?.depois).toBe("Gestor");
  });

  it("CPF jamais é exibido (defesa em profundidade)", () => {
    const pares = paresAntesDepois(
      "pacientes",
      { cpf: "123.456.789-00", nome: "Maria" },
      { cpf: "123.456.789-00", nome: "Maria" }
    );

    expect(pares.find((p) => p.campo === "cpf")).toBeUndefined();
    expect(pares).toHaveLength(1);
  });

  it("sem dados nos dois lados retorna lista vazia", () => {
    expect(paresAntesDepois("liberacoes", null, null)).toEqual([]);
  });

  it("ordena os pares por rótulo em pt-BR", () => {
    const pares = paresAntesDepois(
      "usuarios",
      { nome: "A", email: "a@b.c", perfil: "gestor" },
      { nome: "A", email: "a@b.c", perfil: "gestor" }
    );

    const rotulos = pares.map((p) => p.rotulo);
    expect(rotulos).toEqual([...rotulos].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
});
