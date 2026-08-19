create or replace function public.fn_pacientes_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_perfil public.perfil_usuario;
begin
    if tg_op = 'UPDATE' then
        v_perfil := public.perfil_atual();

        if v_perfil = 'profissional_autorizador'::public.perfil_usuario then
            if new.status is distinct from old.status then
                raise exception 'Profissional autorizador não pode alterar o status do paciente (ação administrativa do Gestor)';
            end if;
        elsif v_perfil = 'gestor'::public.perfil_usuario then
            if new.gestor_sus is distinct from old.gestor_sus
               or new.nome is distinct from old.nome
               or new.cpf is distinct from old.cpf
               or new.data_inicio_acompanhamento is distinct from old.data_inicio_acompanhamento
               or new.data_fim_acompanhamento is distinct from old.data_fim_acompanhamento
               or new.unidade_id is distinct from old.unidade_id then
                raise exception 'Gestor pode alterar apenas o status do paciente';
            end if;
        else
            raise exception 'Perfil sem permissão para alterar pacientes';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_pacientes_before on public.pacientes;
create trigger trg_pacientes_before
    before update on public.pacientes
    for each row execute function public.fn_pacientes_before();

alter table public.pacientes enable row level security;

drop policy if exists "pacientes_select_autenticados" on public.pacientes;
create policy "pacientes_select_autenticados"
    on public.pacientes for select to authenticated
    using (public.perfil_atual() is not null);

drop policy if exists "pacientes_insert_autorizador" on public.pacientes;
create policy "pacientes_insert_autorizador"
    on public.pacientes for insert to authenticated
    with check (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

drop policy if exists "pacientes_update_autorizador" on public.pacientes;
create policy "pacientes_update_autorizador"
    on public.pacientes for update to authenticated
    using (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
    )
    with check (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

drop policy if exists "pacientes_update_gestor" on public.pacientes;
create policy "pacientes_update_gestor"
    on public.pacientes for update to authenticated
    using (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    )
    with check (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

alter table public.usuarios enable row level security;

drop policy if exists "usuarios_select_gestor" on public.usuarios;
create policy "usuarios_select_gestor"
    on public.usuarios for select to authenticated
    using (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

drop policy if exists "usuarios_insert_gestor" on public.usuarios;
create policy "usuarios_insert_gestor"
    on public.usuarios for insert to authenticated
    with check (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

drop policy if exists "usuarios_update_gestor" on public.usuarios;
create policy "usuarios_update_gestor"
    on public.usuarios for update to authenticated
    using (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    )
    with check (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

drop policy if exists "usuarios_delete_gestor" on public.usuarios;
create policy "usuarios_delete_gestor"
    on public.usuarios for delete to authenticated
    using (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

alter table public.liberacoes enable row level security;

drop policy if exists "liberacoes_select_autorizador_gestor" on public.liberacoes;
create policy "liberacoes_select_autorizador_gestor"
    on public.liberacoes for select to authenticated
    using (
        public.perfil_atual() in (
            'profissional_autorizador'::public.perfil_usuario,
            'gestor'::public.perfil_usuario
        )
    );

drop policy if exists "liberacoes_select_recepcao_ativas" on public.liberacoes;
create policy "liberacoes_select_recepcao_ativas"
    on public.liberacoes for select to authenticated
    using (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and status = 'ativa'::public.status_liberacao
    );

drop policy if exists "liberacoes_insert_autorizador" on public.liberacoes;
create policy "liberacoes_insert_autorizador"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

drop policy if exists "liberacoes_insert_recepcao_renovacao" on public.liberacoes;
create policy "liberacoes_insert_recepcao_renovacao"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and renovacao_de_id is not null
    );

alter table public.retiradas enable row level security;

drop policy if exists "retiradas_select_recepcao_gestor" on public.retiradas;
create policy "retiradas_select_recepcao_gestor"
    on public.retiradas for select to authenticated
    using (
        public.perfil_atual() in (
            'recepcionista'::public.perfil_usuario,
            'gestor'::public.perfil_usuario
        )
    );

drop policy if exists "retiradas_insert_recepcao" on public.retiradas;
create policy "retiradas_insert_recepcao"
    on public.retiradas for insert to authenticated
    with check (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );

alter table public.auditoria_logs enable row level security;

drop policy if exists "auditoria_select_gestor" on public.auditoria_logs;
create policy "auditoria_select_gestor"
    on public.auditoria_logs for select to authenticated
    using (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
    );
