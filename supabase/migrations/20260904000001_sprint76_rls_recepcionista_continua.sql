-- Sprint 76 — Alinhamento RLS da criação de liberações (P1 da Sprint 75)
--
-- DIVERGÊNCIA CORRIGIDA:
--   A policy "liberacoes_insert_recepcionista_44" (criada na migration
--   20260902000001_sprint44_alinhamento_dominio.sql) permitia à recepcionista
--   ativa QUALQUER insert em public.liberacoes (sem filtro de tipo/renovação),
--   enquanto a regra efetiva da aplicação (UI → domínio → action) determina:
--     - recepcionista NÃO cria nova liberação contínua regular;
--     - recepcionista cria liberação avulsa;
--     - recepcionista cria renovação (renovacao_de_id NOT NULL, tipo preservado
--       do original — inclusive contínua, cf. app/actions/liberacoes.ts:108-143).
--   A proteção real dependia somente da action (deny em
--   app/actions/liberacoes.ts:155-160); um INSERT direto via PostgREST com
--   sessão de recepcionista em paciente regular passava no banco.
--
-- CORREÇÃO (somente esta policy):
--   "liberacoes_insert_recepcionista_44" passa a exigir:
--     (tipo = 'avulsa' OR renovacao_de_id IS NOT NULL)
--   mantendo perfil = recepcionista + usuário ativo.
--
-- MATRIZ RESULTANTE (OR entre policies — basta UMA policy permitir):
--   gestor/autorizador + renovacao null (qualquer tipo) → gestor_44/autorizador_44 ✓
--   gestor/autorizador + renovacao not null → nenhuma policy (só recepção renova) ✗
--   recepcionista + avulsa + renovacao null → recepcionista_44 ✓ (nova avulsa)
--   recepcionista + avulsa + renovacao not null → recepcionista_44 + renovacao_44 ✓
--   recepcionista + continua + renovacao not null → renovacao_44 ✓ (renovação preserva tipo)
--   recepcionista + continua + renovacao null → nenhuma policy ✗ (CORREÇÃO)
--
-- NÃO ALTERA: nenhuma outra policy, triggers (RN29 coexiste), tabelas,
-- constraints, dados (sem backfill), RLS de leitura/escrita demais.
-- Decisões de produto pendentes da Sprint 75 (UNIQUE de renovação, múltiplas
-- renovações, gap/sobreposição, autorizador inativo) NÃO são tocadas.
--
-- Aplicação: SQL Editor do Supabase / Management API — mesmo fluxo das
-- Sprints 41.1/42/42.2 (migration versionada, aplicação autorizada em DEV
-- primeiro, depois PROD).

drop policy if exists "liberacoes_insert_recepcionista_44" on public.liberacoes;

create policy "liberacoes_insert_recepcionista_44"
    on public.liberacoes for insert to authenticated
    with check (
        public.perfil_atual() = 'recepcionista'::public.perfil_usuario
        and public.usuario_ativo_atual()
        and (
            tipo = 'avulsa'::public.tipo_liberacao
            or renovacao_de_id is not null
        )
    );
