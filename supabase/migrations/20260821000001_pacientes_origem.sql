-- Sprint 38 — Origem do paciente (regular/esporádico) e cadastro por perfil
--
-- Decisão institucional APROVADA (fecha a pendência de DOMAIN.md/SECURITY.md
-- "quem pode cadastrar pacientes"):
--   * gestor                  → cadastra paciente com origem = 'regular';
--   * profissional_autorizador → cadastra paciente com origem = 'regular';
--   * recepcionista           → cadastra paciente com origem = 'esporadico',
--     exclusivamente para atendimento/liberação esporádica (avulsa).
--
-- Regra de domínio NOVA (RN29): paciente com origem = 'esporadico' NÃO pode
-- receber liberação do tipo 'continua' — somente 'avulsa'. Garantida no BANCO
-- (trigger fn_liberacoes_before), não apenas na UI.
--
-- Compatibilidade: TODOS os pacientes existentes tornam-se 'regular'
-- (DEFAULT 'regular' na nova coluna NOT NULL) — nenhum dado é alterado.
--
-- Escopo:
--   1. Novo enum public.origem_paciente ('regular', 'esporadico');
--   2. Coluna public.pacientes.origem (NOT NULL DEFAULT 'regular') +
--      grant select (origem) para authenticated (a migration
--      20260811000018 concede SELECT por coluna; sem este grant, v_pacientes
--      com security_invoker e o RETURNING do INSERT quebram para authenticated);
--   3. v_pacientes recriada incluindo origem (privilégios preservados);
--   4. pacientes_com_cpf() recriada incluindo origem;
--   5. RLS de INSERT em pacientes substituída:
--        - pacientes_insert_regular            (gestor/autorizador ativos);
--        - pacientes_insert_recepcao_esporadico (recepcionista ativa);
--   6. fn_liberacoes_before() recriada com a checagem RN29 (demais validações
--      RN01/RN02/RN27/RN23 e cálculo RN13/RN21 preservados integralmente).
--
-- NÃO altera: migrations antigas, tabelas, triggers (registro), grants,
-- policies de SELECT/UPDATE, auditoria (fn_auditoria/pacientes_audit capturam
-- a coluna nova automaticamente via row-to-json).
--
-- Aplicação: SQL Editor do Supabase (ou supabase db push). NÃO rodar em remoto
-- sem autorização explícita.

-- ── 1) Enum de origem ────────────────────────────────────────────────────────
create type public.origem_paciente as enum ('regular', 'esporadico');

-- ── 2) Coluna em pacientes (pacientes existentes viram 'regular') ───────────
alter table public.pacientes
    add column origem public.origem_paciente not null default 'regular';

-- Grant de SELECT coluna-a-coluna: a migration 20260811000018 revogou o SELECT
-- de tabela e concedeu por coluna (todas menos cpf). A coluna nova nasce SEM
-- privilégio; v_pacientes (security_invoker = true) checa os privilégios das
-- relações de base contra o usuário invocador, e o repository usa RETURNING
-- com COLUNAS_SEM_CPF (que inclui origem). Sem este grant, qualquer leitura de
-- v_pacientes/retorno de INSERT falha com "permission denied" para authenticated.
grant select (origem)
    on table public.pacientes
    to authenticated;

-- ── 3) v_pacientes inclui origem (CREATE OR REPLACE preserva privilégios) ───
-- ATENÇÃO: CREATE OR REPLACE VIEW só permite ACRESCENTAR colunas no FIM
-- (renomear/mover colunas existentes falha com 42P16). `origem` vai por
-- último — o acesso na aplicação é sempre por nome da coluna.
create or replace view public.v_pacientes
with (security_barrier = true, security_invoker = true)
as
select
    id,
    gestor_sus,
    nome,
    status,
    data_inicio_acompanhamento,
    data_fim_acompanhamento,
    unidade_id,
    created_at,
    updated_at,
    origem
from public.pacientes;

-- ── 4) pacientes_com_cpf() inclui origem (gate de CPF do gestor inalterado) ─
-- ATENÇÃO: CREATE OR REPLACE FUNCTION não pode alterar o tipo de retorno
-- (42P13), por isso é necessário DROP + CREATE. O descarte remove os
-- privilégios EXECUTE — e os DEFAULT PRIVILEGES do projeto re-concedem
-- EXECUTE a anon/authenticated em funções novas. Reaplicamos aqui EXATAMENTE
-- o estado da migration 12: revoke de public E anon; grant só a authenticated.
drop function if exists public.pacientes_com_cpf();

create function public.pacientes_com_cpf()
returns table (
    id uuid,
    gestor_sus text,
    nome text,
    cpf text,
    status public.status_paciente,
    origem public.origem_paciente,
    data_inicio_acompanhamento date,
    data_fim_acompanhamento date,
    unidade_id uuid,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select p.id, p.gestor_sus, p.nome, p.cpf, p.status, p.origem,
           p.data_inicio_acompanhamento, p.data_fim_acompanhamento,
           p.unidade_id, p.created_at, p.updated_at
    from public.pacientes p
    where public.perfil_atual() = 'gestor'::public.perfil_usuario
      and public.usuario_ativo_atual()
$$;

revoke execute on function public.pacientes_com_cpf() from public;
revoke execute on function public.pacientes_com_cpf() from anon;
grant execute on function public.pacientes_com_cpf() to authenticated;

-- ── 5) RLS de INSERT por perfil × origem (todos exigem usuário ativo) ───────
drop policy if exists "pacientes_insert_autorizador" on public.pacientes;

-- Gestor e profissional autorizador ativos: SOMENTE origem regular.
drop policy if exists "pacientes_insert_regular" on public.pacientes;
create policy "pacientes_insert_regular"
    on public.pacientes for insert to authenticated
    with check (
        public.perfil_atual() in (
            'gestor'::public.perfil_usuario,
            'profissional_autorizador'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
        and origem = 'regular'::public.origem_paciente
    );

-- Recepcionista ativa: SOMENTE origem esporadico.
drop policy if exists "pacientes_insert_recepcao_esporadico" on public.pacientes;
create policy "pacientes_insert_recepcao_esporadico"
    on public.pacientes for insert to authenticated
    with check (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and origem = 'esporadico'::public.origem_paciente
    );

-- ── 6) RN29 no banco: esporádico só recebe liberação avulsa ─────────────────
-- Corpo idêntico ao da migration 20260817000002, com acréscimo da leitura de
-- p.origem e da exceção RN29. Demais validações preservadas.
create or replace function public.fn_liberacoes_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_paciente_status public.status_paciente;
    v_paciente_origem public.origem_paciente;
    v_autorizador_perfil public.perfil_usuario;
    v_autorizador_ativo boolean;
begin
    select u.id into v_uid
    from public.usuarios u
    where u.auth_user_id = auth.uid();

    if v_uid is null then
        raise exception 'Usuário autenticado não vinculado a um registro funcional';
    end if;

    if tg_op = 'INSERT' then
        new.registrado_por_id := v_uid;
    end if;

    select p.status, p.origem into v_paciente_status, v_paciente_origem
    from public.pacientes p
    where p.id = new.paciente_id;

    if v_paciente_status is distinct from 'ativo' then
        raise exception 'Paciente sem direito ativo (RN01)';
    end if;

    -- RN29 — paciente esporádico somente liberação avulsa.
    if v_paciente_origem = 'esporadico'::public.origem_paciente
       and new.tipo is distinct from 'avulsa'::public.tipo_liberacao then
        raise exception 'Paciente esporádico somente recebe liberação avulsa (RN29)';
    end if;

    select u.perfil, u.status_ativo into v_autorizador_perfil, v_autorizador_ativo
    from public.usuarios u
    where u.id = new.profissional_autorizador_id;

    if v_autorizador_perfil is distinct from 'profissional_autorizador' or v_autorizador_ativo is not true then
        raise exception 'Profissional autorizador inválido ou inativo (RN02/RN27)';
    end if;

    if tg_op = 'INSERT' and new.renovacao_de_id is not null then
        perform 1
        from public.liberacoes l
        where l.id = new.renovacao_de_id
          and l.paciente_id = new.paciente_id;

        if not found then
            raise exception 'Renovação deve referenciar a liberação anterior do mesmo paciente (RN23)';
        end if;
    end if;

    if new.data_fim is null then
        if new.tipo = 'avulsa' then
            new.data_fim := new.data_inicio + interval '1 day';
        elsif new.tipo = 'continua' and new.periodo_meses is not null then
            new.data_fim := new.data_inicio + make_interval(months => new.periodo_meses::int);
        else
            raise exception 'Período de validade inválido para o tipo de liberação (RN13/RN21)';
        end if;
    end if;

    return new;
end;
$$;
