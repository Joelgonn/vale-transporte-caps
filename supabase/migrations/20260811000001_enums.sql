create type public.status_paciente as enum ('ativo', 'inativo');

create type public.perfil_usuario as enum ('profissional_autorizador', 'recepcionista', 'gestor');

create type public.profissao as enum ('assistente_social', 'psicologo', 'terapeuta_ocupacional');

create type public.tipo_liberacao as enum ('continua', 'avulsa');

create type public.status_liberacao as enum ('ativa', 'expirada', 'cancelada');
