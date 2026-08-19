create table public.liberacoes (
    id uuid primary key default gen_random_uuid(),
    paciente_id uuid not null,
    tipo public.tipo_liberacao not null,
    periodo_meses smallint,
    quantidade smallint not null,
    data_inicio timestamptz not null default now(),
    data_fim timestamptz not null,
    profissional_autorizador_id uuid not null,
    registrado_por_id uuid not null,
    renovacao_de_id uuid,
    status public.status_liberacao not null default 'ativa',
    justificativa text,
    unidade_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint liberacoes_paciente_id_fkey foreign key (paciente_id)
        references public.pacientes (id),
    constraint liberacoes_profissional_autorizador_id_fkey foreign key (profissional_autorizador_id)
        references public.usuarios (id),
    constraint liberacoes_registrado_por_id_fkey foreign key (registrado_por_id)
        references public.usuarios (id),
    constraint liberacoes_renovacao_de_id_fkey foreign key (renovacao_de_id)
        references public.liberacoes (id),
    constraint liberacoes_quantidade_check check (quantidade in (1, 2, 4, 8)),
    constraint liberacoes_periodo_check check (
        (tipo = 'continua' and periodo_meses in (1, 3, 6))
        or (tipo = 'avulsa' and periodo_meses is null)
    ),
    constraint liberacoes_data_fim_check check (data_fim > data_inicio)
);

create index liberacoes_paciente_status_idx on public.liberacoes (paciente_id, status);

create index liberacoes_profissional_autorizador_idx on public.liberacoes (profissional_autorizador_id);

create index liberacoes_renovacao_de_idx on public.liberacoes (renovacao_de_id);

create index liberacoes_data_fim_idx on public.liberacoes (data_fim);

create index liberacoes_tipo_quantidade_idx on public.liberacoes (tipo, quantidade);
