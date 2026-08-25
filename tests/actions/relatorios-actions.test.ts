import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS } from "@/lib/domain/enums";
import type { FiltrosRelatorio, ResultadoListaRelatorio } from "@/lib/domain/relatorios/types";

type AuthSupabaseMock = ReturnType<typeof authSupabase>;

function authSupabase(user: { id: string; email: string } | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: null,
      })),
    },
  };
}

const { mocks, state } = vi.hoisted(() => ({
  mocks: {
    getUsuarioFuncional: vi.fn(),
    consultar: vi.fn(),
    obterResumo: vi.fn(),
  },
  state: { supabase: null as AuthSupabaseMock | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => state.supabase ?? authSupabase(null)),
}));

vi.mock("@/lib/auth/profile", () => ({
  getUsuarioFuncional: (...args: unknown[]) => mocks.getUsuarioFuncional(...args),
}));

vi.mock("@/lib/services/relatorio-service", () => ({
  RelatorioService: {
    create: vi.fn(async () => ({
      consultar: (...args: unknown[]) => mocks.consultar(...args),
      obterResumo: (...args: unknown[]) => mocks.obterResumo(...args),
    })),
  },
}));

import {
  consultarRelatorioAction,
  relatorioResumoAction,
} from "@/app/actions/relatorios";

const resultado: ResultadoListaRelatorio = {
  tipo: "liberacoes",
  linhas: [],
  total: 0,
  pagina: 1,
  porPagina: 20,
};

const filtros: FiltrosRelatorio = { tipo: "liberacoes", pagina: 1 };

function usuario(sobre: Partial<Record<string, unknown>> = {}) {
  return {
    usuarioId: "u1",
    perfil: PERFIS.GESTOR,
    statusAtivo: true,
    ...sobre,
  };
}

beforeEach(() => {
  state.supabase = authSupabase({ id: "a1", email: "gestor@caps.local" });
  mocks.getUsuarioFuncional.mockReset();
  mocks.consultar.mockReset();
  mocks.obterResumo.mockReset();
  mocks.getUsuarioFuncional.mockResolvedValue(usuario());
  mocks.consultar.mockResolvedValue(resultado);
  mocks.obterResumo.mockResolvedValue({
    totalPacientes: 0,
    totalLiberacoes: 0,
    totalValesAutorizados: 0,
    totalValesRetirados: 0,
    saldoTotal: 0,
    totalLiberacoesContinuas: 0,
    totalLiberacoesAvulsas: 0,
    linhas: [],
  });
});

describe("consultarRelatorioAction", () => {
  it("Gestor ativo consulta relatórios e recebe os dados do serviço", async () => {
    const retorno = await consultarRelatorioAction(filtros);
    expect(retorno).toEqual({ ok: true, data: resultado });
    expect(mocks.consultar).toHaveBeenCalledWith(filtros);
  });

  it("sessão não autenticada recebe acesso negado sem consultar", async () => {
    state.supabase = authSupabase(null);
    const retorno = await consultarRelatorioAction(filtros);
    expect(retorno).toEqual({ ok: false, error: "Sessão não autenticada." });
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("usuário inativo recebe acesso negado", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue(usuario({ statusAtivo: false }));
    const retorno = await consultarRelatorioAction(filtros);
    expect(retorno.ok).toBe(false);
    expect(retorno.ok === false && retorno.error).toMatch(/inativo/i);
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("usuário sem perfil funcional recebe acesso negado", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue(null);
    const retorno = await consultarRelatorioAction(filtros);
    expect(retorno.ok).toBe(false);
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("autorizador ativo NÃO consulta relatórios (restrito ao Gestor)", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue(
      usuario({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR })
    );
    const retorno = await consultarRelatorioAction(filtros);
    expect(retorno).toEqual({
      ok: false,
      error: "Somente o Gestor pode consultar relatórios.",
    });
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("erro de validação do domínio é exibível", async () => {
    mocks.consultar.mockRejectedValue(new AppError("VALIDACAO", "Página inválida."));
    const retorno = await consultarRelatorioAction({ ...filtros, pagina: 0 });
    expect(retorno).toEqual({ ok: false, error: "Página inválida." });
  });

  it("erro inesperado vira mensagem genérica (sem expor stack/SQL)", async () => {
    mocks.consultar.mockRejectedValue(new Error("SQLSTATE 42501: permission denied"));
    const retorno = await consultarRelatorioAction(filtros);
    expect(retorno.ok).toBe(false);
    expect(retorno.ok === false && retorno.error).toBe("Ocorreu um erro inesperado.");
  });
});
describe("relatorioResumoAction (Sprint 40)", () => {
  const filtrosResumo: FiltrosRelatorio = { tipo: "resumo", pagina: 1 };

  it("Gestor ativo obtém o resumo via serviço", async () => {
    const retorno = await relatorioResumoAction(filtrosResumo);
    expect(retorno.ok).toBe(true);
    expect(mocks.obterResumo).toHaveBeenCalledWith(filtrosResumo);
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("recepcionista ativa NÃO acessa o resumo", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue(
      usuario({ perfil: PERFIS.RECEPCIONISTA })
    );
    const retorno = await relatorioResumoAction(filtrosResumo);
    expect(retorno).toEqual({
      ok: false,
      error: "Somente o Gestor pode consultar relatórios.",
    });
    expect(mocks.obterResumo).not.toHaveBeenCalled();
  });

  it("profissional autorizador ativo NÃO acessa o resumo", async () => {
    mocks.getUsuarioFuncional.mockResolvedValue(
      usuario({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR })
    );
    const retorno = await relatorioResumoAction(filtrosResumo);
    expect(retorno.ok).toBe(false);
    expect(mocks.obterResumo).not.toHaveBeenCalled();
  });

  it("sessão não autenticada recebe acesso negado sem consultar", async () => {
    state.supabase = authSupabase(null);
    const retorno = await relatorioResumoAction(filtrosResumo);
    expect(retorno).toEqual({ ok: false, error: "Sessão não autenticada." });
    expect(mocks.obterResumo).not.toHaveBeenCalled();
  });

  it("erro inesperado vira mensagem genérica", async () => {
    mocks.obterResumo.mockRejectedValue(new Error("SQLSTATE 42501"));
    const retorno = await relatorioResumoAction(filtrosResumo);
    expect(retorno.ok).toBe(false);
    expect(retorno.ok === false && retorno.error).toBe("Ocorreu um erro inesperado.");
  });
});
