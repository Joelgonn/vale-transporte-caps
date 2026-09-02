import { describe, it, expect } from "vitest";
import {
  permissoesLiberacoes,
  permissoesPacientes,
  validarLiberacao,
} from "@/lib/domain/regras";
import { ORIGENS_PACIENTE, PERFIS, TIPOS_LIBERACAO } from "@/lib/domain/enums";

describe("Sprint47 — fluxo operacional da recepção", () => {
  it("recepcionista NÃO cria paciente regular, mas cria esporádico dentro do fluxo avulso", () => {
    const rec = permissoesPacientes(PERFIS.RECEPCIONISTA, true);
    expect(rec.podeCriarRegular).toBe(false);
    expect(rec.podeCriarEsporadico).toBe(true);
  });

  it("recepcionista pode criar liberação AVULSA, mas NÃO contínua (Sprint47 corrige Sprint44)", () => {
    const rec = permissoesLiberacoes(PERFIS.RECEPCIONISTA, true);
    expect(rec.podeCriarAvulsa).toBe(true);
    expect(rec.podeCriarContinua).toBe(false);
    expect(rec.podeCriar).toBe(true); // avulsa
  });

  it("gestor e autorizador criam contínua e avulsa", () => {
    for (const perfil of [PERFIS.GESTOR, PERFIS.PROFISSIONAL_AUTORIZADOR]) {
      const p = permissoesLiberacoes(perfil, true);
      expect(p.podeCriarAvulsa).toBe(true);
      expect(p.podeCriarContinua).toBe(true);
    }
  });

  it("paciente regular pode receber contínua e avulsa", () => {
    expect(() => validarLiberacao({ tipo: TIPOS_LIBERACAO.CONTINUA, quantidade: 4, periodoMeses: 3, origemPaciente: ORIGENS_PACIENTE.REGULAR })).not.toThrow();
    expect(() => validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 4, origemPaciente: ORIGENS_PACIENTE.REGULAR })).not.toThrow();
  });

  it("paciente esporádico só avulsa — contínua é bloqueada (RN29)", () => {
    expect(() => validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 2, origemPaciente: ORIGENS_PACIENTE.ESPORADICO })).not.toThrow();
    expect(() => validarLiberacao({ tipo: TIPOS_LIBERACAO.CONTINUA, quantidade: 4, periodoMeses: 3, origemPaciente: ORIGENS_PACIENTE.ESPORADICO })).toThrow();
  });

  it("paciente esporádico pode ser reutilizado — mesma origem permite N avulsas", () => {
    // Não há regra que impeça segunda avulsa para mesmo esporádico
    expect(() => validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 1, origemPaciente: ORIGENS_PACIENTE.ESPORADICO })).not.toThrow();
    expect(() => validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 1, origemPaciente: ORIGENS_PACIENTE.ESPORADICO })).not.toThrow();
  });

  it("recepção localiza paciente existente — permissoesPacientes.podeAcessar", () => {
    expect(permissoesPacientes(PERFIS.RECEPCIONISTA, true).podeAcessar).toBe(true);
  });

  it("paciente.origem continua independente de liberacoes.tipo", () => {
    // Origem é do paciente, tipo é da liberação — não são sinônimos
    expect(ORIGENS_PACIENTE.REGULAR).not.toBe(TIPOS_LIBERACAO.CONTINUA);
    expect(ORIGENS_PACIENTE.ESPORADICO).not.toBe(TIPOS_LIBERACAO.AVULSA);
  });
});
