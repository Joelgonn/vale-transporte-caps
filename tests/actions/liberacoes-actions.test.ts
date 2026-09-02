import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS, TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type {
  LiberacaoComPaciente,
  NovaLiberacao,
} from "@/lib/domain/liberacoes/types";

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
    createService: vi.fn(),
    buscarPaciente: vi.fn(),
  },
  state: { supabase: null as AuthSupabaseMock | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => state.supabase ?? authSupabase(null)),
}));

vi.mock("@/lib/auth/profile", () => ({
  getUsuarioFuncional: (...args: unknown[]) => mocks.getUsuarioFuncional(...args),
}));

vi.mock("@/lib/services/liberacao-service", () => ({
  LiberacaoService: {
    create: (...args: unknown[]) => mocks.createService(...args),
  },
}));

vi.mock("@/lib/services/paciente-service", () => ({
  PacienteService: {
    create: vi.fn(async () => ({
      buscarPaciente: mocks.buscarPaciente,
    })),
  },
}));

import {
  atualizarLiberacaoAction,
  buscarLiberacaoAction,
  criarLiberacaoAction,
  listarLiberacoesAction,
} from "@/app/actions/liberacoes";

function liberacao(sobre?: Partial<LiberacaoComPaciente>): LiberacaoComPaciente {
  return {
    id: "l1",
    paciente_id: "p1",
    tipo: TIPOS_LIBERACAO.AVULSA,
    quantidade: 1,
    periodo_meses: null,
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-01-02T00:00:00.000Z",
    profissional_autorizador_id: "u1",
    registrado_por_id: "u1",
    renovacao_de_id: null,
    status: "ativa",
    justificativa: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    ...sobre,
  };
}

function serviceFake() {
  return {
    listarLiberacoes: vi.fn(async () => [liberacao()]),
    buscarLiberacao: vi.fn(async (): Promise<LiberacaoComPaciente | null> => liberacao()),
    criarLiberacao: vi.fn(async (dados: NovaLiberacao) => {
      void dados;
      return liberacao();
    }),
    atualizarLiberacao: vi.fn(async () => liberacao()),
  };
}

function comSessao() {
  state.supabase = authSupabase({ id: "auth-user-1", email: "autorizador@caps.local" });
}

function comPerfil(sobre?: {
  perfil?: string | null;
  statusAtivo?: boolean | null;
  usuarioId?: string | null;
}) {
  const tem = (k: "perfil" | "statusAtivo" | "usuarioId") =>
    Object.prototype.hasOwnProperty.call(sobre ?? {}, k);
  mocks.getUsuarioFuncional.mockResolvedValue({
    id: "auth-user-1",
    perfil: tem("perfil") ? sobre!.perfil : PERFIS.PROFISSIONAL_AUTORIZADOR,
    statusAtivo: tem("statusAtivo") ? sobre!.statusAtivo : true,
    usuarioId: tem("usuarioId") ? sobre!.usuarioId : "u-autor",
  });
}

describe("listarLiberacoesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessao();
    comPerfil();
  });

  it("autorizador ativo lista liberações e repassa a busca", async () => {
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await listarLiberacoesAction("maria");

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data).toHaveLength(1);
    expect(fake.listarLiberacoes).toHaveBeenCalledWith("maria");
  });

  it("usuário inativo é bloqueado antes do serviço", async () => {
    comPerfil({ perfil: PERFIS.GESTOR, statusAtivo: false });

    const resultado = await listarLiberacoesAction();

    expect(resultado.ok).toBe(false);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("usuário sem vínculo é bloqueado", async () => {
    comPerfil({ perfil: null, statusAtivo: null });

    const resultado = await listarLiberacoesAction();

    expect(resultado.ok).toBe(false);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("sessão ausente é bloqueada", async () => {
    state.supabase = authSupabase(null);

    const resultado = await listarLiberacoesAction();

    expect(resultado.ok).toBe(false);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("NÃO vaza SQL cru de erro desconhecido", async () => {
    const fake = serviceFake();
    fake.listarLiberacoes.mockRejectedValue(
      new Error('syntax error at or near "select" — SQLSTATE 42601')
    );
    mocks.createService.mockResolvedValue(fake);

    const resultado = await listarLiberacoesAction();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).not.toMatch(/SQLSTATE|syntax error/);
      expect(resultado.error).toContain("inesperado");
    }
  });
});

describe("buscarLiberacaoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessao();
    comPerfil();
  });

  it("delega ao serviço", async () => {
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await buscarLiberacaoAction("l1");

    expect(resultado.ok).toBe(true);
    expect(fake.buscarLiberacao).toHaveBeenCalledWith("l1");
  });
});

describe("criarLiberacaoAction — identidade da sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessao();
    comPerfil();
    mocks.buscarPaciente.mockResolvedValue({ id: "p1", origem: "regular" });
  });

  it("autorizador ativo: profissionalAutorizadorId é resolvido da sessão (cliente não informa)", async () => {
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);
    const dados: NovaLiberacao = {
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
      periodoMeses: null,
    };

    const resultado = await criarLiberacaoAction(dados);

    expect(resultado.ok).toBe(true);
    expect(fake.criarLiberacao).toHaveBeenCalledWith(
      {
        ...dados,
        profissionalAutorizadorId: "u-autor",
      },
      "regular"
    );
    expect(fake.criarLiberacao.mock.calls[0][0]).not.toHaveProperty("registrado_por_id");
    expect(fake.criarLiberacao.mock.calls[0][0]).not.toHaveProperty("data_fim");
  });

  it("RN29 — action repassa a origem do paciente ao serviço (esporádico + contínua é barrado no service/banco)", async () => {
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);
    mocks.buscarPaciente.mockResolvedValue({ id: "p1", origem: "esporadico" });

    const resultado = await criarLiberacaoAction({
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.CONTINUA,
      quantidade: 4,
      periodoMeses: 3,
    });

    // A validação RN29 vive no LiberacaoService real (e no trigger do banco);
    // aqui verificamos que a action repassa a origem correta para a validação.
    expect(fake.criarLiberacao).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: TIPOS_LIBERACAO.CONTINUA }),
      "esporadico"
    );
    void resultado;
  });

  it("✓ paciente esporádico aceita liberação avulsa", async () => {
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);
    mocks.buscarPaciente.mockResolvedValue({ id: "p1", origem: "esporadico" });

    const resultado = await criarLiberacaoAction({
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
      periodoMeses: null,
    });

    expect(resultado.ok).toBe(true);
    expect(fake.criarLiberacao).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: TIPOS_LIBERACAO.AVULSA }),
      "esporadico"
    );
  });

  it("autorizador ativo sem usuarios.id (sem vínculo) é bloqueado", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR, statusAtivo: true, usuarioId: null });

    const resultado = await criarLiberacaoAction({
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
    });

    expect(resultado.ok).toBe(false);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("recepcionista ativa renova: cliente envia só renovacaoDeId; servidor usa a liberação original", async () => {
    comPerfil({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true, usuarioId: "u-recep" });
    const fake = serviceFake();
    fake.buscarLiberacao.mockResolvedValue(
      liberacao({
        id: "l-origem",
        paciente_id: "p1",
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 4,
        periodo_meses: 3,
        profissional_autorizador_id: "u-autor",
      })
    );
    mocks.createService.mockResolvedValue(fake);

    // O cliente NÃO informa profissional_autorizador_id — envia apenas o id.
    const resultado = await criarLiberacaoAction({ renovacaoDeId: "l-origem" });

    expect(resultado.ok).toBe(true);
    expect(fake.buscarLiberacao).toHaveBeenCalledWith("l-origem");
    // Autorizador original preservado e parâmetros copiados da original.
    expect(fake.criarLiberacao).toHaveBeenCalledWith(
      {
        pacienteId: "p1",
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 4,
        periodoMeses: 3,
        profissionalAutorizadorId: "u-autor",
        renovacaoDeId: "l-origem",
      },
      "regular"
    );
    expect(fake.criarLiberacao.mock.calls[0][0]).not.toHaveProperty("registrado_por_id");
    expect(fake.criarLiberacao.mock.calls[0][0]).not.toHaveProperty("data_fim");
  });

  it("renovação sem liberação original (não encontrada) é rejeitada sem criar", async () => {
    comPerfil({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true });
    const fake = serviceFake();
    fake.buscarLiberacao.mockResolvedValue(null);
    mocks.createService.mockResolvedValue(fake);

    const resultado = await criarLiberacaoAction({ renovacaoDeId: "inexistente" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("original");
    expect(fake.criarLiberacao).not.toHaveBeenCalled();
  });

  it("renovação por profissional não-recepcionista é bloqueada", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR, statusAtivo: true });
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await criarLiberacaoAction({ renovacaoDeId: "l-origem" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("recepção");
    expect(fake.buscarLiberacao).not.toHaveBeenCalled();
    expect(fake.criarLiberacao).not.toHaveBeenCalled();
  });

  it("recepcionista TAMBÉM cria liberação direta — Sprint44 (todos os perfis criam)", async () => {
    comPerfil({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true });
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await criarLiberacaoAction({
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
    });

    expect(resultado.ok).toBe(true);
    expect(fake.criarLiberacao).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: "p1", tipo: TIPOS_LIBERACAO.AVULSA }),
      "regular"
    );
  });

  it("usuário inativo é bloqueado", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR, statusAtivo: false });

    const resultado = await criarLiberacaoAction({
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
    });

    expect(resultado.ok).toBe(false);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("sessão ausente é bloqueada", async () => {
    state.supabase = authSupabase(null);

    const resultado = await criarLiberacaoAction({
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
    });

    expect(resultado.ok).toBe(false);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("erro de domínio do banco vira mensagem amigável", async () => {
    const fake = serviceFake();
    fake.criarLiberacao.mockRejectedValue(
      new AppError("ACESSO_NEGADO", "Você não tem permissão para executar esta operação.")
    );
    mocks.createService.mockResolvedValue(fake);

    const resultado = await criarLiberacaoAction({
      pacienteId: "p1",
      tipo: TIPOS_LIBERACAO.AVULSA,
      quantidade: 1,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("permissão");
  });
});
// ── Sprint 42 — edição segura de liberações (whitelist por perfil) ──────────
describe("atualizarLiberacaoAction (Sprint 42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessao();
  });

  it("AUTORIZADOR edita previsão/vigência — repassa payload filtrado ao serviço", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await atualizarLiberacaoAction("l1", {
      quantidade: 8,
      data_inicio: "2026-01-01",
    } as Parameters<typeof atualizarLiberacaoAction>[1]);

    expect(resultado.ok).toBe(true);
    expect(fake.atualizarLiberacao).toHaveBeenCalledWith("l1", "profissional_autorizador", {
      quantidade: 8,
      data_inicio: "2026-01-01",
    });
  });

  it("status enviado pelo AUTORIZADOR é descartado pela whitelist (nunca chega ao serviço)", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await atualizarLiberacaoAction("l1", {
      quantidade: 4,
      status: "cancelada",
    } as Parameters<typeof atualizarLiberacaoAction>[1]);

    // status não está na whitelist do autorizador → descartado silenciosamente;
    // apenas o campo permitido segue para o serviço.
    expect(resultado.ok).toBe(true);
    expect(fake.atualizarLiberacao).toHaveBeenCalledWith("l1", "profissional_autorizador", {
      quantidade: 4,
    });
  });

  it("campo HISTÓRICO enviado explicitamente é rejeitado antes do serviço", async () => {
    comPerfil({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await atualizarLiberacaoAction("l1", {
      pacienteId: "p2",
      quantidade: 4,
    } as Parameters<typeof atualizarLiberacaoAction>[1]);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("histórico");
    expect(fake.atualizarLiberacao).not.toHaveBeenCalled();
  });

  it("RECEPCIONISTA não edita liberação", async () => {
    comPerfil({ perfil: PERFIS.RECEPCIONISTA });
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await atualizarLiberacaoAction("l1", {
      quantidade: 4,
    } as Parameters<typeof atualizarLiberacaoAction>[1]);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Recepcionista");
    expect(fake.atualizarLiberacao).not.toHaveBeenCalled();
  });

  it("GESTOR altera apenas status/unidade — campos clínicos são descartados e payload vazio é rejeitado", async () => {
    comPerfil({ perfil: PERFIS.GESTOR });
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    // gestor tentando editar quantidade → filtro deixa vazio → rejeitado
    const resultado = await atualizarLiberacaoAction("l1", {
      quantidade: 8,
    } as Parameters<typeof atualizarLiberacaoAction>[1]);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Nenhum campo permitido");
    expect(fake.atualizarLiberacao).not.toHaveBeenCalled();

    // gestor alterando status passa
    const ok = await atualizarLiberacaoAction("l1", {
      status: "cancelada",
      unidade_id: null,
    } as Parameters<typeof atualizarLiberacaoAction>[1]);
    expect(ok.ok).toBe(true);
    expect(fake.atualizarLiberacao).toHaveBeenCalledWith("l1", "gestor", {
      status: "cancelada",
      unidade_id: null,
    });
  });

  it("sessão ausente é bloqueada", async () => {
    state.supabase = authSupabase(null);
    const fake = serviceFake();
    mocks.createService.mockResolvedValue(fake);

    const resultado = await atualizarLiberacaoAction("l1", { quantidade: 4 });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Sessão");
    expect(fake.atualizarLiberacao).not.toHaveBeenCalled();
  });
});
