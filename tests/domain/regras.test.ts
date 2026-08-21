import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import {
  calcularDataFim,
  isPeriodoValido,
  isQuantidadeValida,
  origemPermitidaPorPerfil,
  permissoesLiberacoes,
  permissoesPacientes,
  permissoesRelatorios,
  permissoesRetiradas,
  permissoesUsuarios,
  podeAutorizar,
  SENHA_MINIMA_CARACTERES,
  validarCriacaoUsuario,
  validarLiberacao,
  validarNovoPaciente,
  validarNovoUsuario,
  validarRetirada,
  validarTrocaDeSenha,
} from "@/lib/domain/regras";
import {
  ORIGENS_PACIENTE,
  PERFIS,
  PROFISSOES,
  TIPOS_LIBERACAO,
} from "@/lib/domain/enums";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";

function expectValidacao(fn: () => void, mensagem?: RegExp) {
  try {
    fn();
    expect.unreachable("deveria lançar AppError VALIDACAO");
  } catch (erro) {
    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).code).toBe("VALIDACAO");
    if (mensagem) expect((erro as AppError).message).toMatch(mensagem);
  }
}

describe("validarLiberacao — quantidades", () => {
  it("aceita quantidade 1, 2, 4 e 8", () => {
    for (const quantidade of [1, 2, 4, 8]) {
      expect(() =>
        validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade })
      ).not.toThrow();
    }
  });

  it("rejeita quantidade fora de 1/2/4/8 (RN04)", () => {
    for (const quantidade of [0, 3, 5, 10, -1]) {
      expectValidacao(() =>
        validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade })
      );
    }
  });
});

describe("validarLiberacao — períodos", () => {
  it("aceita contínua de 1, 3 e 6 meses (RN13)", () => {
    for (const periodo of [1, 3, 6]) {
      expect(() =>
        validarLiberacao({
          tipo: TIPOS_LIBERACAO.CONTINUA,
          quantidade: 4,
          periodoMeses: periodo,
        })
      ).not.toThrow();
    }
  });

  it("rejeita contínua sem período ou com período inválido", () => {
    expectValidacao(() =>
      validarLiberacao({ tipo: TIPOS_LIBERACAO.CONTINUA, quantidade: 4, periodoMeses: null })
    );
    expectValidacao(() =>
      validarLiberacao({ tipo: TIPOS_LIBERACAO.CONTINUA, quantidade: 4, periodoMeses: 2 })
    );
    expectValidacao(() =>
      validarLiberacao({ tipo: TIPOS_LIBERACAO.CONTINUA, quantidade: 4, periodoMeses: 12 })
    );
  });

  it("aceita avulsa sem período e rejeita avulsa com período", () => {
    expect(() =>
      validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 1, periodoMeses: null })
    ).not.toThrow();
    expectValidacao(() =>
      validarLiberacao({ tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 1, periodoMeses: 3 })
    );
  });

  it("rejeita tipo inválido", () => {
    expectValidacao(() =>
      validarLiberacao({ tipo: "mensal" as never, quantidade: 1 })
    );
  });
});

describe("validarLiberacao — RN29 (paciente esporádico somente avulsa)", () => {
  it("aceita avulsa para paciente esporádico", () => {
    expect(() =>
      validarLiberacao({
        tipo: TIPOS_LIBERACAO.AVULSA,
        quantidade: 1,
        origemPaciente: ORIGENS_PACIENTE.ESPORADICO,
      })
    ).not.toThrow();
  });

  it("rejeita contínua para paciente esporádico", () => {
    expectValidacao(
      () =>
        validarLiberacao({
          tipo: TIPOS_LIBERACAO.CONTINUA,
          quantidade: 4,
          periodoMeses: 3,
          origemPaciente: ORIGENS_PACIENTE.ESPORADICO,
        }),
      /RN29/
    );
  });

  it("aceita contínua para paciente regular", () => {
    expect(() =>
      validarLiberacao({
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 4,
        periodoMeses: 3,
        origemPaciente: ORIGENS_PACIENTE.REGULAR,
      })
    ).not.toThrow();
  });

  it("sem origem informada mantém o comportamento anterior", () => {
    expect(() =>
      validarLiberacao({
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 4,
        periodoMeses: 1,
      })
    ).not.toThrow();
  });
});

describe("isQuantidadeValida / isPeriodoValido", () => {
  it("reconhece valores válidos", () => {
    expect(isQuantidadeValida(4)).toBe(true);
    expect(isPeriodoValido(6)).toBe(true);
  });

  it("rejeita valores inválidos", () => {
    expect(isQuantidadeValida(7)).toBe(false);
    expect(isPeriodoValido(0)).toBe(false);
  });
});

describe("calcularDataFim (RN13/RN21)", () => {
  const inicio = new Date("2026-01-10T00:00:00.000Z");

  it("avulsa = data_inicio + 1 dia", () => {
    const fim = calcularDataFim(TIPOS_LIBERACAO.AVULSA, inicio);
    expect(fim.toISOString().slice(0, 10)).toBe("2026-01-11");
  });

  it("contínua de 1 mês", () => {
    expect(calcularDataFim(TIPOS_LIBERACAO.CONTINUA, inicio, 1).toISOString().slice(0, 10)).toBe("2026-02-10");
  });

  it("contínua de 3 meses", () => {
    expect(calcularDataFim(TIPOS_LIBERACAO.CONTINUA, inicio, 3).toISOString().slice(0, 10)).toBe("2026-04-10");
  });

  it("contínua de 6 meses", () => {
    expect(calcularDataFim(TIPOS_LIBERACAO.CONTINUA, inicio, 6).toISOString().slice(0, 10)).toBe("2026-07-10");
  });

  it("não muta a data de entrada", () => {
    const original = inicio.toISOString();
    calcularDataFim(TIPOS_LIBERACAO.CONTINUA, inicio, 6);
    expect(inicio.toISOString()).toBe(original);
  });
});

describe("validarNovoPaciente", () => {
  it("aceita dados mínimos válidos", () => {
    expect(() => validarNovoPaciente({ gestor_sus: "123456", nome: "Maria" })).not.toThrow();
  });

  it("aceita origem regular e esporadico explícitas", () => {
    expect(() =>
      validarNovoPaciente({
        gestor_sus: "123456",
        nome: "Maria",
        origem: ORIGENS_PACIENTE.REGULAR,
      })
    ).not.toThrow();
    expect(() =>
      validarNovoPaciente({
        gestor_sus: "123456",
        nome: "Maria",
        origem: ORIGENS_PACIENTE.ESPORADICO,
      })
    ).not.toThrow();
  });

  it("rejeita origem inválida", () => {
    expectValidacao(() =>
      validarNovoPaciente({
        gestor_sus: "123456",
        nome: "Maria",
        origem: "temporario" as never,
      })
    );
  });

  it("rejeita gestor_sus vazio", () => {
    expectValidacao(() => validarNovoPaciente({ gestor_sus: "  ", nome: "Maria" }));
  });

  it("rejeita nome vazio", () => {
    expectValidacao(() => validarNovoPaciente({ gestor_sus: "123", nome: "" }));
  });
});

describe("origemPermitidaPorPerfil (Sprint 38)", () => {
  it("gestor cadastra somente regular", () => {
    expect(origemPermitidaPorPerfil(PERFIS.GESTOR)).toBe(
      ORIGENS_PACIENTE.REGULAR
    );
  });

  it("profissional autorizador cadastra somente regular", () => {
    expect(origemPermitidaPorPerfil(PERFIS.PROFISSIONAL_AUTORIZADOR)).toBe(
      ORIGENS_PACIENTE.REGULAR
    );
  });

  it("recepcionista cadastra somente esporadico", () => {
    expect(origemPermitidaPorPerfil(PERFIS.RECEPCIONISTA)).toBe(
      ORIGENS_PACIENTE.ESPORADICO
    );
  });
});

describe("validarCriacaoUsuario (Sprint 16)", () => {
  const base = {
    nome: "Ana Souza",
    email: "ana@example.com",
    perfil: PERFIS.RECEPCIONISTA,
    profissao: null,
  };

  it("aceita dados mínimos válidos (recepcionista/gestor sem profissão)", () => {
    expect(() => validarCriacaoUsuario(base)).not.toThrow();
    expect(() =>
      validarCriacaoUsuario({ ...base, perfil: PERFIS.GESTOR })
    ).not.toThrow();
  });

  it("aceita autorizador com profissão (RN02)", () => {
    expect(() =>
      validarCriacaoUsuario({
        ...base,
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: PROFISSOES.PSICOLOGO,
      })
    ).not.toThrow();
  });

  it("rejeita nome obrigatório", () => {
    expectValidacao(() =>
      validarCriacaoUsuario({ ...base, nome: "   " })
    );
  });

  it("rejeita nome acima de 120 caracteres", () => {
    expectValidacao(() =>
      validarCriacaoUsuario({ ...base, nome: "x".repeat(121) })
    );
  });

  it("rejeita e-mail obrigatório", () => {
    expectValidacao(() => validarCriacaoUsuario({ ...base, email: "" }));
  });

  it("rejeita e-mail sem formato válido", () => {
    for (const email of ["sem-arroba", "a@b", "a@b.", "a b@c.com"]) {
      expectValidacao(() => validarCriacaoUsuario({ ...base, email }));
    }
  });

  it("aceita e-mail com caixa mista (normalização fica no serviço)", () => {
    expect(() =>
      validarCriacaoUsuario({ ...base, email: "Ana@Example.COM" })
    ).not.toThrow();
  });

  it("rejeita autorizador sem profissão (RN02)", () => {
    expectValidacao(() =>
      validarCriacaoUsuario({
        ...base,
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: null,
      })
    );
  });

  it("rejeita profissão em perfil que não seja autorizador", () => {
    expectValidacao(() =>
      validarCriacaoUsuario({
        ...base,
        perfil: PERFIS.GESTOR,
        profissao: PROFISSOES.ASSISTENTE_SOCIAL,
      })
    );
  });
});

describe("validarNovoUsuario", () => {
  it("aceita autorizador com profissão", () => {
    expect(() =>
      validarNovoUsuario({
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: PROFISSOES.PSICOLOGO,
      })
    ).not.toThrow();
  });

  it("rejeita autorizador sem profissão (RN02)", () => {
    expectValidacao(() =>
      validarNovoUsuario({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR, profissao: null })
    );
  });

  it("rejeita profissão em perfil que não seja autorizador", () => {
    expectValidacao(() =>
      validarNovoUsuario({ perfil: PERFIS.GESTOR, profissao: PROFISSOES.ASSISTENTE_SOCIAL })
    );
  });

  it("aceita gestor/recepcionista sem profissão", () => {
    expect(() => validarNovoUsuario({ perfil: PERFIS.GESTOR })).not.toThrow();
    expect(() => validarNovoUsuario({ perfil: PERFIS.RECEPCIONISTA })).not.toThrow();
  });
});

describe("validarRetirada (RN14)", () => {
  it("aceita quantidade positiva", () => {
    expect(() => validarRetirada({ quantidade: 1 })).not.toThrow();
    expect(() => validarRetirada({ quantidade: 8 })).not.toThrow();
  });

  it("rejeita quantidade zero ou negativa", () => {
    expectValidacao(() => validarRetirada({ quantidade: 0 }));
    expectValidacao(() => validarRetirada({ quantidade: -2 }));
  });

  it("rejeita quantidade não inteira", () => {
    expectValidacao(() => validarRetirada({ quantidade: 1.5 }));
  });
});

describe("podeAutorizar (derivado de perfil + profissao + status_ativo)", () => {
  it("autorizador ativo com profissão pode autorizar", () => {
    expect(podeAutorizar(PERFIS.PROFISSIONAL_AUTORIZADOR, PROFISSOES.ASSISTENTE_SOCIAL, true)).toBe(true);
  });

  it("autorizador sem profissão não pode autorizar", () => {
    expect(podeAutorizar(PERFIS.PROFISSIONAL_AUTORIZADOR, null, true)).toBe(false);
  });

  it("autorizador inativo não pode autorizar (RN27)", () => {
    expect(podeAutorizar(PERFIS.PROFISSIONAL_AUTORIZADOR, PROFISSOES.ASSISTENTE_SOCIAL, false)).toBe(false);
  });

  it("outros perfis nunca podem autorizar", () => {
    expect(podeAutorizar(PERFIS.GESTOR, null, true)).toBe(false);
    expect(podeAutorizar(PERFIS.RECEPCIONISTA, null, true)).toBe(false);
  });
});

describe("permissoesPacientes (política de UI espelhando a RLS)", () => {
  it("usuário sem perfil funcional não acessa", () => {
    const p = permissoesPacientes(null, true);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeCriarRegular).toBe(false);
    expect(p.podeCriarEsporadico).toBe(false);
    expect(p.podeEditarDados).toBe(false);
    expect(p.podeAlterarStatus).toBe(false);
  });

  it("usuário inativo não acessa dados operacionais", () => {
    const p = permissoesPacientes(PERFIS.GESTOR, false);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeCriarRegular).toBe(false);
    expect(p.podeCriarEsporadico).toBe(false);
    expect(p.podeEditarDados).toBe(false);
    expect(p.podeAlterarStatus).toBe(false);
  });

  it("gestor ativo: acesso + criar regular + alterar status (sem editar dados)", () => {
    const p = permissoesPacientes(PERFIS.GESTOR, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeCriarRegular).toBe(true);
    expect(p.podeCriarEsporadico).toBe(false);
    expect(p.podeEditarDados).toBe(false);
    expect(p.podeAlterarStatus).toBe(true);
  });

  it("profissional autorizador ativo: acesso + criar regular + editar dados (sem alterar status)", () => {
    const p = permissoesPacientes(PERFIS.PROFISSIONAL_AUTORIZADOR, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeCriarRegular).toBe(true);
    expect(p.podeCriarEsporadico).toBe(false);
    expect(p.podeEditarDados).toBe(true);
    expect(p.podeAlterarStatus).toBe(false);
  });

  it("recepcionista ativa: criar esporádico + leitura (sem criar regular/editar/status)", () => {
    const p = permissoesPacientes(PERFIS.RECEPCIONISTA, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeCriarRegular).toBe(false);
    expect(p.podeCriarEsporadico).toBe(true);
    expect(p.podeEditarDados).toBe(false);
    expect(p.podeAlterarStatus).toBe(false);
  });
});

describe("permissoesUsuarios (Sprint 12 — gestão restrita ao Gestor ativo)", () => {
  it("usuário sem perfil funcional não acessa a gestão", () => {
    const p = permissoesUsuarios(null, true);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeAlterarStatus).toBe(false);
  });

  it("usuário inativo não acessa a gestão", () => {
    const p = permissoesUsuarios(PERFIS.GESTOR, false);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeAlterarStatus).toBe(false);
  });

  it("gestor ativo: acesso + alterar status", () => {
    const p = permissoesUsuarios(PERFIS.GESTOR, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeAlterarStatus).toBe(true);
  });

  it("profissional autorizador ativo NÃO acessa a gestão", () => {
    const p = permissoesUsuarios(PERFIS.PROFISSIONAL_AUTORIZADOR, true);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeAlterarStatus).toBe(false);
  });

  it("recepcionista ativa NÃO acessa a gestão", () => {
    const p = permissoesUsuarios(PERFIS.RECEPCIONISTA, true);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeAlterarStatus).toBe(false);
  });
});

describe("permissoesLiberacoes (Sprint 18 — política de UI espelhando a RLS)", () => {
  it("usuário sem perfil funcional não acessa liberações", () => {
    const p = permissoesLiberacoes(null, true);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeCriar).toBe(false);
    expect(p.podeRenovar).toBe(false);
  });

  it("usuário inativo não acessa liberações", () => {
    const p = permissoesLiberacoes(PERFIS.GESTOR, false);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeCriar).toBe(false);
    expect(p.podeRenovar).toBe(false);
  });

  it("autorizador ativo: acessa e cria, sem renovação", () => {
    const p = permissoesLiberacoes(PERFIS.PROFISSIONAL_AUTORIZADOR, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeCriar).toBe(true);
    expect(p.podeRenovar).toBe(false);
    expect(p.visualizaSomenteAtivas).toBe(false);
  });

  it("recepcionista ativa: acessa (somente ativas) e renova, sem criar nova", () => {
    const p = permissoesLiberacoes(PERFIS.RECEPCIONISTA, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeCriar).toBe(false);
    expect(p.podeRenovar).toBe(true);
    expect(p.visualizaSomenteAtivas).toBe(true);
  });

  it("gestor ativo: acessa, não cria nem renova (RLS só autoriza autorizador/recepção)", () => {
    const p = permissoesLiberacoes(PERFIS.GESTOR, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeCriar).toBe(false);
    expect(p.podeRenovar).toBe(false);
    expect(p.visualizaSomenteAtivas).toBe(false);
  });
});

describe("permissoesRetiradas (Sprint 20 — política de UI espelhando a RLS)", () => {
  it("usuário sem perfil funcional não acessa retiradas", () => {
    const p = permissoesRetiradas(null, true);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeRegistrar).toBe(false);
    expect(p.visualizaResponsavel).toBe(false);
  });

  it("usuário inativo não acessa retiradas", () => {
    const p = permissoesRetiradas(PERFIS.RECEPCIONISTA, false);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeRegistrar).toBe(false);
    expect(p.visualizaResponsavel).toBe(false);
  });

  it("autorizador ativo NÃO acessa retiradas (módulo da recepção/gestão)", () => {
    const p = permissoesRetiradas(PERFIS.PROFISSIONAL_AUTORIZADOR, true);
    expect(p.podeAcessar).toBe(false);
    expect(p.podeRegistrar).toBe(false);
    expect(p.visualizaResponsavel).toBe(false);
  });

  it("recepcionista ativa: acessa, registra, mas não vê o responsável (RLS usuarios)", () => {
    const p = permissoesRetiradas(PERFIS.RECEPCIONISTA, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeRegistrar).toBe(true);
    expect(p.visualizaResponsavel).toBe(false);
  });

  it("gestor ativo: acessa (somente leitura), não registra, mas vê o responsável", () => {
    const p = permissoesRetiradas(PERFIS.GESTOR, true);
    expect(p.podeAcessar).toBe(true);
    expect(p.podeRegistrar).toBe(false);
    expect(p.visualizaResponsavel).toBe(true);
  });
});

describe("permissoesRelatorios (Sprint 37 — Fase 8, política de UI espelhando a RLS)", () => {
  it("sem perfil funcional não consulta relatórios", () => {
    const p = permissoesRelatorios(null, true);
    expect(p.podeConsultar).toBe(false);
  });

  it("usuário inativo não consulta relatórios", () => {
    const p = permissoesRelatorios(PERFIS.GESTOR, false);
    expect(p.podeConsultar).toBe(false);
  });

  it("autorizador ativo NÃO consulta relatórios (acesso restrito ao Gestor)", () => {
    const p = permissoesRelatorios(PERFIS.PROFISSIONAL_AUTORIZADOR, true);
    expect(p.podeConsultar).toBe(false);
  });

  it("recepcionista ativa NÃO consulta relatórios", () => {
    const p = permissoesRelatorios(PERFIS.RECEPCIONISTA, true);
    expect(p.podeConsultar).toBe(false);
  });

  it("gestor ativo consulta relatórios", () => {
    const p = permissoesRelatorios(PERFIS.GESTOR, true);
    expect(p.podeConsultar).toBe(true);
  });
});

describe("inexistência de pode_autorizar", () => {
  it("o tipo UsuarioFuncional não possui campo pode_autorizar", () => {
    const usuario: UsuarioFuncional = {
      id: "u1",
      auth_user_id: "a1",
      nome: "João",
      email: "joao@example.com",
      perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
      profissao: PROFISSOES.PSICOLOGO,
      status_ativo: true,
      unidade_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    expect(usuario).not.toHaveProperty("pode_autorizar");
  });
});

describe("validarTrocaDeSenha (Sprint 17)", () => {
  it("exige nova senha obrigatória", () => {
    expectValidacao(
      () => validarTrocaDeSenha({ novaSenha: "", confirmacao: "outra" }),
      /Informe a nova senha/
    );
  });

  it("exige confirmação obrigatória", () => {
    expectValidacao(
      () => validarTrocaDeSenha({ novaSenha: "segredo123", confirmacao: "" }),
      /Confirme a nova senha/
    );
  });

  it("rejeita senha abaixo do mínimo definido", () => {
    expectValidacao(
      () =>
        validarTrocaDeSenha({
          novaSenha: "1234567",
          confirmacao: "1234567",
        }),
      new RegExp(String(SENHA_MINIMA_CARACTERES))
    );
  });

  it("rejeita senhas diferentes", () => {
    expectValidacao(
      () =>
        validarTrocaDeSenha({
          novaSenha: "senha12345",
          confirmacao: "senha54321",
        }),
      /não coincidem/
    );
  });

  it("aceita senha válida dentro da política mínima", () => {
    expect(() =>
      validarTrocaDeSenha({
        novaSenha: "senha-segura-1",
        confirmacao: "senha-segura-1",
      })
    ).not.toThrow();
  });
});
