-- ============================================================================
-- VALIDAÇÃO SUPABASE — SPRINT 09
-- Schema real × Documentação (DATABASE.md / SECURITY.md / AUDIT.md / DOMAIN.md)
-- ----------------------------------------------------------------------------
-- PROJETO: vwqszdvgmaqjfpeqkmcx (Vale Transporte CAPS)
--
-- AVISO: Este script é SOMENTE LEITURA (SELECT sobre catálogos do PostgreSQL).
-- Ele NÃO cria, altera, remove tabelas/colunas/funções/policies nem insere dados.
-- Nenhuma credencial é necessária ou embutida.
--
-- COMO EXECUTAR (no diretório raiz do projeto):
--
--   Opção A — CLI Supabase (requer `supabase login` e banco NÃO pausado):
--     npx.cmd --yes supabase@latest db query --db-url "postgresql://postgres.vwqszdvgmaqjfpeqkmcx:<senha_urlencoded>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" --file scripts/validate-supabase.sql
--
--   Opção B — psql:
--     psql "postgresql://postgres.vwqszdvgmaqjfpeqkmcx:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -f scripts/validate-supabase.sql
--
--   Opção C — Dashboard → SQL Editor: colar o conteúdo e executar.
--
-- Cada seção exibe o objeto real (catálogo). O resultado esperado é comparado
-- manualmente com a tabela do final do script (docs × banco).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. TABELAS EXISTENTES NO SCHEMA PUBLIC
-- ----------------------------------------------------------------------------
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;

select tablename
from pg_catalog.pg_tables
where schemaname = 'public'
order by tablename;

-- ----------------------------------------------------------------------------
-- 2. COLUNAS POR TABELA (tipo, nullable, default)
-- ----------------------------------------------------------------------------
select column_name, data_type, character_maximum_length, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'pacientes'
order by ordinal_position;

select column_name, data_type, character_maximum_length, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'usuarios'
order by ordinal_position;

select column_name, data_type, character_maximum_length, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'liberacoes'
order by ordinal_position;

select column_name, data_type, character_maximum_length, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'retiradas'
order by ordinal_position;

select column_name, data_type, character_maximum_length, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'auditoria_logs'
order by ordinal_position;

-- ----------------------------------------------------------------------------
-- 3. PRIMARY KEYS
-- ----------------------------------------------------------------------------
select tc.table_name, kcu.column_name, tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.constraint_type = 'PRIMARY KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-- ----------------------------------------------------------------------------
-- 4. FOREIGN KEYS (com tabela/coluna de referência)
-- ----------------------------------------------------------------------------
select
  tc.table_name              as tabela,
  kcu.column_name            as coluna,
  ccu.table_name             as referencia_tabela,
  ccu.column_name            as referencia_coluna,
  rc.delete_rule             as on_delete,
  rc.update_rule             as on_update
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-- ----------------------------------------------------------------------------
-- 5. UNIQUE CONSTRAINTS E ÍNDICES ÚNICOS
-- ----------------------------------------------------------------------------
select tc.table_name, kcu.column_name, tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.constraint_type = 'UNIQUE'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and indexdef ilike '%unique%'
order by tablename, indexname;

-- ----------------------------------------------------------------------------
-- 6. CHECK CONSTRAINTS
-- ----------------------------------------------------------------------------
select conrelid::regclass::text as tabela,
       conname                   as constraint_name,
       pg_get_constraintdef(oid) as definicao
from pg_catalog.pg_constraint
where connamespace = 'public'::regnamespace
  and contype = 'c'
order by conrelid::regclass::text, conname;

-- ----------------------------------------------------------------------------
-- 7. ÍNDICES NÃO ÚNICOS
-- ----------------------------------------------------------------------------
select tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and indexdef not ilike '%unique%'
order by tablename, indexname;

-- ----------------------------------------------------------------------------
-- 8. ENUMS (tipos customizados e seus valores)
-- ----------------------------------------------------------------------------
select t.typname as enum_nome,
       string_agg(e.enumlabel, ', ' order by e.enumsortorder) as valores
from pg_catalog.pg_type t
join pg_catalog.pg_enum e on e.enumtypid = t.oid
where t.typnamespace = 'public'::regnamespace
group by t.typname
order by t.typname;

-- ----------------------------------------------------------------------------
-- 9. FUNÇÕES EM public (nome, retorno, idioma, volatility, definer/invoker)
-- ----------------------------------------------------------------------------
select p.proname as funcao,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       pg_get_function_result(p.oid)             as retorno,
       l.lanname                                as linguagem,
       p.provolatile::text                      as volatility,  -- s=stable, i=immutable, v=volatile
       p.prosecdef::text                        as security_definer
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
join pg_catalog.pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname not in ('_pg_expandarray')
order by p.proname;

-- ----------------------------------------------------------------------------
-- 10. TRIGGERS (nome, tabela, quando, evento, função)
-- ----------------------------------------------------------------------------
select tgname              as trigger_nome,
       c.relname           as tabela,
       pg_get_triggerdef(t.oid) as definicao
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;

-- ----------------------------------------------------------------------------
-- 11. VIEWS EM public (definição)
-- ----------------------------------------------------------------------------
select table_name as view_nome
from information_schema.views
where table_schema = 'public'
order by table_name;

select v.viewname,
       coalesce((
         select string_agg('security_invoker=' || reloptions.opt, ', ')
         from pg_catalog.pg_class c
         left join lateral unnest(c.reloptions) with ordinality as reloptions(opt, ord) on true
         where c.relname = v.viewname and c.relnamespace = 'public'::regnamespace
           and reloptions.opt like 'security%'
       ), '') as options_seguranca,
       pg_get_viewdef(('public.' || v.viewname)::regclass, true) as definicao
from pg_catalog.pg_views v
where v.schemaname = 'public'
order by v.viewname;

-- ----------------------------------------------------------------------------
-- 12. RLS HABILITADO POR TABELA
-- ----------------------------------------------------------------------------
select c.relname   as tabela,
       c.relrowsecurity as rls_habilitado,
       c.relforcerowsecurity as rls_forcado
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- ----------------------------------------------------------------------------
-- 13. POLICIES (nome, tabela, comando, papéis, expressões USING/WITH CHECK)
-- ----------------------------------------------------------------------------
select pol.polname              as policy_nome,
       c.relname                as tabela,
       case pol.polcmd
         when 'r' then 'SELECT'
         when 'a' then 'INSERT'
         when 'w' then 'UPDATE'
         when 'd' then 'DELETE'
         when '*' then 'ALL'
       end as comando,
       coalesce((
         select string_agg(pg_catalog.pg_get_userbyid(member), ', ')
         from unnest(pol.polroles) as member
       ), 'PUBLIC (todos)')     as papeis,
       pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) as using_expressao,
       pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expressao
from pg_catalog.pg_policy pol
join pg_catalog.pg_class c on c.oid = pol.polrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, pol.polname;

-- ----------------------------------------------------------------------------
-- 14. GRANTS/REVOKES — TABELAS E VIEWS (privileges por role)
-- ----------------------------------------------------------------------------
select grantee,
       table_name,
       string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public'
group by grantee, table_name
order by table_name, grantee;

select grantee,
       table_name,
       column_name,
       privilege_type
from information_schema.role_column_grants
where table_schema = 'public'
  and column_name = 'cpf'
order by table_name, grantee;

-- ----------------------------------------------------------------------------
-- 15. PRIVILÉGIOS DE FUNÇÕES (execute por role)
-- ----------------------------------------------------------------------------
select grantee,
       routine_name,
       string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_routine_grants
where routine_schema = 'public'
group by grantee, routine_name
order by routine_name, grantee;

-- ----------------------------------------------------------------------------
-- 16. RELAÇÃO auth.users → public.usuarios
--    (usuários do Auth sem vínculo funcional: pendências de integração)
-- ----------------------------------------------------------------------------
select au.id, au.email, au.created_at
from auth.users au
left join public.usuarios u on u.auth_user_id = au.id
where u.id is null
order by au.created_at;

select u.id as usuario_id,
       u.nome,
       u.email,
       u.perfil,
       u.status_ativo,
       (au.email is not null) as tem_auth_user
from public.usuarios u
left join auth.users au on au.id = u.auth_user_id
order by u.created_at;

-- ----------------------------------------------------------------------------
-- 17. SEGURANÇA DO CPF — inspeção da cadeia de proteção
--    (grants reais da coluna + definição das views/funções)
-- ----------------------------------------------------------------------------
select grantee, privilege_type
from information_schema.role_column_grants
where table_schema = 'public'
  and table_name = 'pacientes'
  and column_name = 'cpf'
order by grantee;

select pg_get_viewdef(('public.v_pacientes')::regclass, true) as definicao_v_pacientes;

select pg_get_functiondef(p.oid) as definicao_pacientes_com_cpf
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'pacientes_com_cpf';

-- ----------------------------------------------------------------------------
-- 18. AUDITORIA — funções de trigger e serializers
-- ----------------------------------------------------------------------------
select pg_get_functiondef(p.oid) as definicao_fn_auditoria
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'fn_auditoria';

select pg_get_functiondef(p.oid) as definicao_fn_auditoria_imutavel
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'fn_auditoria_imutavel';

select tgname, c.relname
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and t.tgname like '%audit%'
  and not t.tgisinternal
order by c.relname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'auditoria_logs'
order by grantee, privilege_type;

-- ----------------------------------------------------------------------------
-- 19. INTEGRIDADE — validação estrutural das regras de domínio
--     (as regras abaixo são aplicadas via CHECK + triggers; aqui validamos
--      a PRESENÇA e DEFINIÇÃO, sem executar DML)
-- ----------------------------------------------------------------------------
select conname, pg_get_constraintdef(oid) as definicao
from pg_catalog.pg_constraint
where conrelid = 'public.liberacoes'::regclass
  and contype = 'c'
  and (pg_get_constraintdef(oid) ilike '%quantidade%');

select conname, pg_get_constraintdef(oid) as definicao
from pg_catalog.pg_constraint
where conrelid = 'public.liberacoes'::regclass
  and contype = 'c'
  and (pg_get_constraintdef(oid) ilike '%periodo_meses%'
       or pg_get_constraintdef(oid) ilike '%continua%'
       or pg_get_constraintdef(oid) ilike '%avulsa%');

select conname, pg_get_constraintdef(oid) as definicao
from pg_catalog.pg_constraint
where conrelid = 'public.liberacoes'::regclass
  and contype = 'c'
  and (pg_get_constraintdef(oid) ilike '%data_fim%');

select conname, pg_get_constraintdef(oid) as definicao
from pg_catalog.pg_constraint
where conrelid = 'public.retiradas'::regclass
  and contype = 'c'
  and (pg_get_constraintdef(oid) ilike '%quantidade%');

select p.proname as funcao
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('fn_liberacoes_before', 'fn_retiradas_before')
order by p.proname;

-- ----------------------------------------------------------------------------
-- 20. RESUMO DE CONTAGENS (sanity check rápido)
-- ----------------------------------------------------------------------------
select
  (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r')                                   as tabelas_base,
  (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='v')                                   as views,
  (select count(*) from pg_catalog.pg_policy p join pg_catalog.pg_class c on c.oid=p.polrelid
     join pg_catalog.pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public')                                                     as policies,
  (select count(*) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
     join pg_catalog.pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and not t.tgisinternal)                              as triggers,
  (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public')                                                     as funcoes,
  (select count(distinct t.oid) from pg_catalog.pg_type t
     join pg_catalog.pg_enum e on e.enumtypid=t.oid
     join pg_catalog.pg_namespace n on n.oid=t.typnamespace
     where n.nspname='public')                                                     as enums;

