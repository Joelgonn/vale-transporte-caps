-- Sprint 44 — Alinhamento do domínio e fluxos operacionais
--
-- Objetivos:
--  1. Matriz oficial de permissões (Gestor/Autorizador/Recepcionista) para
--     pacientes, liberações e retiradas.
--  2. P1 — Vigência não pode excluir retiradas existentes (trigger).
--  3. P1 — Remover limite silencioso continua em repositórios (app, sem migração);
--     aquidomínio de banco apenas amplia RLS para refletir matriz.
--  4. Preparar histórico estado+eventos (sem segunda trilha, reusa auditoria_logs).
--
-- Escopo desta migration (APENAS isto):
--  A) Pacientes — novas policies de INSERT que permitem:
--       * Gestor e Autorizador → regular e esporádico;
--       * Recepcionista → esporádico;
--  B) Liberações — novas policies de INSERT que permitem os TRÊS perfis ativos
--     criarem liberações (contínua e avulsa). Renovação pela recepção mantida.
--     Leitura de liberações ampliada para os três perfis (recepção mantida só ativas
--     para compatibilidade, mas gestor/autorizador viam todas).
--  C) Retiradas — leitura e INSERT ampliados aos TRÊS perfis ativos (antes só
--     recepcionista/gestor). Gestão do princípio autorização vs operação.
--  D) fn_liberacoes_before() — nova checagem em UPDATE: se houver retiradas,
--     nova janela deve conter [min(data_hora), max(data_hora)], senão rejeita.
--     Mantém todas as checagens anteriores (RN01, RN29, RN02/RN27, RN23, histórico
--     imutável, split por perfil, cálculo data_fim).
--
-- NÃO altera: tabelas, enums, views, RPCs, auditoria, grants existentes (exceto
-- os novos GRANTs implícitos por policies), outras migrations.

-- ── A) PACIENTES — policies de INSERT por origem × perfil (Sprint 44) ───────
drop policy if exists "pacientes_insert_regular" on public.pacientes;
drop policy if exists "pacientes_insert_recepcao_esporadico" on public.pacientes;
drop policy if exists "pacientes_insert_gestor_44" on public.pacientes;
drop policy if exists "pacientes_insert_autorizador_44" on public.pacientes;
drop policy if exists "pacientes_insert_recepcionista_44" on public.pacientes;

-- Gestor ativo → regular ou esporadico (pode criar ambos; reutilização é preferida via app)
create policy "pacientes_insert_gestor_44"
    on public.pacientes for insert to authenticated
    with check (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and origem in ('regular'::public.origem_paciente, 'esporadico'::public.origem_paciente)
    );

-- Profissional autorizador ativo → regular ou esporadico
create policy "pacientes_insert_autorizador_44"
    on public.pacientes for insert to authenticated
    with check (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and origem in ('regular'::public.origem_paciente, 'esporadico'::public.origem_paciente)
    );

-- Recepcionista ativa → SOMENTE esporadico (não cadastra regular independente)
create policy "pacientes_insert_recepcionista_44"
    on public.pacientes for insert to authenticated
    with check (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and origem = 'esporadico'::public.origem_paciente
    );

-- ── B) LIBERAÇÕES — policies de INSERT por perfil (Sprint 44) ──────────────
drop policy if exists "liberacoes_insert_autorizador" on public.liberacoes;
drop policy if exists "liberacoes_insert_recepcao_renovacao" on public.liberacoes;
drop policy if exists "liberacoes_insert_gestor_44" on public.liberacoes;
drop policy if exists "liberacoes_insert_autorizador_44" on public.liberacoes;
drop policy if exists "liberacoes_insert_recepcionista_44" on public.liberacoes;
drop policy if exists "liberacoes_insert_recepcionista_renovacao_44" on public.liberacoes;

-- Gestor ativo → cria qualquer liberação (contínua/avulsa) exceto renovação forçada
create policy "liberacoes_insert_gestor_44"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

-- Autorizador ativo → cria qualquer liberação
create policy "liberacoes_insert_autorizador_44"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

-- Recepcionista ativa → cria liberação direta (contínua/avulsa) DENTRO do fluxo operacional
-- A criação de paciente esporádico vinculada é tratada em pacientes_insert_recepcionista_44.
create policy "liberacoes_insert_recepcionista_44"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

-- Renovação pela recepção (renovacao_de_id NOT NULL) — mantida como policy dedicada
-- para auditoria explícita; duplicada com a anterior para clareza de trilha.
create policy "liberacoes_insert_recepcionista_renovacao_44"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and renovacao_de_id is not null
    );

-- Leitura de liberações: ampliar gestor/autorizador/recepcionista aos três perfis
-- (recepção continua vendo só ativas via policy dedicada, mas agora todos podem criar)
drop policy if exists "liberacoes_select_autorizador_gestor" on public.liberacoes;
drop policy if exists "liberacoes_select_gestor_autorizador_recepcionista_44" on public.liberacoes;
create policy "liberacoes_select_gestor_autorizador_recepcionista_44"
    on public.liberacoes for select to authenticated
    using (
        public.perfil_atual() in (
            'gestor'::public.perfil_usuario,
            'profissional_autorizador'::public.perfil_usuario,
            'recepcionista'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
        and (
            public.perfil_atual() != 'recepcionista'::public.perfil_usuario
            or status = 'ativa'::public.status_liberacao
        )
    );
-- A policy específica da recepção só-ativas torna-se redundante mas mantida
-- para histórico; se existir, o acesso já é coberto pela policy acima.

-- ── C) RETIRADAS — leitura e INSERT ampliados aos três perfis ativos ───────
drop policy if exists "retiradas_select_recepcao_gestor" on public.retiradas;
drop policy if exists "retiradas_select_44" on public.retiradas;
create policy "retiradas_select_44"
    on public.retiradas for select to authenticated
    using (
        public.perfil_atual() in (
            'gestor'::public.perfil_usuario,
            'profissional_autorizador'::public.perfil_usuario,
            'recepcionista'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
    );

drop policy if exists "retiradas_insert_recepcao" on public.retiradas;
drop policy if exists "retiradas_insert_44" on public.retiradas;
create policy "retiradas_insert_44"
    on public.retiradas for insert to authenticated
    with check (
        public.perfil_atual() in (
            'gestor'::public.perfil_usuario,
            'profissional_autorizador'::public.perfil_usuario,
            'recepcionista'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
    );

-- ── D) fn_liberacoes_before — proteger vigência contra edição retroativa ────
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
    v_min_retirada timestamptz;
    v_max_retirada timestamptz;
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

    -- ── Sprint 44 — edição segura (somente UPDATE) + proteção de vigência ──
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
            -- Sprint 44 P1 — vigência não pode excluir retiradas existentes.
            -- Só checa se data_inicio ou data_fim foi alterada.
            if new.data_inicio is distinct from old.data_inicio
               or new.data_fim is distinct from old.data_fim then
                select min(r.data_hora), max(r.data_hora)
                  into v_min_retirada, v_max_retirada
                from public.retiradas r
                where r.liberacao_id = old.id;
                if v_min_retirada is not null then
                    if new.data_inicio > v_min_retirada then
                        raise exception 'A nova data de início não pode excluir retiradas já registradas (menor retirada % — RN13/RN21)', v_min_retirada;
                    end if;
                    if new.data_fim < v_max_retirada then
                        raise exception 'A nova data de fim não pode excluir retiradas já registradas (maior retirada % — RN13/RN21)', v_max_retirada;
                    end if;
                end if;
            end if;
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
