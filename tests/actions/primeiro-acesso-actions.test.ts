import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/domain/app-error";

const { mocks, state } = vi.hoisted(() => ({
  mocks: {
    redirect: vi.fn(),
  },
  state: {
    service: null as null | { trocarSenha: ReturnType<typeof vi.fn> },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    mocks.redirect(path);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/lib/services/primeiro-acesso-service", () => ({
  PrimeiroAcessoService: {
    create: async () => state.service ?? { trocarSenha: vi.fn() },
  },
}));

import { trocarSenhaPrimeiroAcesso } from "@/app/actions/primeiro-acesso";

function formData(valores: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("novaSenha", "nova-senha-forte");
  fd.set("confirmacao", "nova-senha-forte");
  for (const [chave, valor] of Object.entries(valores)) {
    fd.set(chave, valor);
  }
  return fd;
}

function fazerService() {
  const instancia = { trocarSenha: vi.fn(async () => undefined) };
  state.service = instancia;
  return instancia;
}

beforeEach(() => {
  mocks.redirect.mockClear();
  state.service = fazerService();
});

describe("trocarSenhaPrimeiroAcesso", () => {
  it("valida campos ausentes antes de chamar o serviço", async () => {
    const resultado = await trocarSenhaPrimeiroAcesso(
      {},
      new FormData() // sem campos
    );
    expect(resultado.error).toBe("Informe e confirme a nova senha.");
    expect(state.service!.trocarSenha).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("troca a senha com sucesso e redireciona para /dashboard", async () => {
    await expect(
      trocarSenhaPrimeiroAcesso({}, formData())
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(state.service!.trocarSenha).toHaveBeenCalledWith({
      novaSenha: "nova-senha-forte",
      confirmacao: "nova-senha-forte",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("retorna mensagem segura para erro de validação do domínio", async () => {
    state.service!.trocarSenha.mockImplementation(async () => {
      throw new AppError("VALIDACAO", "As senhas não coincidem.");
    });
    const resultado = await trocarSenhaPrimeiroAcesso({}, formData());
    expect(resultado.error).toBe("As senhas não coincidem.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("retorna mensagem genérica para erro inesperado (sem vazar detalhes)", async () => {
    state.service!.trocarSenha.mockImplementation(async () => {
      throw new Error("SERVICE_ROLE_KEY=xxx gotrue sql internals");
    });
    const resultado = await trocarSenhaPrimeiroAcesso({}, formData());
    expect(resultado.error).toMatch(/Não foi possível concluir/);
    expect(resultado.error).not.toMatch(/SERVICE_ROLE|gotrue|sql/i);
  });

  it("não envia a senha de volta na resposta (nunca vaza na UI)", async () => {
    state.service!.trocarSenha.mockImplementation(async () => {
      throw new Error("erro interno");
    });
    const resultado = await trocarSenhaPrimeiroAcesso({}, formData());
    expect(JSON.stringify(resultado)).not.toContain("nova-senha-forte");
  });
});