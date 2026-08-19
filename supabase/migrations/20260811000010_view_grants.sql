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
    updated_at
from public.pacientes;

drop view if exists public.v_pacientes_com_cpf;

create or replace function public.pacientes_com_cpf()
returns table (
    id uuid,
    gestor_sus text,
    nome text,
    cpf text,
    status public.status_paciente,
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
    select p.id, p.gestor_sus, p.nome, p.cpf, p.status,
           p.data_inicio_acompanhamento, p.data_fim_acompanhamento,
           p.unidade_id, p.created_at, p.updated_at
    from public.pacientes p
    where public.perfil_atual() = 'gestor'::public.perfil_usuario
      and public.usuario_ativo_atual()
$$;

revoke all on table public.pacientes from anon;
revoke all on table public.usuarios from anon;
revoke all on table public.liberacoes from anon;
revoke all on table public.retiradas from anon;
revoke all on table public.auditoria_logs from anon;
revoke all on table public.v_pacientes from anon;

grant select, insert, update, delete on table public.pacientes to authenticated;
grant select, insert, update, delete on table public.usuarios to authenticated;
grant select, insert, update, delete on table public.liberacoes to authenticated;
grant select, insert, update, delete on table public.retiradas to authenticated;
grant select on table public.auditoria_logs to authenticated;
grant select on table public.v_pacientes to authenticated;

revoke insert, update, delete on table public.auditoria_logs from authenticated;

revoke select (cpf) on table public.pacientes from anon, authenticated;

revoke execute on function public.perfil_atual() from public;
revoke execute on function public.usuario_ativo_atual() from public;
grant execute on function public.perfil_atual() to authenticated;
grant execute on function public.usuario_ativo_atual() to authenticated;

revoke execute on function public.pacientes_com_cpf() from public;
grant execute on function public.pacientes_com_cpf() to authenticated;

revoke execute on function public.pacientes_audit(public.pacientes) from public;
revoke execute on function public.usuarios_audit(public.usuarios) from public;
revoke execute on function public.liberacoes_audit(public.liberacoes) from public;
revoke execute on function public.retiradas_audit(public.retiradas) from public;
