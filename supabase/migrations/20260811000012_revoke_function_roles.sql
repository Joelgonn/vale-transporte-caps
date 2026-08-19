-- Sprint 09.4 — Correção dos privilégios explícitos de funções
-- pg_proc.proacl confirmou que as 13 funções possuem ACL explícita anon=X/postgres
-- e authenticated=X/postgres (além do default PUBLIC). A migration 11 revogou
-- apenas PUBLIC; aqui removemos EXPLICITAMENTE o EXECUTE de anon/authenticated.
--
-- Regras:
--   * 6 funções de trigger  -> revoga anon e authenticated (internas, só owner).
--   * 4 serializers          -> revoga anon e authenticated (internas, só owner).
--   * pacientes_com_cpf()    -> revoga anon; MANTÉM authenticated (gate interno Gestor+ativo).
--   * perfil_atual()         -> revoga anon; MANTÉM authenticated (usada pelas policies RLS).
--   * usuario_ativo_atual()  -> revoga anon; MANTÉM authenticated (usada pelas policies RLS).
--
-- NÃO usa REVOKE FROM PUBLIC como substituto: os privilégios explícitos de
-- anon/authenticated são removidos um a um com as assinaturas exatas.

-- 1) Funções de trigger — internas (somente owner)
revoke execute on function public.fn_set_updated_at() from anon, authenticated;
revoke execute on function public.fn_liberacoes_before() from anon, authenticated;
revoke execute on function public.fn_retiradas_before() from anon, authenticated;
revoke execute on function public.fn_pacientes_before() from anon, authenticated;
revoke execute on function public.fn_auditoria() from anon, authenticated;
revoke execute on function public.fn_auditoria_imutavel() from anon, authenticated;

-- 2) Serializers de auditoria — internos (somente owner)
revoke execute on function public.pacientes_audit(public.pacientes) from anon, authenticated;
revoke execute on function public.usuarios_audit(public.usuarios) from anon, authenticated;
revoke execute on function public.liberacoes_audit(public.liberacoes) from anon, authenticated;
revoke execute on function public.retiradas_audit(public.retiradas) from anon, authenticated;

-- 3) pacientes_com_cpf() — RPC somente Gestor ativo (mantém authenticated)
revoke execute on function public.pacientes_com_cpf() from anon;

-- 4) perfil_atual() — sessão/RLS (mantém authenticated)
revoke execute on function public.perfil_atual() from anon;

-- 5) usuario_ativo_atual() — sessão/RLS (mantém authenticated)
revoke execute on function public.usuario_ativo_atual() from anon;
