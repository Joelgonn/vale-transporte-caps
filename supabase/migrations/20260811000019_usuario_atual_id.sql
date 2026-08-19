-- Sprint 18 — public.usuario_atual_id()
--
-- Resolve o public.usuarios.id do usuário da sessão autenticada (auth.uid()).
-- Reproduz EXATAMENTE o mecanismo das funções de sessão já sancionadas:
--   * perfil_atual()          (migration 07) — language sql, stable,
--     security definer, set search_path = public, lê public.usuarios por auth.uid();
--   * usuario_ativo_atual()   (migration 07) — mesmo padrão;
--   * grants/revokes          (migrations 10 e 12) — revoke do public/anon,
--     grant executar somente para authenticated.
--
-- Retorna NULL quando o usuário autenticado não possui registro funcional
-- vinculado (mesmo comportamento "sem vínculo" das funções de perfil/status).
--
-- Não altera: RLS, policies, triggers, tabelas, visões ou migrations 01–18.
-- A aplicação usa esta função somente server-side (Server Action) para resolver
-- o profissional_autorizador_id a partir da sessão — o cliente nunca informa.

create or replace function public.usuario_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select u.id
    from public.usuarios u
    where u.auth_user_id = auth.uid()
$$;

revoke execute on function public.usuario_atual_id() from public;
revoke execute on function public.usuario_atual_id() from anon;
grant execute on function public.usuario_atual_id() to authenticated;