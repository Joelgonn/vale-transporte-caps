-- Sprint 09.3 — Correção definitiva de privilégios de funções
-- Fecha as 6 funções internas de trigger que ainda possuíam EXECUTE para PUBLIC
-- (herdado do default do PostgreSQL: toda função é criada com EXECUTE para PUBLIC).
--
-- Somente leitura de privilégios: revoga EXECUTE de PUBLIC, mas NÃO concede a
-- authenticated/anon. As funções continuam executáveis internamente (triggers
-- executam como owner da função; o disparo NÃO depende de EXECUTE do usuário
-- que executa o DML).

revoke execute on function public.fn_set_updated_at() from public;
revoke execute on function public.fn_liberacoes_before() from public;
revoke execute on function public.fn_retiradas_before() from public;
revoke execute on function public.fn_pacientes_before() from public;
revoke execute on function public.fn_auditoria() from public;
revoke execute on function public.fn_auditoria_imutavel() from public;
