import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/domain/app-error";
import type { AdminAuthAdapter } from "@/lib/services/usuario-admin-service";
import { PrimeiroAcessoService } from "@/lib/services/primeiro-acesso-service";

function makeService(opts?: {
  semSessao?: boolean;
  updateUserErro?: unknown;
  adminErro?: unknown;
  refreshErro?: unknown;
}) {
  const getUserMock = vi.fn(async () => ({
    data: {
      user: opts?.semSessao
        ? null
        : { id: "u-1", email: "joao@caps.local" },
    },
    error: opts?.semSessao ? { message: "no user" } : null,
  }));
  const updateUserMock = vi.fn(async () => {
    if (opts?.updateUserErro) throw opts.updateUserErro;
    return { data: { user: { id: "u-1" } }, error: null };
  });
  const refreshSessionMock = vi.fn(async () => {
    if (opts?.refreshErro) throw opts.refreshErro;
    return { data: {}, error: null };
  });
  const concluirMock = vi.fn(async () => {
    if (opts?.adminErro) throw opts.adminErro;
  });

  // Tipos simulados com cast: a camada só usa getUser/updateUser/refreshSession
  // do client do usuário e concluirPrimeiroAcesso do adaptador Admin.
  const supabase = {
    auth: {
      getUser: getUserMock,
      updateUser: updateUserMock,
      refreshSession: refreshSessionMock,
    },
  } as unknown as Pick<SupabaseClient, "auth">;

  const adminAuth = {
    criarUsuario: vi.fn(async () => ({ id: "u-admin" })),
    removerUsuario: vi.fn(async () => {}),
    concluirPrimeiroAcesso: concluirMock,
  } as unknown as AdminAuthAdapter;

  const service = new PrimeiroAcessoService(supabase, adminAuth);

  return {
    service,
    getUser: getUserMock,
    updateUser: updateUserMock,
    refreshSession: refreshSessionMock,
    concluir: concluirMock,
  };
}

const DADOS = { novaSenha: "nova-senha-forte", confirmacao: "nova-senha-forte" };

describe("PrimeiroAcessoService.trocarSenha", () => {
  it("troca a senha no Auth, limpa o flag de primeiro acesso e renova a sessão", async () => {
    const { service, updateUser, concluir, refreshSession } = makeService();

    await service.trocarSenha(DADOS);

    expect(updateUser).toHaveBeenCalledWith({ password: DADOS.novaSenha });
    expect(concluir).toHaveBeenCalledWith("u-1");
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("valida a troca ANTES de chamar o Auth (senha curta / diferenças)", async () => {
    const { service, updateUser, concluir } = makeService();

    await expect(
      service.trocarSenha({ novaSenha: "123", confirmacao: "456" })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(updateUser).not.toHaveBeenCalled();
    expect(concluir).not.toHaveBeenCalled();
  });

  it("bloqueia sessão ausente com ACESSO_NEGADO", async () => {
    const { service, updateUser } = makeService({ semSessao: true });

    await expect(service.trocarSenha(DADOS)).rejects.toMatchObject({
      code: "ACESSO_NEGADO",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("nunca limpa o flag se a troca de senha falhar", async () => {
    const { service, concluir } = makeService({
      updateUserErro: new AppError(
        "ERRO_INTERNO",
        "Não foi possível alterar a senha agora. Tente novamente em instantes."
      ),
    });

    await expect(service.trocarSenha(DADOS)).rejects.toMatchObject({
      code: "ERRO_INTERNO",
    });
    expect(concluir).not.toHaveBeenCalled();
  });

  it("mapeia senha fraca (gotrue weak_password) para mensagem segura", async () => {
    const { service, updateUser } = makeService({
      updateUserErro: {
        code: "weak_password",
        message: "Password should be at least 6 characters",
      },
    });

    await expect(service.trocarSenha(DADOS)).rejects.toMatchObject({
      code: "VALIDACAO",
      message: expect.stringMatching(/muito fraca/),
    });
    expect(updateUser).toHaveBeenCalled();
  });

  it("mapeia rate limit (429) para mensagem segura e amigável", async () => {
    const { service } = makeService({
      updateUserErro: { code: "over_request_rate_limit", status: 429 },
    });

    await expect(service.trocarSenha(DADOS)).rejects.toMatchObject({
      message: expect.stringMatching(/Muitas tentativas/),
    });
  });

  it("não vaza detalhes internos do Supabase em erros da troca", async () => {
    const { service } = makeService({
      updateUserErro: new Error("sql interno do Supabase: duplicate key"),
    });

    await expect(service.trocarSenha(DADOS)).rejects.toMatchObject({
      message: expect.not.stringMatching(/sql|Supabase|petabyte/i),
    });
  });

  it("erro da Admin API ao limpar o flag também gera erro seguro", async () => {
    const { service, refreshSession } = makeService({
      adminErro: { message: "forbidden: service_role" },
    });

    await expect(service.trocarSenha(DADOS)).rejects.toMatchObject({
      message: expect.not.stringMatching(/forbidden|service_role/i),
    });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("a senha só é enviada ao Auth (nunca ao adaptador admin nem persistida)", async () => {
    const { service, updateUser, concluir } = makeService();

    await service.trocarSenha(DADOS);

    // Destino único: updateUser do client do usuário (Supabase Auth).
    expect(updateUser).toHaveBeenCalledWith({ password: DADOS.novaSenha });
    // O adaptador Admin só recebe o id (flag de primeiro acesso) — nunca senha.
    expect(concluir).toHaveBeenCalledWith("u-1");
    const argsAdmin = JSON.stringify(concluir.mock.calls);
    expect(argsAdmin).not.toContain(DADOS.novaSenha);
  });
});