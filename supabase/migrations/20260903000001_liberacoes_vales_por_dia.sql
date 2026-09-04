-- Sprint 65 — Quantidade diária da liberação contínua
--
-- A quantidade diária (vales por dia) é o valor que deve ser usado como
-- quantidade inicial da retirada no atendimento com liberação contínua.
-- liberacoes.quantidade permanece como PREVISÃO ADMINISTRATIVA (RN04/RN31).
-- Esta coluna é específica para o fluxo de atendimento com contínua.
--
-- Escopo:
--   1. Adiciona coluna vales_por_dia (smallint, nullable, 1-10) em public.liberacoes;
--   2. Atualiza liberacoes_audit para incluir vales_por_dia nos snapshots.

alter table public.liberacoes
  add column if not exists vales_por_dia smallint;

alter table public.liberacoes
  drop constraint if exists liberacoes_vales_por_dia_check;

alter table public.liberacoes
  add constraint liberacoes_vales_por_dia_check
  check (vales_por_dia is null or vales_por_dia between 1 and 10);

-- Atualiza a função de auditoria para incluir vales_por_dia nos snapshots
create or replace function public.liberacoes_audit(p public.liberacoes)
returns jsonb
language sql
stable
as $$
    select jsonb_build_object(
        'paciente_id', p.paciente_id,
        'tipo', p.tipo,
        'periodo_meses', p.periodo_meses,
        'quantidade', p.quantidade,
        'vales_por_dia', p.vales_por_dia,
        'data_inicio', p.data_inicio,
        'data_fim', p.data_fim,
        'profissional_autorizador_id', p.profissional_autorizador_id,
        'registrado_por_id', p.registrado_por_id,
        'renovacao_de_id', p.renovacao_de_id,
        'status', p.status,
        'justificativa', p.justificativa,
        'unidade_id', p.unidade_id
    )
$$;
