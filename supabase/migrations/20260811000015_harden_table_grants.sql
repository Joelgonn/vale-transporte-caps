-- Sprint 09.8 — Hardening de grants (menor privilégio para authenticated)
-- O Supabase concede ALL PRIVILEGES por default; a migration 10 somou grants
-- específicos mas nunca revogou os extras. Aqui removemos EXPLICITAMENTE de
-- authenticated os privilégios não utilizados, mantendo exatamente o que a
-- aplicação precisa (via PostgREST + RLS).
--
-- Idempotência: REVOKE é idempotente no PostgreSQL — revogar um privilégio
-- que o role não possui é um no-op (sem erro). A migration pode ser reexecutada.
--
-- NÃO concede nenhum privilégio novo. NÃO altera tabelas, colunas, enums,
-- funções, triggers, policies (RLS), views nem migrations 01–14.
--
-- Nota sobre usuarios_delete_gestor: a policy NÃO é alterada aqui — a decisão
-- de removê-la não está documentada como definitiva. Com o REVOKE DELETE de
-- authenticated, ela fica inerte (nenhuma linha é elegível para exclusão via
-- PostgREST), mas permanece no catálogo até decisão documentada em contrário.

-- ── anon: nenhum privilégio em tabelas/views públicas (mantém REVOKE ALL) ──
revoke all on table public.pacientes from anon;
revoke all on table public.usuarios from anon;
revoke all on table public.liberacoes from anon;
revoke all on table public.retiradas from anon;
revoke all on table public.auditoria_logs from anon;
revoke all on table public.v_pacientes from anon;

-- ── CPF: coluna sensível (mantém REVOKE SELECT(cpf) de anon e authenticated) ─
revoke select (cpf) on table public.pacientes from anon, authenticated;

-- ── authenticated: TRUNCATE, REFERENCES, TRIGGER em todas as relações ──────
revoke truncate, references, trigger on table public.pacientes from authenticated;
revoke truncate, references, trigger on table public.usuarios from authenticated;
revoke truncate, references, trigger on table public.liberacoes from authenticated;
revoke truncate, references, trigger on table public.retiradas from authenticated;
revoke truncate, references, trigger on table public.auditoria_logs from authenticated;
revoke truncate, references, trigger on table public.v_pacientes from authenticated;

-- ── authenticated: DELETE — apenas onde há policy/regra de negócio ──────────
-- pacientes/usuarios/liberacoes/retiradas/auditoria_logs: nenhum fluxo requer
-- exclusão física (inativação = UPDATE status; auditoria é append-only).
revoke delete on table public.pacientes from authenticated;
revoke delete on table public.usuarios from authenticated;
revoke delete on table public.liberacoes from authenticated;
revoke delete on table public.retiradas from authenticated;
revoke delete on table public.auditoria_logs from authenticated;

-- ── authenticated: UPDATE — apenas onde há policy de escrita ────────────────
-- liberacoes/retiradas: registros de operação sem alteração prevista (SECURITY.md).
revoke update on table public.liberacoes from authenticated;
revoke update on table public.retiradas from authenticated;
revoke update on table public.auditoria_logs from authenticated;

-- ── authenticated: INSERT — auditoria_logs é append-only (escrita só via
-- trigger SECURITY DEFINER fn_auditoria, que não depende do grant do role) ──
revoke insert on table public.auditoria_logs from authenticated;

-- ── authenticated: v_pacientes permanece somente SELECT ─────────────────────
revoke insert, update, delete on table public.v_pacientes from authenticated;
