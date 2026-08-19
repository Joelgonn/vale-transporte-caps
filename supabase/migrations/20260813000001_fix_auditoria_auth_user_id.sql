-- Migration 20 — Correção do trigger de auditoria em INSERT de pacientes/liberacoes/retiradas
--
-- Contexto (descoberto na Sprint 18, validado contra o banco real):
--   Todo INSERT em public.pacientes (e idem liberacoes/retiradas) falhava com
--   `record "new" has no field "auth_user_id"`. A causa é a linha inicial de
--   public.fn_auditoria():
--
--     if tg_table_name = 'usuarios'
--        and coalesce(new.auth_user_id, old.auth_user_id) = auth.uid() then
--
--   O campo auth_user_id SÓ existe no tipo public.usuarios. Para um INSERT em
--   pacientes/liberacoes/retiradas o registro `new` não possui esse campo, e o
--   PostgreSQL avalia o operando direito do AND (acesso a new.auth_user_id)
--   mesmo quando tg_table_name <> 'usuarios' → erro em TODO INSERT dessas
--   tabelas (o trigger AFTER INSERT trg_*_audit chama fn_auditoria).
--
--   Isso NÃO afeta usuarios (o campo existe) — por isso os testes de integração
--   existentes (que só inseriam em usuarios) passavam.
--
-- Correção (mínima):
--   Reestrutura o bloco inicial com IF aninhado, garantindo que
--   new.auth_user_id/old.auth_user_id só sejam acessados quando
--   tg_table_name = 'usuarios'. A semântica é IDÊNTICA à anterior para todos os
--   casos (usuarios e demais tabelas, INSERT/UPDATE/DELETE).
--
-- Escopo:
--   Apenas `create or replace function public.fn_auditoria()`.
--   NÃO altera: triggers, policies (RLS), grants, views, outras funções,
--   tabelas nem migrations 01–19.
--
-- Aplicação: colar no SQL Editor do Supabase (sem db push neste momento).

create or replace function public.fn_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_acao text;
    v_entidade_id uuid;
    v_dados_antes jsonb;
    v_dados_depois jsonb;
    v_usuario_id uuid;
begin
    v_entidade_id := coalesce(new.id, old.id);

    if tg_table_name = 'usuarios' then
        if coalesce(new.auth_user_id, old.auth_user_id) = auth.uid() then
            v_usuario_id := v_entidade_id;
        else
            select u.id into v_usuario_id
            from public.usuarios u
            where u.auth_user_id = auth.uid();
        end if;
    else
        select u.id into v_usuario_id
        from public.usuarios u
        where u.auth_user_id = auth.uid();
    end if;

    if v_usuario_id is null then
        return null;
    end if;

    case tg_table_name
        when 'pacientes' then
            if tg_op = 'INSERT' then
                v_acao := 'paciente.criado';
            elsif tg_op = 'UPDATE' then
                if new.status is distinct from old.status then
                    v_acao := 'paciente.status_alterado';
                else
                    v_acao := 'paciente.alterado';
                end if;
            else
                v_acao := 'paciente.removido';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.pacientes_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.pacientes_audit(new) end;
        when 'usuarios' then
            if tg_op = 'INSERT' then
                v_acao := 'usuario.criado';
            elsif tg_op = 'UPDATE' then
                if new.perfil is distinct from old.perfil then
                    v_acao := 'usuario.perfil_alterado';
                elsif new.status_ativo is distinct from old.status_ativo then
                    v_acao := 'usuario.status_alterado';
                else
                    v_acao := 'usuario.alterado';
                end if;
            else
                v_acao := 'usuario.removido';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.usuarios_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.usuarios_audit(new) end;
        when 'liberacoes' then
            if tg_op = 'INSERT' then
                if new.renovacao_de_id is not null then
                    v_acao := 'liberacao.renovada';
                else
                    v_acao := 'liberacao.criada';
                end if;
            elsif tg_op = 'UPDATE' then
                if new.status = 'cancelada' and old.status <> 'cancelada' then
                    v_acao := 'liberacao.cancelada';
                else
                    v_acao := 'liberacao.alterada';
                end if;
            else
                v_acao := 'liberacao.removida';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.liberacoes_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.liberacoes_audit(new) end;
        when 'retiradas' then
            if tg_op = 'INSERT' then
                v_acao := 'retirada.registrada';
            elsif tg_op = 'UPDATE' then
                v_acao := 'retirada.alterada';
            else
                v_acao := 'retirada.cancelada';
            end if;
            v_dados_antes := case when tg_op = 'INSERT' then null else public.retiradas_audit(old) end;
            v_dados_depois := case when tg_op = 'DELETE' then null else public.retiradas_audit(new) end;
    end case;

    insert into public.auditoria_logs (usuario_id, acao, entidade_tipo, entidade_id, dados_antes, dados_depois, data_hora)
    values (v_usuario_id, v_acao, tg_table_name, v_entidade_id, v_dados_antes, v_dados_depois, now());

    return null;
end;
$$;
