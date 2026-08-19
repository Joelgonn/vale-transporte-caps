import { describe, it, expect, vi } from "vitest";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS, PROFISSOES } from "@/lib/domain/enums";
import {
  UsuarioAdminService,
  gerarSenhaTemporaria,
  type AdminAuthAdapter,
} from "@/lib/services/usuario-admin-service";
import type {
  NovoUsuario,
  UsuarioFuncional,
} from "@/lib/domain/usuarios/types";
import type { UsuarioRepository } from "@/lib/repositories/usuario-repository";

function usuario(sobre?: Partial<UsuarioFuncional>): UsuarioFuncional {
  return {
    id: "u1",
    auth_user_id: "auth-1",
    nome: "Ana Souza",
    email: "ana@example.com",
    perfil: PERFIS.RECEPCIONISTA,
    profissao: null,
    status_ativo: true,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

function makeService(opts?: {
  buscarPorEmail?: UsuarioFuncional | null;
  criarResultado?: UsuarioFuncional;
  criarErro?: unknown;
  authCriar?: { id: string };
  authCriarErro?: unknown;
  authRemoverErro?: unknown;
}) {
  const criarRepoMock = vi.fn(async (dados: NovoUsuario) => {
    if (opts?.criarErro) throw opts.criarErro;
    return (
      opts?.criarResultado ??
      usuario({ auth_user_id: dados.auth_user_id, email: dados.email })
    );
  });
  const buscarEmailMock = vi.fn(async () => opts?.buscarPorEmail ?? null);
  const repo = {
    buscarPorEmail: buscarEmailMock,
    criar: criarRepoMock,
  } as unknown as UsuarioRepository;

  const criarAuthMock = vi.fn(async () => {
    if (opts?.authCriarErro) throw opts.authCriarErro;
    return { id: opts?.authCriar?.id ?? "auth-criado-1" };
  });
  const removerAuthMock = vi.fn(async () => {
    if (opts?.authRemoverErro) throw opts.authRemoverErro;
  });
  const auth = {
    criarUsuario: criarAuthMock,
    removerUsuario: removerAuthMock,
  } as unknown as AdminAuthAdapter;

  const service = new UsuarioAdminService(repo, auth);
  return {
    service,
    repo: { buscarPorEmail: buscarEmailMock, criar: criarRepoMock },
    auth: { criarUsuario: criarAuthMock, removerUsuario: removerAuthMock },
  };
}

const DADOS = {
  nome: "Ana Souza",
  email: "ana@example.com",
  perfil: PERFIS.RECEPCIONISTA,
  profissao: null,
};

describe("gerarSenhaTemporaria", () => {
  it("gera senha forte de 16 caracteres e não se repete", () => {
    const senha1 = gerarSenhaTemporaria();
    const senha2 = gerarSenhaTemporaria();
    expect(senha1).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(senha1).not.toBe(senha2);
  });
});

describe("criarUsuarioCompleto — fluxo principal", () => {
  it("cria Auth com o e-mail normalizado e vincula com o auth_user_id REAL", async () => {
    const { service, repo, auth } = makeService({ authCriar: { id: "auth-real-9" } });

    const resultado = await service.criarUsuarioCompleto({
      nome: "  Ana Souza  ",
      email: "  Ana@Example.COM ",
      perfil: PERFIS.RECEPCIONISTA,
      profissao: null,
    });

    expect(auth.criarUsuario).toHaveBeenCalledWith(
      "ana@example.com",
      expect.any(String)
    );
    expect(repo.criar).toHaveBeenCalledWith({
      auth_user_id: "auth-real-9",
      nome: "Ana Souza",
      email: "ana@example.com",
      perfil: PERFIS.RECEPCIONISTA,
      profissao: null,
      unidade_id: null,
    });
    expect(resultado.usuario.auth_user_id).toBe("auth-real-9");
    expect(resultado.senhaTemporaria).toHaveLength(16);
  });

  it("NUNCA envia nem salva a senha no vínculo de public.usuarios", async () => {
    const { service, repo, auth } = makeService({ authCriar: { id: "auth-1" } });

    await service.criarUsuarioCompleto(DADOS);

    const payload = repo.criar.mock.calls[0][0] as NovoUsuario;
    expect(payload).not.toHaveProperty("senha");
    expect(payload).not.toHaveProperty("password");
    const chamadasAuth = auth.criarUsuario.mock.calls as unknown as [string, string][];
    expect(chamadasAuth[0][1]).toHaveLength(16);
    expect(chamadasAuth[0][1]).not.toBe(payload.auth_user_id);
  });

  it("autorizador com profissão é aceito", async () => {
    const { service } = makeService({
      authCriar: { id: "auth-2" },
      criarResultado: usuario({
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: PROFISSOES.PSICOLOGO,
      }),
    });

    const resultado = await service.criarUsuarioCompleto({
      nome: "Dr. Souza",
      email: "souza@example.com",
      perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
      profissao: PROFISSOES.PSICOLOGO,
    });

    expect(resultado.usuario.perfil).toBe(PERFIS.PROFISSIONAL_AUTORIZADOR);
    expect(resultado.usuario.profissao).toBe(PROFISSOES.PSICOLOGO);
  });
});

describe("criarUsuarioCompleto — validação (revalidada no servidor)", () => {
  it("nome vazio lança VALIDACAO e NÃO cria Auth", async () => {
    const { service, auth } = makeService();

    await expect(
      service.criarUsuarioCompleto({ ...DADOS, nome: "   " })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(auth.criarUsuario).not.toHaveBeenCalled();
  });

  it("e-mail inválido lança VALIDACAO e NÃO cria Auth", async () => {
    const { service, auth } = makeService();

    await expect(
      service.criarUsuarioCompleto({ ...DADOS, email: "sem-arroba" })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(auth.criarUsuario).not.toHaveBeenCalled();
  });

  it("autorizador sem profissão lança VALIDACAO (RN02) e NÃO cria Auth", async () => {
    const { service, auth } = makeService();

    await expect(
      service.criarUsuarioCompleto({
        nome: "Dr. Souza",
        email: "souza@example.com",
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: null,
      })
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(auth.criarUsuario).not.toHaveBeenCalled();
  });

  it("e-mail já vinculado em public.usuarios é barrado ANTES do Auth", async () => {
    const { service, auth } = makeService({
      buscarPorEmail: usuario({ email: "ana@example.com" }),
    });

    await expect(service.criarUsuarioCompleto(DADOS)).rejects.toMatchObject({
      code: "VALIDACAO",
      message: "Já existe um usuário com este e-mail.",
    });
    expect(auth.criarUsuario).not.toHaveBeenCalled();
  });
});

describe("criarUsuarioCompleto — erros do Auth (duplicidade)", () => {
  it("e-mail já registrado no Auth vira mensagem segura", async () => {
    const { service, auth } = makeService({
      authCriarErro: { message: "User already registered", status: 422, code: "user_exists" },
    });

    const erro = await service
      .criarUsuarioCompleto(DADOS)
      .then(() => null, (e: AppError) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect(erro!.code).toBe("VALIDACAO");
    expect(erro!.message).toBe("Já existe uma conta para este e-mail.");
    expect(auth.removerUsuario).not.toHaveBeenCalled();
  });

  it("gotrue 'email_exists / already been registered' também vira VALIDACAO", async () => {
    const { service, auth } = makeService({
      authCriarErro: {
        message: "A user with this email address has already been registered",
        status: 422,
        code: "email_exists",
      },
    });

    const erro = await service
      .criarUsuarioCompleto(DADOS)
      .then(() => null, (e: AppError) => e);

    expect(erro!.code).toBe("VALIDACAO");
    expect(erro!.message).toBe("Já existe uma conta para este e-mail.");
    expect(auth.removerUsuario).not.toHaveBeenCalled();
  });

  it("erro desconhecido do Auth vira mensagem genérica (sem detalhes internos)", async () => {
    const { service } = makeService({
      authCriarErro: { message: "internal gotrue error with token 0xdeadbeef", status: 500 },
    });

    const erro = await service
      .criarUsuarioCompleto(DADOS)
      .then(() => null, (e: AppError) => e);

    expect(erro!.message).toContain("Não foi possível criar o acesso");
    expect(erro!.message).not.toMatch(/gotrue|token|0xdeadbeef/i);
  });
});

describe("criarUsuarioCompleto — falha parcial e compensação", () => {
  it("vínculo falhou → remove o Auth recém-criado e retorna erro seguro", async () => {
    const { service, repo, auth } = makeService({
      authCriar: { id: "auth-para-remover" },
      criarErro: new AppError("VALIDACAO", "duplicate key value"),
    });

    const erro = await service
      .criarUsuarioCompleto(DADOS)
      .then(() => null, (e: AppError) => e);

    expect(repo.criar).toHaveBeenCalled();
    expect(auth.removerUsuario).toHaveBeenCalledWith("auth-para-remover");
    expect(erro!.code).toBe("VALIDACAO");
    expect(erro!.message).toContain("e-mail");
  });

  it("falha de vínculo genérica → compensa e retorna 'nenhum acesso foi mantido'", async () => {
    const { service, auth } = makeService({
      authCriar: { id: "auth-x" },
      criarErro: new Error("connection reset"),
    });

    const erro = await service
      .criarUsuarioCompleto(DADOS)
      .then(() => null, (e: AppError) => e);

    expect(auth.removerUsuario).toHaveBeenCalledWith("auth-x");
    expect(erro!.message).toContain("Nenhum acesso foi mantido");
    expect(erro!.message).not.toMatch(/connection reset/i);
  });

  it("compensação falhou → erro ainda seguro, nunca silencioso", async () => {
    const { service, auth } = makeService({
      authCriar: { id: "auth-y" },
      criarErro: new Error("db down"),
      authRemoverErro: new Error("network"),
    });

    const erro = await service
      .criarUsuarioCompleto(DADOS)
      .then(() => null, (e: AppError) => e);

    expect(auth.removerUsuario).toHaveBeenCalledWith("auth-y");
    expect(erro!.message).toContain("Procure a gestão");
    expect(erro!.message).not.toMatch(/db down|network/i);
  });
});
