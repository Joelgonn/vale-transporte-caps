-- Migration 17 — Recupera a proteção da coluna `cpf` em public.pacientes
--
-- Após a restauração do privilégio de SELECT em public.pacientes para o papel
-- `authenticated`, o privilégio de coluna da coluna `cpf` ficou acessível por
-- conseqüência. Esta migration revoga apenas o SELECT sobre a coluna `cpf` para
-- `authenticated`, restabelecendo o menor privilégio anterior (o único acesso
-- emitido é via RPC `pacientes_com_cpf()`, restrita a gestor ativo).
--
-- Não altera: RLS, policies, funções, `pacientes_com_cpf()`, views, triggers,
-- tabelas ou quaisquer outros privilégios.

revoke select (cpf)
    on table public.pacientes
    from authenticated;