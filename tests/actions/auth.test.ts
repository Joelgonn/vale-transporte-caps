import { describe, it, expect, vi, beforeEach } from "vitest";

type AuthResult = {
  data: { user: { id: string; email: string } | null } | null;
  error: { code?: string; message?: string } | null;
};

type AuthSupabaseMock = ReturnType<typeof authSupabase>;

function authSupabase() {
  return {
    auth: {
      signInWithPassword: vi.fn(async (): Promise<AuthResult> => ({
        data: { user: { id: "a1", email: "a@b.com" } },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
}

const { mocks, state } = vi.hoisted(() => ({
  mocks: {
    redirect: vi.fn(),
  },
  state: {
    supabase: null as AuthSupabaseMock | null,
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    mocks.redirect(path);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => state.supabase ?? authSupabase()),
}));

import { login, logout } from "@/app/actions/auth";

function formData(sobre: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("email", "a@b.com");
  fd.set("password", "segredo123");
  fd.set("next", "");
  for (const [chave, valor] of Object.entries(sobre)) {
    fd.set(chave, valor);
  }
  return fd;
}

beforeEach(() => {
  mocks.redirect.mockClear();
  state.supabase = authSupabase();
});

describe("login action", () => {
  it("valida campos obrigatórios antes de chamar o Supabase", async () => {
    const resultado = await login({}, formData({ email: "", password: "" }));
    expect(resultado.error).toBe("Informe e-mail e senha.");
    expect(state.supabase!.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("retorna mensagem segura para credenciais inválidas", async () => {
    state.supabase!.auth.signInWithPassword.mockImplementation(async () => ({
      data: { user: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    }));
    const resultado = await login({}, formData());
    expect(resultado.error).toBe("E-mail ou senha incorretos.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("retorna mensagem segura para e-mail não confirmado", async () => {
    state.supabase!.auth.signInWithPassword.mockImplementation(async () => ({
      data: { user: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    }));
    const resultado = await login({}, formData());
    expect(resultado.error).toBe(
      "Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada."
    );
  });

  it("retorna mensagem segura para erro inesperado (sem expor detalhes internos)", async () => {
    state.supabase!.auth.signInWithPassword.mockImplementation(async () => {
      throw new Error("sql petabyte interno do Supabase");
    });
    const resultado = await login({}, formData());
    expect(resultado.error).toBe(
      "Não foi possível entrar agora. Tente novamente em instantes."
    );
    expect(resultado.error).not.toMatch(/sql|Supabase|ERRO/i);
  });

  it("redireciona para /dashboard quando não há ?next=", async () => {
    await expect(login({}, formData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redireciona para a rota interna de ?next= sem quebrar segurança", async () => {
    await expect(
      login({}, formData({ next: "/dashboard/pacientes" }))
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/pacientes");
  });

  it("CASO 1 — usuário normal (sem pendência) vai para /dashboard", async () => {
    await expect(login({}, formData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("CASO 2 — usuário com precisa_trocar_senha=true vai para /primeiro-acesso", async () => {
    state.supabase!.auth.signInWithPassword.mockImplementation(async () => ({
      data: {
        user: {
          id: "a1",
          email: "a@b.com",
          app_metadata: { precisa_trocar_senha: true },
        },
      },
      error: null,
    }));
    await expect(login({}, formData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/primeiro-acesso");
  });

  it("CASO 3 — pendente com ?next=/dashboard vai para /primeiro-acesso (pendência tem prioridade)", async () => {
    state.supabase!.auth.signInWithPassword.mockImplementation(async () => ({
      data: {
        user: {
          id: "a1",
          email: "a@b.com",
          app_metadata: { precisa_trocar_senha: true },
        },
      },
      error: null,
    }));
    await expect(
      login({}, formData({ next: "/dashboard" }))
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/primeiro-acesso");
  });

  it("CASO 4 — pendente com ?next=/alguma-rota vai para /primeiro-acesso (nunca para rota interna arbitrária)", async () => {
    state.supabase!.auth.signInWithPassword.mockImplementation(async () => ({
      data: {
        user: {
          id: "a1",
          email: "a@b.com",
          app_metadata: { precisa_trocar_senha: true },
        },
      },
      error: null,
    }));
    await expect(
      login({}, formData({ next: "/alguma-rota" }))
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/primeiro-acesso");
  });

  it("bloqueia redirecionamento aberto (?next= externo/host)", async () => {
    await expect(
      login({}, formData({ next: "https://exemplo-malicioso.com" }))
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("bloqueia ?next= com protocolo relativo '//host'", async () => {
    await expect(
      login({}, formData({ next: "//exemplo-malicioso.com" }))
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("não vaza detalhes do Supabase nas mensagens", async () => {
    const resultado = await login({}, formData({ email: "", password: "" }));
    expect(resultado.error).not.toMatch(/supabase|sql|token|status|stack/i);
  });
});

describe("logout action", () => {
  it("encerra a sessão e redireciona para /login", async () => {
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
    expect(state.supabase!.auth.signOut).toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});