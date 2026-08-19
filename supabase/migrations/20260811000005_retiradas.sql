create table public.retiradas (
    id uuid primary key default gen_random_uuid(),
    liberacao_id uuid not null,
    paciente_id uuid not null,
    recepcionista_id uuid not null,
    quantidade smallint not null,
    data_hora timestamptz not null default now(),
    unidade_id uuid,
    constraint retiradas_liberacao_id_fkey foreign key (liberacao_id)
        references public.liberacoes (id),
    constraint retiradas_paciente_id_fkey foreign key (paciente_id)
        references public.pacientes (id),
    constraint retiradas_recepcionista_id_fkey foreign key (recepcionista_id)
        references public.usuarios (id),
    constraint retiradas_quantidade_positiva_check check (quantidade > 0)
);

create index retiradas_liberacao_idx on public.retiradas (liberacao_id);

create index retiradas_paciente_idx on public.retiradas (paciente_id);

create index retiradas_recepcionista_idx on public.retiradas (recepcionista_id);

create index retiradas_data_hora_idx on public.retiradas (data_hora);
