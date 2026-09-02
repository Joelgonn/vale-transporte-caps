-- Sprint 44 fix — restringir renovação à recepção
-- A migration 20260902000001 permitiu aos três perfis qualquer INSERT em liberacoes,
-- o que liberou inadvertidamente o autorizador/gestor para renovar (renovacao_de_id NOT NULL).
-- Regra oficial: renovação é registrada pela recepção, mantendo o autorizador original.
-- Esta migration restringe gestor/autorizador a criações sem renovacao_de_id.

drop policy if exists "liberacoes_insert_gestor_44" on public.liberacoes;
create policy "liberacoes_insert_gestor_44"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'gestor'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and renovacao_de_id is null
    );

drop policy if exists "liberacoes_insert_autorizador_44" on public.liberacoes;
create policy "liberacoes_insert_autorizador_44"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and renovacao_de_id is null
    );

-- Recepcionista mantém duas policies: direta (qualquer, mas Renovacao dedicada já cobre)
-- A policy direta de recepcionista já permite qualquer insert; a renovacao dedicada permanece
-- para auditoria. Não é necessário restringir a recepção.
