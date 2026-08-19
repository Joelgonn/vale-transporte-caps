-- Sprint 36 — Atomicidade do saldo de retiradas: lock da liberação no trigger
--
-- Contexto (reproduzido em scripts/repro-sprint-36.mjs — Parte A):
--   O trigger public.fn_retiradas_before (criado na migration 07) lê a
--   liberação SEM travar a linha:
--
--     select l.* into v_liberacao
--     from public.liberacoes l
--     where l.id = new.liberacao_id;
--
--   e em seguida calcula v_total_retirado com um SELECT SUM em retiradas. Sob
--   concorrência (duas retiradas simultâneas contra a mesma liberação), duas
--   transações podem ler o MESMO total retirado antes de qualquer uma commitar
--   e ambas passarem a checagem de saldo → OVER-SUBSCRIPTION (soma das
--   retiradas > quantidade autorizada). Reprodução real: liberação de 2 com 4
--   retiradas concorrentes de 1 → 4/4 aceitas e soma=3 > 2.
--
-- Correção (mínima e aditiva):
--   Adicionar `for update` ao SELECT da liberação dentro do trigger. A row lock
--   é mantida até o commit da transação: sob READ COMMITTED, a segunda transação
--   que tentar inserir contra a mesma liberação BLOQUEIA até a primeira commitar
--   e, ao reavaliar, enxerga as retiradas já registradas → a checagem de saldo
--   passa a ser serializada por liberação. Não há outra operação que trave
--   linhas de liberacoes no sistema (UPDATE/DELETE são revogados), então não há
--   risco novo de deadlock.
--
-- Escopo:
--   Apenas `create or replace function public.fn_retiradas_before()`.
--   NÃO altera: triggers, policies (RLS), grants, views, tabelas, enums,
--   outras funções nem migrations 01–20.
--
-- Aplicação: SQL Editor do Supabase (ou supabase db push). NÃO rodar em remoto
-- sem autorização explícita.

create or replace function public.fn_retiradas_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid;
    v_liberacao public.liberacoes;
    v_paciente_status public.status_paciente;
    v_total_retirado bigint;
    v_restante bigint;
begin
    select u.id into v_uid
    from public.usuarios u
    where u.auth_user_id = auth.uid();

    if v_uid is null then
        raise exception 'Usuário autenticado não vinculado a um registro funcional';
    end if;

    if tg_op = 'INSERT' then
        new.recepcionista_id := v_uid;
        if new.data_hora is null then
            new.data_hora := now();
        end if;
    end if;

    select l.* into v_liberacao
    from public.liberacoes l
    where l.id = new.liberacao_id
    for update;

    if v_liberacao.id is null then
        raise exception 'Liberação não encontrada';
    end if;

    if v_liberacao.status is distinct from 'ativa' then
        raise exception 'Liberação não está ativa para retirada';
    end if;

    if v_liberacao.paciente_id is distinct from new.paciente_id then
        raise exception 'Retirada deve pertencer ao paciente da liberação (RN24)';
    end if;

    if new.data_hora < v_liberacao.data_inicio or new.data_hora > v_liberacao.data_fim then
        raise exception 'Retirada fora do período de validade da liberação (RN13/RN21)';
    end if;

    select p.status into v_paciente_status
    from public.pacientes p
    where p.id = new.paciente_id;

    if v_paciente_status is distinct from 'ativo' then
        raise exception 'Paciente sem direito ativo (RN01)';
    end if;

    if new.quantidade > v_liberacao.quantidade then
        raise exception 'Quantidade excede a autorizada na liberação (RN14)';
    end if;

    select coalesce(sum(r.quantidade), 0) into v_total_retirado
    from public.retiradas r
    where r.liberacao_id = new.liberacao_id
      and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000');

    v_restante := v_liberacao.quantidade - v_total_retirado;

    if new.quantidade > v_restante then
        raise exception 'Quantidade excede a quantidade restante da liberação';
    end if;

    return new;
end;
$$;