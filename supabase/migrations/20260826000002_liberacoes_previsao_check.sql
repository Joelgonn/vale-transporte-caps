-- Sprint 42.2 — Alinhamento do banco à semântica RN31 (quantidade = previsão)
--
-- DIVERGÊNCIA ELIMINADA:
--   As Sprints 42/42.1 redefiniram liberacoes.quantidade como PREVISÃO
--   administrativa (RN31) e a aplicação aceita inteiros entre 1 e 999
--   (calculador: ex. 4×2×3 meses = 96). Porém o banco ainda impunha a
--   constraint antiga do MVP:
--     liberacoes_quantidade_check CHECK (quantidade = ANY (ARRAY[1,2,4,8]))
--   → UI aceita 96, payload aceito, PostgreSQL rejeitava.
--
-- Escopo (APENAS isto):
--   1. drop da constraint antiga (nome real confirmado em catálogo e na
--      migration original 20260811000004_liberacoes.sql);
--   2. nova constraint com o MESMO nome, aceitando inteiros entre 1 e 999 —
--      coerente com isQuantidadeValida() (regras.ts, Sprint 42.1).
--
-- NÃO altera: RLS, grants, triggers, policies, auditoria, tabelas, enums,
-- views, RPCs nem migrations antigas. `quantidade` permanece NOT NULL.
-- Retrocompatível: toda liberação existente (1..8) satisfaz a nova constraint.
--
-- Aplicação: SQL Editor do Supabase / Management API — NÃO aplicar sem
-- autorização explícita (mesmo fluxo das Sprints 41.1/42).

alter table public.liberacoes
    drop constraint liberacoes_quantidade_check;

alter table public.liberacoes
    add constraint liberacoes_quantidade_check
    check (quantidade between 1 and 999);
