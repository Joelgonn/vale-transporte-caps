// @vitest-environment node

import { describe, it, expect } from "vitest";
import {
  modulosPorCapacidade,
  moduloAtual,
  acoesRapidasPorPerfil,
  type CapacidadeDashboard,
} from "@/components/dashboard/navegacao";
import { capacidadeDashboard } from "@/lib/domain/regras";
import { PERFIS } from "@/lib/domain/enums";

function capacidade(sobre: Partial<CapacidadeDashboard> = {}): CapacidadeDashboard {
  return {
    ativo: true,
    pacientes: true,
    liberacoes: false,
    retiradas: false,
    usuarios: false,
    auditoria: false,
    relatorios: false,
    atendimento: false,
    ...sobre,
  };
}

describe("modulosPorCapacidade", () => {
  it("expõe todos os módulos na ordem canônica para o Gestor ativo (Histórico consolidado em Relatórios)", () => {
    const modulos = modulosPorCapacidade(
      capacidade({ liberacoes: true, retiradas: true, usuarios: true, auditoria: true, relatorios: true, atendimento: true })
    );
    expect(modulos.map((m) => m.rotulo)).toEqual([
      "Pacientes",
      "Liberações",
      "Retiradas",
      "Usuários",
      "Auditoria",
      "Relatórios",
      "Atendimento",
    ]);
    expect(modulos[0].href).toBe("/dashboard/pacientes");
    expect(modulos[5].href).toBe("/dashboard/relatorios");
    expect(modulos.map((m) => m.href)).not.toContain("/dashboard/historico");
  });

  it("não expõe módulos sem capacidade (recepcionista: sem Usuários/Auditoria)", () => {
    const modulos = modulosPorCapacidade(
      capacidade({ liberacoes: true, retiradas: true })
    );
    expect(modulos.map((m) => m.rotulo)).toEqual(["Pacientes", "Liberações", "Retiradas"]);
  });

  it("retorna lista vazia para usuário inativo", () => {
    expect(
      modulosPorCapacidade(
        capacidade({ ativo: false, pacientes: false, liberacoes: false, retiradas: false })
      )
    ).toEqual([]);
  });
});

describe("moduloAtual", () => {
  const cap = capacidade({ liberacoes: true, retiradas: true, usuarios: true, auditoria: true, relatorios: true });

  it("reconhece a rota exata do módulo", () => {
    expect(moduloAtual("/dashboard/pacientes", cap)?.rotulo).toBe("Pacientes");
    expect(moduloAtual("/dashboard/auditoria", cap)?.rotulo).toBe("Auditoria");
    expect(moduloAtual("/dashboard/relatorios", cap)?.rotulo).toBe("Relatórios");
  });

  it("reconhece rotas-filhas do módulo (ex.: nova liberação)", () => {
    expect(moduloAtual("/dashboard/liberacoes/nova", cap)?.rotulo).toBe("Liberações");
  });

  it("não reconhece o /dashboard nem rotas desconhecidas", () => {
    expect(moduloAtual("/dashboard", cap)).toBeNull();
    expect(moduloAtual("/dashboard/nao-existe", cap)).toBeNull();
    expect(moduloAtual("/login", cap)).toBeNull();
  });
});

describe("acoesRapidasPorPerfil", () => {
  it("Gestor ativo cria paciente regular, gerencia usuários e consulta auditoria e relatórios — Sprint44", () => {
    const acoes = acoesRapidasPorPerfil(PERFIS.GESTOR, true);
    expect(acoes.map((a) => a.rotulo)).toEqual([
      "Novo paciente",
      "Paciente esporádico",
      "Nova liberação",
      "Registrar retirada",
      "Gerenciar usuários",
      "Consultar auditoria",
      "Consultar relatórios",
    ]);
    expect(acoes).toSatisfy((lista: { href: string }[]) =>
      lista.every((a) => a.href.startsWith("/dashboard/"))
    );
  });

  it("autorizador ativo cria paciente e lança liberação — Sprint44 também esporádico e retirada", () => {
    expect(acoesRapidasPorPerfil(PERFIS.PROFISSIONAL_AUTORIZADOR, true).map((a) => a.rotulo)).toEqual([
      "Novo paciente",
      "Paciente esporádico",
      "Nova liberação",
      "Registrar retirada",
    ]);
  });

  it("recepcionista ativa cadastra esporádico, cria liberação, renova e registra retirada — Sprint44", () => {
    expect(acoesRapidasPorPerfil(PERFIS.RECEPCIONISTA, true).map((a) => a.rotulo)).toEqual([
      "Paciente esporádico",
      "Nova liberação",
      "Renovar liberação",
      "Registrar retirada",
    ]);
  });

  it("nenhuma ação para perfil sem vínculo e para usuário inativo", () => {
    expect(acoesRapidasPorPerfil(null, null)).toEqual([]);
    expect(acoesRapidasPorPerfil(PERFIS.GESTOR, false)).toEqual([]);
    expect(acoesRapidasPorPerfil(PERFIS.RECEPCIONISTA, false)).toEqual([]);
  });
});

describe("capacidadeDashboard (integração com regras.ts)", () => {
  it("capacidade reais embarcam os mesmos módulos que a navegação apresenta", () => {
    const caps: CapacidadeDashboard[] = [
      capacidadeDashboard(PERFIS.GESTOR, true),
      capacidadeDashboard(PERFIS.PROFISSIONAL_AUTORIZADOR, true),
      capacidadeDashboard(PERFIS.RECEPCIONISTA, true),
      capacidadeDashboard(PERFIS.GESTOR, false),
      capacidadeDashboard(null, null),
    ];
    for (const cap of caps) {
      const modulos = modulosPorCapacidade(cap);
      for (const modulo of modulos) {
        switch (modulo.slug) {
          case "pacientes":
            expect(cap.pacientes).toBe(true);
            break;
          case "liberacoes":
            expect(cap.liberacoes).toBe(true);
            break;
          case "retiradas":
            expect(cap.retiradas).toBe(true);
            break;
          case "usuarios":
            expect(cap.usuarios).toBe(true);
            break;
          case "auditoria":
            expect(cap.auditoria).toBe(true);
            break;
          case "relatorios":
            expect(cap.relatorios).toBe(true);
            break;
          case "atendimento":
            expect(cap.atendimento).toBe(true);
            break;
        }
      }
    }
  });

  it("Histórico consolidado em Relatórios: /dashboard/historico não é módulo independente", () => {
    const cap = capacidadeDashboard(PERFIS.GESTOR, true);
    expect((cap as unknown as { historico?: boolean }).historico).toBeUndefined();
    const modulos = modulosPorCapacidade(cap);
    expect(modulos.map((m) => m.href)).not.toContain("/dashboard/historico");
    expect(modulos.map((m) => m.rotulo)).not.toContain("Histórico");
  });
});