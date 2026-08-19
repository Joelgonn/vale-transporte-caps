create table public.usuarios (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null,
    nome text not null,
    email text not null,
    perfil public.perfil_usuario not null,
    profissao public.profissao,
    status_ativo boolean not null default true,
    unidade_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint usuarios_auth_user_id_key unique (auth_user_id),
    constraint usuarios_email_key unique (email),
    constraint usuarios_auth_user_id_fkey foreign key (auth_user_id)
        references auth.users (id)
        on delete restrict,
    constraint usuarios_profissao_check check (
        perfil <> 'profissional_autorizador'::public.perfil_usuario or profissao is not null
    )
);

create index usuarios_perfil_status_idx on public.usuarios (perfil, status_ativo);
