import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type UserMock = {
  id: string;
  app_metadata?: Record<string, unknown>;
} | null;

const { state } = vi.hoisted(() => ({
  state: { user: null as UserMock },
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async () => ({
    supabaseResponse: { passou: true },
    user: state.user,
  }),
}));

import { proxy } from "@/proxy";

function request(caminho: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${caminho}`));
}

function usuario(sobre?: Partial<NonNullable<UserMock>>): UserMock {
  return { id: "u-1", app_metadata: {}, ...sobre };
}

function localizacao(resposta: Response): string {
  const loc = resposta.headers.get("location") ?? "";
  // Location pode vir como URL absoluta — extrai pathname + search.
  try {
    return new URL(loc).pathname + new URL(loc).search;
  } catch {
    return loc;
  }
}

beforeEach(() => {
  state.user = null;
});

describe("proxy — rota de primeiro acesso", () => {
  it("redireciona usuário com primeiro acesso pendente de /dashboard para /primeiro-acesso", async () => {
    state.user = usuario({
      app_metadata: { precisa_trocar_senha: true },
    });
    const resposta = await proxy(request("/dashboard"));
    expect(resposta).toBeInstanceOf(Response);
    expect(localizacao(resposta as unknown as Response)).toBe("/primeiro-acesso");
  });

  it("redireciona pendente de /dashboard/pacientes e /dashboard/usuarios", async () => {
    state.user = usuario({
      app_metadata: { precisa_trocar_senha: true },
    });
    for (const caminho of ["/dashboard/pacientes", "/dashboard/usuarios"]) {
      const resposta = (await proxy(request(caminho))) as unknown as Response;
      expect(localizacao(resposta)).toBe("/primeiro-acesso");
    }
  });

  it("permite que o pendente VEJA /primeiro-acesso (sem loop)", async () => {
    state.user = usuario({
      app_metadata: { precisa_trocar_senha: true },
    });
    const resposta = await proxy(request("/primeiro-acesso"));
    expect(resposta).toEqual({ passou: true });
  });

  it("leva o pendente autenticado de /login e / para /primeiro-acesso", async () => {
    state.user = usuario({
      app_metadata: { precisa_trocar_senha: true },
    });
    for (const caminho of ["/login", "/"]) {
      const resposta = (await proxy(request(caminho))) as unknown as Response;
      expect(localizacao(resposta)).toBe("/primeiro-acesso");
    }
  });

  it("não envia usuário normal para primeiro acesso (dashboard passa direto)", async () => {
    state.user = usuario();
    const resposta = await proxy(request("/dashboard"));
    expect(resposta).toEqual({ passou: true });
  });

  it("usuário normal autenticado em /login vai para /dashboard (comportamento preservado)", async () => {
    state.user = usuario();
    const resposta = (await proxy(request("/login"))) as unknown as Response;
    expect(localizacao(resposta)).toBe("/dashboard");
  });

  it("usuário que já trocou a senha em /primeiro-acesso vai para /dashboard", async () => {
    state.user = usuario({ app_metadata: { precisa_trocar_senha: false } });
    const resposta = (await proxy(request("/primeiro-acesso"))) as unknown as Response;
    expect(localizacao(resposta)).toBe("/dashboard");
  });

  it("não autenticado em /dashboard vai para /login?next= (comportamento preservado)", async () => {
    const resposta = (await proxy(request("/dashboard"))) as unknown as Response;
    expect(localizacao(resposta)).toBe("/login?next=%2Fdashboard");
  });

  it("não autenticado em /primeiro-acesso vai para /login?next=%2Fprimeiro-acesso", async () => {
    const resposta = (await proxy(
      request("/primeiro-acesso")
    )) as unknown as Response;
    expect(localizacao(resposta)).toBe("/login?next=%2Fprimeiro-acesso");
  });

  it("sem loop: pendente fora de /primeiro-acesso nunca recebe 200 operacional", async () => {
    state.user = usuario({
      app_metadata: { precisa_trocar_senha: true },
    });
    const resposta = (await proxy(request("/dashboard"))) as unknown as Response;
    expect(resposta.status).toBe(307);
    expect(localizacao(resposta)).not.toContain("/dashboard");
  });

  it("não autenticado em /login segue (página pública), como antes", async () => {
    const resposta = await proxy(request("/login"));
    expect(resposta).toEqual({ passou: true });
  });
});