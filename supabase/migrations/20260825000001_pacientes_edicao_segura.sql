-- Sprint 41 — Edição segura de pacientes: imutabilidade da origem + trilha completa
--
-- Fecha as DUAS lacunas identificadas na auditoria pré-implementação:
--
--   LACUNA 1 (origem mutável via API): o trigger fn_pacientes_before()
--   verificava apenas status (autorizador) e os demais campos (gestor), mas
--   NUNCA a coluna origem. Um profissional_autorizador ativo podia converter
--   origem (regular ↔ esporadico) via PostgREST direto — quebrando RN29
--   retroativamente e distorcendo histórico/relatórios.
--
--   LACUNA 2 (trilha cega): pacientes_audit() enumerava explicitamente
--   gestor_sus/nome/status/datas/unidade_id — SEM cpf e SEM origem. A migration
--   20260821000001 afirmava que a auditoria capturava a coluna nova
--   "automaticamente", mas a função monta o JSONB campo a campo (não usa
--   row_to_json): alterações de cpf/origem geravam log paciente.alterado SEM
--   antes/depois desses campos.
--
-- Escopo desta migration (APENAS isto):
--   1. pacientes_audit() recriada incluindo cpf e origem (demais campos
--      preservados integralmente, mesma ordem relativa);
--   2. fn_pacientes_before() recriada com checagem de IMUTABILIDADE DA ORIGEM
--      para TODOS os perfis, ANTES do branch por perfil (regras existentes
--      preservadas: gestor só status; autorizador tudo menos status;
--      demais perfis sem permissão);
--   3. NADA mais: sem policies novas, sem grants, sem tabelas, sem enum,
--      sem RLS de outros módulos. O trigger trg_pacientes_before já existe
--      (migration 20260811000009) e passa a disparar a função nova — não é
--      recriado.
--
-- Regras preservadas EXATAMENTE como estavam:
--   GESTOR ativo                → somente status;
--   PROFISSIONAL_AUTORIZADOR    → qualquer campo exceto status;
--   RECEPCIONISTA/outros        → nenhuma edição ("Perfil sem permissão").
--
-- Nova regra documentada (DOMAIN.md): ORIGEM É IMUTÁVEL APÓS O CADASTRO —
-- regular não vira esporádico, esporádico não vira regular (RN30).

-- ── 1) Trilha completa: cpf e origem entram nos snapshots antes/depois ──────
create or replace function public.pacientes_audit(p public.pacientes)
returns jsonb
language sql
stable
as $$
    select jsonb_build_object(
        'gestor_sus', p.gestor_sus,
        'nome', p.nome,
        'cpf', p.cpf,
        'status', p.status,
        'origem', p.origem,
        'data_inicio_acompanhamento', p.data_inicio_acompanhamento,
        'data_fim_acompanhamento', p.data_fim_acompanhamento,
        'unidade_id', p.unidade_id
    )
$$;

-- ── 2) Origem imutável para TODOS os perfis + regras anteriores preservadas ─
create or replace function public.fn_pacientes_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_perfil public.perfil_usuario;
begin
    if tg_op = 'UPDATE' then
        -- RN30 — a origem é imutável após o cadastro, para QUALQUER perfil.
        -- A checagem vem ANTES do branch por perfil: nem gestor, nem
        -- autorizador, nem qualquer outro vínculo converte origem.
        if new.origem is distinct from old.origem then
            raise exception 'A origem do paciente é imutável após o cadastro (RN30)';
        end if;

        v_perfil := public.perfil_atual();

        if v_perfil = 'profissional_autorizador'::public.perfil_usuario then
            if new.status is distinct from old.status then
                raise exception 'Profissional autorizador não pode alterar o status do paciente (ação administrativa do Gestor)';
            end if;
        elsif v_perfil = 'gestor'::public.perfil_usuario then
            if new.gestor_sus is distinct from old.gestor_sus
               or new.nome is distinct from old.nome
               or new.cpf is distinct from old.cpf
               or new.origem is distinct from old.origem
               or new.data_inicio_acompanhamento is distinct from old.data_inicio_acompanhamento
               or new.data_fim_acompanhamento is distinct from old.data_fim_acompanhamento
               or new.unidade_id is distinct from old.unidade_id then
                raise exception 'Gestor pode alterar apenas o status do paciente';
            end if;
        else
            raise exception 'Perfil sem permissão para alterar pacientes';
        end if;
    end if;

    return new;
end;
$$;
