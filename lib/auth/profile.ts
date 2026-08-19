import type { SupabaseClient, User } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import { PERFIS, type PerfilUsuario } from "@/lib/domain/enums";

export { PERFIS };
export type Perfil = PerfilUsuario;

export type UsuarioFuncional = {
  id: string;
  authUserId: string;
  email: string;
  perfil: PerfilUsuario | null;
  statusAtivo: boolean | null;
  /** public.usuarios.id do usuário (distinto do auth_user_id). Sessão apenas
   *  server-side via public.usuario_atual_id() — Sprint 18. */
  usuarioId: string | null;
};

function getPerfilValido(tag: unknown): PerfilUsuario | null {
  return Object.values(PERFIS).includes(tag as PerfilUsuario)
    ? (tag as PerfilUsuario)
    : null;
}

/**
 * Resolve o usuário funcional (perfil + status ativo) pela infraestrutura
 * existente no banco: `public.perfil_atual()`, `public.usuario_ativo_atual()` e
 * `public.usuario_atual_id()` (funções `security definer` + `security_invoker`
 * já sancionadas nas migrations 07/10 — a terceira adicionada na migration 19,
 * mesmo mecanismo das duas primeiras). Não há `user_metadata` nem `select`
 * direto em `public.usuarios` — a autoridade de permissões permanece 100% no
 * banco/RLS.
 */
export async function getUsuarioFuncional(
  supabase: SupabaseClient,
  user: User | null
): Promise<UsuarioFuncional | null> {
  if (!user) return null;

  const [perfilRes, ativoRes, idRes] = await Promise.all([
    supabase.rpc("perfil_atual"),
    supabase.rpc("usuario_ativo_atual"),
    supabase.rpc("usuario_atual_id"),
  ]);

  if (perfilRes.error) throw mapSupabaseError(perfilRes.error);
  if (ativoRes.error) throw mapSupabaseError(ativoRes.error);
  if (idRes.error) throw mapSupabaseError(idRes.error);

  // Funções retornam NULL quando o usuário autenticado não tem registro
  // funcional vinculado em public.usuarios.
  return {
    id: user.id,
    authUserId: user.id,
    email: user.email ?? "",
    perfil: getPerfilValido(perfilRes.data),
    statusAtivo: typeof ativoRes.data === "boolean" ? ativoRes.data : null,
    usuarioId: typeof idRes.data === "string" ? idRes.data : null,
  };
}