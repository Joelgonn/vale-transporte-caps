-- Sprint 09.5 — Correção RLS de usuário inativo
-- Lacuna identificada: as policies de leitura abaixo usavam apenas
-- perfil_atual() e não verificavam usuario_ativo_atual(). Como perfil_atual()
-- retorna o perfil mesmo para usuário inativo (status_ativo = false), um
-- usuário inativo ainda conseguia consultar. Aqui adicionamos a checagem
-- de usuário ativo exclusivamente nestas duas policies.
--
-- NÃO altera migrations 01–12, funções, tabelas, triggers, views nem outras policies.

-- 1) pacientes_select_autenticados — adiciona usuario_ativo_atual()
drop policy if exists "pacientes_select_autenticados" on public.pacientes;
create policy "pacientes_select_autenticados"
    on public.pacientes for select to authenticated
    using (
        public.perfil_atual() is not null
        and public.usuario_ativo_atual()
    );

-- 2) liberacoes_select_recepcao_ativas — adiciona usuario_ativo_atual()
drop policy if exists "liberacoes_select_recepcao_ativas" on public.liberacoes;
create policy "liberacoes_select_recepcao_ativas"
    on public.liberacoes for select to authenticated
    using (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and status = 'ativa'::public.status_liberacao
        and public.usuario_ativo_atual()
    );
