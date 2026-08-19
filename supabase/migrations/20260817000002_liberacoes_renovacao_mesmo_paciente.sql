-- Sprint 36 — Renovação deve referenciar liberação anterior do MESMO paciente (RN23)
--
-- Contexto (reproduzido em scripts/repro-sprint-36.mjs — Parte B):
--   A migration 20260813000002 fechou o gap "quem pode renovar" (autorizador
--   não renova; recepção só com renovacao_de_id). Mas public.fn_liberacoes_before
--   (migration 07) NÃO valida o vínculo da renovação com a liberação original:
--   via PostgREST, a recepção pode inserir uma "renovação" apontando
--   (renovacao_de_id) para a liberação de um paciente, mas com paciente_id de
--   OUTRO paciente — a FK só garante que o id referenciado existe, não que seja
--   do mesmo paciente. Reprodução real: renovação com paciente diferente foi
--   ACEITA pelo banco.
--
--   DATABASE.md (constraint 12): "Renovação (renovacao_de_id) referenciando
--   liberação anterior do mesmo paciente (RN23)". A checagem estava prevista na
--   camada de serviço/application; esta migration a reforça no BANCO (última
--   linha de defesa — SECURITY.md), sem inventar regra.
--
--   NOTA: a validação é SOMENTE o vínculo de paciente. NÃO se valida aqui que a
--   liberação original esteja "não ativa" (DATABASE.md registra essa parte como
--   validação de serviço e o fluxo real renova liberação ATIVA — Sprint 18/19).
--
-- Correção (mínima e aditiva):
--   Em public.fn_liberacoes_before, para INSERT com renovacao_de_id não nulo,
--   verificar que existe liberação com aquele id e o MESMO paciente_id da nova
--   liberação; se não, levantar exceção RN23. As demais validações e o cálculo
--   de data_fim permanecem idênticos.
--
-- Escopo:
--   Apenas `create or replace function public.fn_liberacoes_before()`.
--   NÃO altera: triggers, policies (RLS), grants, views, tabelas, enums,
--   outras funções nem migrations 01–20 e 20260817000001.
--
-- Aplicação: SQL Editor do Supabase (ou supabase db push). NÃO rodar em remoto
-- sem autorização explícita.

create or replace function public.fn_liberacoes_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_paciente_status public.status_paciente;
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

    select p.status into v_paciente_status
    from public.pacientes p
    where p.id = new.paciente_id;

    if v_paciente_status is distinct from 'ativo' then
        raise exception 'Paciente sem direito ativo (RN01)';
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