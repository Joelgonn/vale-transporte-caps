-- Sprint 19 — Fechamento do gap RLS: renovação de liberação somente pela recepção
--
-- A policy "liberacoes_insert_autorizador" (criada na migration 09) permitia que
-- um profissional_autorizador inserisse em public.liberacoes mesmo quando
-- renovacao_de_id IS NOT NULL — o bloqueio de "renovação somente pela recepção"
-- vivia apenas na Server Action (criarLiberacaoAction), dependente da camada de
-- aplicação.
--
-- Esta migration é ADITIVA e altera EXCLUSIVAMENTE essa policy: preserva
-- integralmente as condições existentes (perfil autorizador + usuário ativo) e
-- acrescenta explicitamente `renovacao_de_id is null`. A recepção permanece
-- regulada pela policy "liberacoes_insert_recepcao_renovacao" (inalterada).
-- Nenhuma tabela/coluna/enum/trigger/função/view/grant é modificada.
--
-- Segue o padrão do projeto (migrations 09/13/14): `drop policy if exists` +
-- `create policy` — idempotente e sem tocar nas migrations anteriores.

drop policy if exists "liberacoes_insert_autorizador" on public.liberacoes;

create policy "liberacoes_insert_autorizador"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'profissional_autorizador'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and renovacao_de_id is null
    );
