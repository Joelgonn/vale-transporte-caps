-- ============================================================================
-- SPRINT 44 — LIMPEZA DE DADOS DE TESTE (PLANO PARA REVISÃO)
-- ----------------------------------------------------------------------------
-- PROJETO: vwqszdvgmaqjfpeqkmcx (Vale Transporte CAPS)
--
-- AVISO: O arquivo foi escrito com a seção DESTRUTIVA COMENTADA.
-- NÃO EXECUTE a seção 2 sem autorização explícita do proprietário.
--
-- Classificação (levantada em 2026-08-19 via Service Role, somente leitura):
--   Tabela            Total   Dados de teste   Dados reais
--   -------------------------------------------------------------
--   auth.users            8               6*             2
--   public.usuarios       7               5              2
--   public.pacientes      1               1              0
--   public.liberacoes     6               6              0
--   public.retiradas      4               4              0
--   public.auditoria_logs 1000          1000              0
--
--   * 6 usuários auth de teste = 5 do seed (seed-test-users.mjs:
--     gestor/ autorizador/ recepcionista/ inativo/ semvinculo .teste@caps.local)
--     + 1 criado pela verificação Sprint 42/43 (primeiro-acesso-teste@caps.local).
--     Todos os 1000 registros de auditoria referenciam apenas usuários de teste
--     (75e8bcab, 3021141e, ff7d0053) — nenhum log de usuário real existe.
--
--   Dados REAIS a preservar:
--     auth.users: joelgonn@gmail.com (f1a8016f-...), joelgonn@hotmail.com (b482155a-...)
--     public.usuarios: 5ab0ca07-... (Joelson Goncalves, gestor), 04588525-... (Joelgonn, recepcionista)
--
-- MOTIVAÇÃO TÉCNICA DA ORDEM (restrições):
--   1. auditoria_logs.usuario_id  FK → public.usuarios (sem cascade)
--   2. retiradas.*                FK → liberacoes/pacientes/usuarios (sem cascade)
--   3. liberacoes.*               FK → pacientes/usuarios + auto-FK renovacao_de_id
--   4. usuarios.auth_user_id      FK → auth.users ON DELETE RESTRICT
--   → Limpar na ordem: auditoria_logs → retiradas → liberacoes → pacientes
--     → usuarios → auth.users.
--
--   TRUNCATE é usado nas tabelas de dados (não dispara triggers ROW de
--   auditoria nem o trigger de imutabilidade). fn_auditoria() também retorna
--   cedo quando executada sem sessão autenticada (v_usuario_id is null).
--
--   auth.users NÃO é removido aqui por SQL: o padrão do projeto (seed) usa a
--   Admin API para o Auth (evita órfãos em auth.identities/sessions). A
--   exclusão dos 6 usuários de teste fica no script scripts/cleanup-test-users.mjs
--   (--check / --confirm), rodado DEPOIS deste SQL.
-- ============================================================================

\echo '============================================================'
\echo 'SPRINT 44 — LIMPEZA DE DADOS DE TESTE (REVISÃO)'
\echo '============================================================'

-- ----------------------------------------------------------------------------
-- 1. VERIFICAÇÃO PRÉ-LIMPEZA (somente leitura — seguro)
-- ----------------------------------------------------------------------------

\echo ''
\echo '=== 1.1 usuarios de teste (esperado: 5) ==='
select u.id as usuario_id, u.email, u.perfil, u.status_ativo
from public.usuarios u
join auth.users au on au.id = u.auth_user_id
where au.email ilike '%teste@caps.local'
   or au.email = 'primeiro-acesso-teste@caps.local'
order by u.email;

\echo ''
\echo '=== 1.2 auth users de teste (esperado: 6) ==='
select id, email, created_at
from auth.users
where email ilike '%teste@caps.local'
   or email = 'primeiro-acesso-teste@caps.local'
order by email;

\echo ''
\echo '=== 1.3 conteúdo a ser TRUNCADO (secao 2.2 trunca a tabela INTEIRA;' 
\echo '===     confirme que não há registro real nestas tabelas) ==='
select 'pacientes' as tabela, count(*) as qtd from public.pacientes
union all
select 'liberacoes', count(*) from public.liberacoes
union all
select 'retiradas', count(*) from public.retiradas
union all
select 'auditoria_logs', count(*) from public.auditoria_logs
order by tabela;

\echo ''
\echo '=== 1.3b pacientes existentes (1 esperado: "Paciente de Teste") ==='
select id, gestor_sus, nome, status, created_at from public.pacientes order by created_at;

\echo ''
\echo '=== 1.4 usuários reais a PRESERVAR (esperado: 2) ==='
select u.id as usuario_id, u.nome, u.email, u.perfil, u.status_ativo
from public.usuarios u
join auth.users au on au.id = u.auth_user_id
where not (au.email ilike '%teste@caps.local'
       or au.email = 'primeiro-acesso-teste@caps.local')
order by u.email;

\echo ''
\echo '=== 1.5 confirmação: nenhum log de auditoria de usuário real ==='
select count(*) as logs_de_usuarios_reais
from public.auditoria_logs a
where a.usuario_id not in (
    select u.id from public.usuarios u
    join auth.users au on au.id = u.auth_user_id
    where au.email ilike '%teste@caps.local'
       or au.email = 'primeiro-acesso-teste@caps.local'
);

\echo ''
\echo '=== FIM DA VERIFICAÇÃO (nenhuma alteração executada) ==='

-- ----------------------------------------------------------------------------
-- 2. LIMPEZA (DESTRUTIVA — COMENTADA; descomente APÓS autorização explícita)
--    Executar no SQL Editor do projeto dev, depois rodar
--    scripts/cleanup-test-users.mjs --confirm  para remover os 6 auth users.
-- ----------------------------------------------------------------------------

-- begin;

-- -- 2.1 auditoria (append-only via trigger ROW; TRUNCATE não dispara triggers)
-- truncate table public.auditoria_logs restart identity;

-- -- 2.2 retiradas → liberacoes → pacientes (ordem de FK, sem cascade)
-- truncate table public.retiradas;
-- truncate table public.liberacoes;
-- truncate table public.pacientes;

-- -- 2.3 usuarios de teste (5: gestor/autorizador/recepcionista/inativo/primeiro-acesso)
-- delete from public.usuarios u
-- using auth.users au
-- where u.auth_user_id = au.id
--   and (au.email ilike '%teste@caps.local'
--        or au.email = 'primeiro-acesso-teste@caps.local');

-- commit;

-- -- Validação pós-limpeza (esperado): contagens zeradas em
-- -- pacientes/liberacoes/retiradas/auditoria_logs; usuarios = 2;
-- -- auth.users = 2 (joelgonn@gmail.com, joelgonn@hotmail.com).
