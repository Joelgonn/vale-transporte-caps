create or replace function public.perfil_atual()
returns public.perfil_usuario
language sql
stable
security definer
set search_path = public
as $$
    select u.perfil
    from public.usuarios u
    where u.auth_user_id = auth.uid()
$$;

create or replace function public.usuario_ativo_atual()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select u.status_ativo
    from public.usuarios u
    where u.auth_user_id = auth.uid()
$$;

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

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
    where l.id = new.liberacao_id;

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

create or replace function public.pacientes_audit(p public.pacientes)
returns jsonb
language sql
stable
as $$
    select jsonb_build_object(
        'gestor_sus', p.gestor_sus,
        'nome', p.nome,
        'status', p.status,
        'data_inicio_acompanhamento', p.data_inicio_acompanhamento,
        'data_fim_acompanhamento', p.data_fim_acompanhamento,
        'unidade_id', p.unidade_id
    )
$$;

create or replace function public.usuarios_audit(p public.usuarios)
returns jsonb
language sql
stable
as $$
    select jsonb_build_object(
        'nome', p.nome,
        'email', p.email,
        'perfil', p.perfil,
        'profissao', p.profissao,
        'status_ativo', p.status_ativo,
        'unidade_id', p.unidade_id
    )
$$;

create or replace function public.liberacoes_audit(p public.liberacoes)
returns jsonb
language sql
stable
as $$
    select jsonb_build_object(
        'paciente_id', p.paciente_id,
        'tipo', p.tipo,
        'periodo_meses', p.periodo_meses,
        'quantidade', p.quantidade,
        'data_inicio', p.data_inicio,
        'data_fim', p.data_fim,
        'profissional_autorizador_id', p.profissional_autorizador_id,
        'registrado_por_id', p.registrado_por_id,
        'renovacao_de_id', p.renovacao_de_id,
        'status', p.status,
        'justificativa', p.justificativa,
        'unidade_id', p.unidade_id
    )
$$;

create or replace function public.retiradas_audit(p public.retiradas)
returns jsonb
language sql
stable
as $$
    select jsonb_build_object(
        'liberacao_id', p.liberacao_id,
        'paciente_id', p.paciente_id,
        'recepcionista_id', p.recepcionista_id,
        'quantidade', p.quantidade,
        'data_hora', p.data_hora,
        'unidade_id', p.unidade_id
    )
$$;

create or replace function public.fn_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_acao text;
    v_entidade_id uuid;
    v_dados_antes jsonb;
    v_dados_depois jsonb;
    v_usuario_id uuid;
begin
    v_entidade_id := coalesce(new.id, old.id);

    if tg_table_name = 'usuarios'
       and coalesce(new.auth_user_id, old.auth_user_id) = auth.uid() then
        v_usuario_id := v_entidade_id;
    else
        select u.id into v_usuario_id
        from public.usuarios u
        where u.auth_user_id = auth.uid();
    end if;

    if v_usuario_id is null then
        return null;
    end if;

    case tg_table_name
        when 'pacientes' then
            if tg_op = 'INSERT' then
                v_acao := 'paciente.criado';
            elsif tg_op = 'UPDATE' then
                if new.status is distinct from old.status then
                    v_acao := 'paciente.status_alterado';
                else
                    v_acao := 'paciente.alterado';
                end if;
            else
                v_acao := 'paciente.removido';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.pacientes_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.pacientes_audit(new) end;
        when 'usuarios' then
            if tg_op = 'INSERT' then
                v_acao := 'usuario.criado';
            elsif tg_op = 'UPDATE' then
                if new.perfil is distinct from old.perfil then
                    v_acao := 'usuario.perfil_alterado';
                elsif new.status_ativo is distinct from old.status_ativo then
                    v_acao := 'usuario.status_alterado';
                else
                    v_acao := 'usuario.alterado';
                end if;
            else
                v_acao := 'usuario.removido';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.usuarios_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.usuarios_audit(new) end;
        when 'liberacoes' then
            if tg_op = 'INSERT' then
                if new.renovacao_de_id is not null then
                    v_acao := 'liberacao.renovada';
                else
                    v_acao := 'liberacao.criada';
                end if;
            elsif tg_op = 'UPDATE' then
                if new.status = 'cancelada' and old.status <> 'cancelada' then
                    v_acao := 'liberacao.cancelada';
                else
                    v_acao := 'liberacao.alterada';
                end if;
            else
                v_acao := 'liberacao.removida';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.liberacoes_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.liberacoes_audit(new) end;
        when 'retiradas' then
            if tg_op = 'INSERT' then
                v_acao := 'retirada.registrada';
            elsif tg_op = 'UPDATE' then
                v_acao := 'retirada.alterada';
            else
                v_acao := 'retirada.cancelada';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.retiradas_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.retiradas_audit(new) end;
    end case;

    insert into public.auditoria_logs (usuario_id, acao, entidade_tipo, entidade_id, dados_antes, dados_depois, data_hora)
    values (v_usuario_id, v_acao, tg_table_name, v_entidade_id, v_dados_antes, v_dados_depois, now());

    return null;
end;
$$;

create or replace function public.fn_auditoria_imutavel()
returns trigger
language plpgsql
as $$
begin
    raise exception 'auditoria_logs é append-only: atualização e exclusão são proibidas';
end;
$$;
