import { describe, it, expect, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { getUsuarioFuncional, PERFIS } from "@/lib/auth/profile";
import { AppError } from "@/lib/domain/app-error";

function makeUser(sobre?: Partial<User>): User {
  return {
    id: "auth-user-1",
    email: "gestor@example.com",
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    role: "",
    ...sobre,
  } as User;
}

type Resultado = { data: unknown; error: unknown };

// Ordem: (usuario_ativo_atual, perfil_atual, usuario_atual_id)
function makeClient(ao: Resultado, perfil: Resultado, id: Resultado) {
  const supabase = { rpc: vi.fn() };
  supabase.rpc.mockImplementation((name: string) => {
    if (name === "usuario_ativo_atual") return Promise.resolve(ao);
    if (name === "perfil_atual") return Promise.resolve(perfil);
    return Promise.resolve(id);
  });
  return { supabase: supabase as never, calls: supabase };
}

describe("getUsuarioFuncional — infra perfil_atual()/usuario_ativo_atual()/usuario_atual_id()", () => {
  it("retorna null para usuário nulo", async () => {
    const { supabase } = makeClient({ data: null, error: null }, { data: null, error: null }, { data: null, error: null });
    expect(await getUsuarioFuncional(supabase, null)).toBeNull();
  });

  it("resolve perfil/status ativo e usuarios.id a partir das funções do banco", async () => {
    const { supabase, calls } = makeClient(
      { data: true, error: null },
      { data: PERFIS.GESTOR, error: null },
      { data: "usu-1", error: null }
    );

    const usuario = await getUsuarioFuncional(supabase, makeUser());

    expect(calls.rpc).toHaveBeenCalledWith("perfil_atual");
    expect(calls.rpc).toHaveBeenCalledWith("usuario_ativo_atual");
    expect(calls.rpc).toHaveBeenCalledWith("usuario_atual_id");
    expect(usuario).toEqual({
      id: "auth-user-1",
      authUserId: "auth-user-1",
      email: "gestor@example.com",
      perfil: "gestor",
      statusAtivo: true,
      usuarioId: "usu-1",
    });
  });

  it("usuário sem registro funcional → perfil, status e id null (sem fallback)", async () => {
    const { supabase } = makeClient(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null }
    );

    const usuario = await getUsuarioFuncional(supabase, makeUser());
    expect(usuario?.perfil).toBeNull();
    expect(usuario?.statusAtivo).toBeNull();
    expect(usuario?.usuarioId).toBeNull();
  });

  it("rejeita perfil fora do enum do MVP", async () => {
    const { supabase } = makeClient(
      { data: true, error: null },
      { data: "auditor", error: null },
      { data: "usu-1", error: null }
    );

    const usuario = await getUsuarioFuncional(supabase, makeUser());
    expect(usuario?.perfil).toBeNull();
    expect(usuario?.statusAtivo).toBe(true);
    expect(usuario?.usuarioId).toBe("usu-1");
  });

  it("propaga erro de banco como AppError (não deixa passar SQL cru)", async () => {
    const { supabase } = makeClient(
      { data: null, error: { code: "42501", message: "permission denied", details: "", hint: "" } },
      { data: null, error: null },
      { data: null, error: null }
    );

    await expect(getUsuarioFuncional(supabase, makeUser())).rejects.toBeInstanceOf(AppError);
  });
});