-- Sprint 09.6 — Correção RLS de leitura para usuários inativos
-- Mesma lacuna da Sprint 09.5: as duas policies de leitura abaixo verificavam
-- apenas perfil_atual() (que retorna o perfil mesmo para usuário inativo),
-- permitindo que usuário inativo consultasse dados operacionais.
-- Adicionamos a checagem de usuário ativo exclusivamente nestas duas policies.
--
-- NÃO altera migrations 01–13, funções, tabelas, triggers, grants/revokes
-- nem nenhuma outra policy.

-- 1) liberacoes_select_autorizador_gestor — adiciona usuario_ativo_atual()
drop policy if exists "liberacoes_select_autorizador_gestor" on public.liberacoes;
create policy "liberacoes_select_autorizador_gestor"
    on public.liberacoes for select to authenticated
    using (
        public.perfil_atual() in (
            'profissional_autorizador'::public.perfil_usuario,
            'gestor'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
    );

-- 2) retiradas_select_recepcao_gestor — adiciona usuario_ativo_atual()
drop policy if exists "retiradas_select_recepcao_gestor" on public.retiradas;
create policy "retiradas_select_recepcao_gestor"
    on public.retiradas for select to authenticated
    using (
        public.perfil_atual() in (
            'recepcionista'::public.perfil_usuario,
            'gestor'::public.perfil_usuario
        )
        and public.usuario_ativo_atual()
    );
