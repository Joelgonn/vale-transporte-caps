-- Migration 18 — CPF inacessível a authenticated (privilégios por coluna)
--
-- Contexto: enquanto authenticated mantém SELECT no nível da tabela
-- public.pacientes, o REVOKE SELECT (cpf) da migration 17 é inócuo: o privilégio
-- de tabela cobre todas as colunas, incluindo cpf. O acesso real a pacientes
-- passou a ser por SELECT de coluna, mantendo v_pacientes operacional.
--
-- Estratégia:
--   1. Revoga o SELECT de tabela inteira para authenticated;
--   2. Concede SELECT por coluna para authenticated em TODAS as colunas de
--      public.pacientes EXCETO cpf.
--
-- Resultado (menor privilégio):
--   * v_pacientes (security_invoker, usa só as colunas sem cpf) continua OK;
--   * nenhum caminho direto a pacientes.cpf para authenticated — somente a RPC
--     pacientes_com_cpf() (SECURITY DEFINER + gate de gestor ativo) o expõe;
--   * INSERT/UPDATE/DELETE/trigger/auditoria/RLS/policies não são alterados.
--
-- Não altera: RLS, policies, pacientes_com_cpf(), v_pacientes, triggers,
-- funções, tabelas, migrations 01–17 ou privilégios fora do SELECT.

revoke select on table public.pacientes from authenticated;

grant select (id, gestor_sus, nome, status,
              data_inicio_acompanhamento, data_fim_acompanhamento,
              unidade_id, created_at, updated_at)
    on table public.pacientes to authenticated;