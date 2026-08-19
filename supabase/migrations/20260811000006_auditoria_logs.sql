create table public.auditoria_logs (
    id bigint generated always as identity primary key,
    usuario_id uuid not null,
    acao text not null,
    entidade_tipo text not null,
    entidade_id uuid not null,
    dados_antes jsonb,
    dados_depois jsonb,
    data_hora timestamptz not null default now(),
    constraint auditoria_logs_usuario_id_fkey foreign key (usuario_id)
        references public.usuarios (id)
);

create index auditoria_logs_usuario_idx on public.auditoria_logs (usuario_id);

create index auditoria_logs_entidade_idx on public.auditoria_logs (entidade_tipo, entidade_id);

create index auditoria_logs_data_hora_idx on public.auditoria_logs (data_hora);
