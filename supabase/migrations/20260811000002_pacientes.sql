create table public.pacientes (
    id uuid primary key default gen_random_uuid(),
    gestor_sus text not null,
    nome text not null,
    cpf text,
    status public.status_paciente not null default 'ativo',
    data_inicio_acompanhamento date,
    data_fim_acompanhamento date,
    unidade_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint pacientes_gestor_sus_key unique (gestor_sus),
    constraint pacientes_status_check check (status in ('ativo', 'inativo'))
);

create unique index pacientes_cpf_key on public.pacientes (cpf) where cpf is not null;

create index pacientes_status_idx on public.pacientes (status);
