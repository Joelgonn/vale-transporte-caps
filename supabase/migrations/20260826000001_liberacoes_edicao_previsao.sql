-- Sprint 42 — Gestão flexível de vales: quantidade como PREVISÃO + edição segura
--
-- PROBLEMA (auditado na Sprint 42):
--   A quantidade total da liberação era um ORÇAMENTO fixo decidido no passado.
--   Quando o consumo real atingia esse total, o trigger fn_retiradas_before
--   BLOQUEAVA novas retiradas mesmo com a liberação vigente — obrigando o
--   usuário a prever antecipadamente o consumo de meses inteiros ou a criar
--   operações artificiais (nova liberação só para "reabastecer" saldo).
--
-- DECISÃO DE DOMÍNIO (Sprint 42 — documentada em DOMAIN.md):
--   liberacoes.quantidade passa a ser PREVISÃO administrativa (RN04 mantém a
--   escala 1/2/4/8 do MVP). A AUTORIZAÇÃO real é o PAR (vigência RN13/RN21 +
--   status ativa). Retirada NÃO é mais bloqueada por previsão atingida —
--   retirado > previsto é estado válido e visível ("Diferença").
--
-- Escopo desta migration (APENAS isto):
--   1. fn_retiradas_before() recriada SEM as duas checagens de quantidade
--      (`new.quantidade > v_liberacao.quantidade` e `new.quantidade > restante`).
--      PRESERVADO integralmente: SELECT ... FOR UPDATE (lock anti-concorrência,
--      migration 20260817000001), defaults de INSERT (recepcionista_id/data_hora),
--      status 'ativa', RN24 (mesmo paciente), janela RN13/RN21, RN01 (paciente).
--   2. fn_liberacoes_before() recriada: lógica de INSERT IDÊNTICA (RN01/RN02/
--      RN27/RN23/RN29/RN13-RN21) + NOVA branch de UPDATE que habilita a edição
--      segura por perfil:
--        * campos HISTÓRICOS imutáveis para todos: paciente_id, tipo,
--          periodo_meses, profissional_autorizador_id, registrado_por_id,
--          renovacao_de_id;
--        * GESTOR ativo: somente status + unidade_id;
--        * PROFISSIONAL_AUTORIZADOR ativo: quantidade (previsão), datas,
--          justificativa, unidade_id — nunca status;
--        * demais perfis: nenhuma edição.
--   3. GRANT UPDATE ON liberacoes TO authenticated (revogado na migration 15
--      quando não havia edição) + policy RLS liberacoes_update_autorizador_
--      gestor (USING/WITH CHECK por perfil ativo; split de CAMPOS continua no
--      trigger, mesmo padrão de pacientes).
--
-- NÃO altera: tabelas, enums, views, RPCs, policies existentes, grants de
-- outras tabelas, auditoria (trg_liberacoes_audit já cobre UPDATE com
-- snapshots antes/depois via liberacoes_audit(), que inclui todos os campos),
-- retiradas (exceto a função citada).

-- ── 1) Retirada deixa de ser bloqueada pela previsão ─────────────────────────
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

    -- Lock preservado (migration 20260817000001): serializa retiradas contra a
    -- mesma liberação e protege leituras coerentes durante edições concorrentes.
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

    -- Sprint 42: a quantidade da liberação é PREVISÃO administrativa — NÃO
    -- bloqueia retiradas. Consumo real pode exceder a previsão ("Diferença"
    -- negativa); os controles vigentes são: janela de validade (acima),
    -- status ativo, RN24 e RN01.

    return new;
end;
$$;

-- ── 2) Edição segura de liberações no banco ─────────────────────────────────
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
    v_perfil public.perfil_usuario;
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

    -- ── Sprint 42 — edição segura (somente UPDATE) ──────────────────────────
    if tg_op = 'UPDATE' then
        v_perfil := public.perfil_atual();

        if v_perfil is distinct from 'gestor'::public.perfil_usuario
           and v_perfil is distinct from 'profissional_autorizador'::public.perfil_usuario then
            raise exception 'Perfil sem permissão para alterar liberações';
        end if;

        -- Campos HISTÓRICOS são imutáveis para TODOS os perfis.
        if new.paciente_id is distinct from old.paciente_id
           or new.tipo is distinct from old.tipo
           or new.periodo_meses is distinct from old.periodo_meses
           or new.profissional_autorizador_id is distinct from old.profissional_autorizador_id
           or new.registrado_por_id is distinct from old.registrado_por_id
           or new.renovacao_de_id is distinct from old.renovacao_de_id then
            raise exception 'Campos históricos da liberação são imutáveis (paciente, tipo, período, autorizador, renovação)';
        end if;

        if v_perfil = 'gestor'::public.perfil_usuario then
            if new.quantidade is distinct from old.quantidade
               or new.data_inicio is distinct from old.data_inicio
               or new.data_fim is distinct from old.data_fim
               or new.justificativa is distinct from old.justificativa then
                raise exception 'Gestor pode alterar apenas o status e campos administrativos da liberação';
            end if;
        else
            -- profissional_autorizador: nunca altera status.
            if new.status is distinct from old.status then
                raise exception 'Profissional autorizador não pode alterar o status da liberação (ação administrativa do Gestor)';
            end if;
            -- permitidos: quantidade (previsão), data_inicio, data_fim,
            -- justificativa, unidade_id.
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

-- ── 3) Grant + policy RLS de UPDATE (split fino de campos fica no trigger) ──
grant update on table public.liberacoes to authenticated;

drop policy if exists "liberacoes_update_autorizador_gestor" on public.liberacoes;
create policy "liberacoes_update_autorizador_gestor"
    on public.liberacoes for update to authenticated
    using (
        public.perfil_atual() in (
            'profissional_autorizador'::public.perfil_usuario,
            'gestor'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
    )
    with check (
        public.perfil_atual() in (
            'profissional_autorizador'::public.perfil_usuario,
            'gestor'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
    );
