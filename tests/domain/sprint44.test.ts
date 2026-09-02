import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import {
  origensPermitidasPorPerfil,
  podeCriarPacienteComOrigem,
  validarVigenciaComRetiradas,
  estadoPrevisao,
  isEstouro,
  permissoesPacientes,
  permissoesLiberacoes,
  permissoesRetiradas,
} from "@/lib/domain/regras";
import { ORIGENS_PACIENTE, PERFIS } from "@/lib/domain/enums";
import { podeRenovarStatus } from "@/lib/domain/liberacoes/renovacao";
import { mapearEventoHistorico, ordenarEventos } from "@/lib/domain/relatorios/eventos";
import { GLOSSARIO_RESUMO, GLOSSARIO_CONSOLIDADO, CONVENCAO_PREVISAO } from "@/lib/domain/relatorios/glossario";

describe("Sprint44 — origensPermitidasPorPerfil", () => {
  it("gestor e autorizador criam regular e esporadico", () => {
    expect(origensPermitidasPorPerfil(PERFIS.GESTOR)).toEqual(["regular", "esporadico"]);
    expect(origensPermitidasPorPerfil(PERFIS.PROFISSIONAL_AUTORIZADOR)).toEqual(["regular", "esporadico"]);
  });
  it("recepcionista cria só esporadico", () => {
    expect(origensPermitidasPorPerfil(PERFIS.RECEPCIONISTA)).toEqual(["esporadico"]);
  });
  it("podeCriarPacienteComOrigem respeita matriz", () => {
    expect(podeCriarPacienteComOrigem(PERFIS.GESTOR, ORIGENS_PACIENTE.REGULAR)).toBe(true);
    expect(podeCriarPacienteComOrigem(PERFIS.GESTOR, ORIGENS_PACIENTE.ESPORADICO)).toBe(true);
    expect(podeCriarPacienteComOrigem(PERFIS.PROFISSIONAL_AUTORIZADOR, ORIGENS_PACIENTE.ESPORADICO)).toBe(true);
    expect(podeCriarPacienteComOrigem(PERFIS.RECEPCIONISTA, ORIGENS_PACIENTE.REGULAR)).toBe(false);
    expect(podeCriarPacienteComOrigem(PERFIS.RECEPCIONISTA, ORIGENS_PACIENTE.ESPORADICO)).toBe(true);
  });
});

describe("Sprint44 — matriz de permissões ampliada", () => {
  it("gestor cria liberacao", () => expect(permissoesLiberacoes(PERFIS.GESTOR, true).podeCriar).toBe(true));
  it("recepcionista cria liberacao", () => expect(permissoesLiberacoes(PERFIS.RECEPCIONISTA, true).podeCriar).toBe(true));
  it("todos registram retirada", () => {
    for (const p of [PERFIS.GESTOR, PERFIS.PROFISSIONAL_AUTORIZADOR, PERFIS.RECEPCIONISTA]) {
      expect(permissoesRetiradas(p, true).podeRegistrar).toBe(true);
    }
  });
  it("paciente esporadico reutilizável — mesma origem pode ter N liberacoes (não há bloqueio de duplicidade)", () => {
    // Domínio não impede criar segunda liberação avulsa para mesmo esporádico
    const p = permissoesPacientes(PERFIS.RECEPCIONISTA, true);
    expect(p.podeCriarEsporadico).toBe(true);
  });
});

describe("Sprint44 P1 — validarVigenciaComRetiradas", () => {
  it("permite edição quando não há retiradas", () => {
    expect(() => validarVigenciaComRetiradas({ novaDataInicio: "2026-08-15", novaDataFim: "2026-09-15" })).not.toThrow();
  });
  it("permite quando nova janela ainda contém min/max", () => {
    expect(() =>
      validarVigenciaComRetiradas({
        novaDataInicio: "2026-08-01",
        novaDataFim: "2026-08-31",
        menorRetirada: "2026-08-05T10:00:00Z",
        maiorRetirada: "2026-08-19T10:00:00Z",
      })
    ).not.toThrow();
  });
  it("rejeita quando nova data_inicio exclui menor retirada", () => {
    expect(() =>
      validarVigenciaComRetiradas({
        novaDataInicio: "2026-08-15",
        novaDataFim: "2026-09-15",
        menorRetirada: "2026-08-05T10:00:00Z",
        maiorRetirada: "2026-08-19T10:00:00Z",
      })
    ).toThrow(AppError);
  });
  it("rejeita quando nova data_fim exclui maior retirada", () => {
    expect(() =>
      validarVigenciaComRetiradas({
        novaDataInicio: "2026-08-01",
        novaDataFim: "2026-08-10",
        menorRetirada: "2026-08-05T10:00:00Z",
        maiorRetirada: "2026-08-19T10:00:00Z",
      })
    ).toThrow(AppError);
  });
});

describe("Sprint44 P1/P2 — estouro de previsão (RN31 sem bloqueio)", () => {
  it("dentro quando total <= previsto", () => {
    expect(estadoPrevisao(192, 190)).toBe("dentro");
    expect(isEstouro(192, 190)).toBe(false);
  });
  it("estouro quando total > previsto", () => {
    expect(estadoPrevisao(192, 210)).toBe("estouro");
    expect(isEstouro(192, 210)).toBe(true);
  });
  it("caso do enunciado 192 previsto 210 retirado → estouro true mas sem bloqueio", () => {
    // A regra NÃO bloqueia — apenas sinaliza
    expect(isEstouro(192, 210)).toBe(true);
    // Não há threshold arbitrário: qualquer > previsto é estouro
    expect(isEstouro(32, 33)).toBe(true);
  });
});

describe("Sprint44 P2 — renovação formalizada", () => {
  it("ativa e expirada podem renovar, cancelada não", () => {
    expect(podeRenovarStatus("ativa")).toBe(true);
    expect(podeRenovarStatus("expirada")).toBe(true);
    expect(podeRenovarStatus("cancelada")).toBe(false);
  });
});

describe("Sprint44 P2 — histórico estado+eventos", () => {
  it("mapeia evento histórico e ordena por data", () => {
    const e1 = mapearEventoHistorico({ id: 2, acao: "retirada.registrada", data_hora: "2026-08-12T10:00:00Z", entidade_tipo: "retiradas", entidade_id: "r1", usuario_id: "u1" });
    const e2 = mapearEventoHistorico({ id: 1, acao: "liberacao.criada", data_hora: "2026-08-01T10:00:00Z", entidade_tipo: "liberacoes", entidade_id: "l1", usuario_id: "u1" });
    const ordenados = ordenarEventos([e1, e2]);
    expect(ordenados[0].acao).toBe("liberacao.criada");
    expect(ordenados[1].acao).toBe("retirada.registrada");
  });
});

describe("Sprint44 P2 — glossário unificado", () => {
  it("glossário contém definições por relatório e convenção 4 semanas", () => {
    expect(GLOSSARIO_RESUMO.previsto).toMatch(/data_inicio/);
    expect(GLOSSARIO_CONSOLIDADO.previsto).toMatch(/liberacoes\.quantidade/);
    expect(CONVENCAO_PREVISAO).toMatch(/4 semanas/);
  });
});
