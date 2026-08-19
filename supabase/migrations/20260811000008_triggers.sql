create trigger trg_pacientes_updated_at
    before update on public.pacientes
    for each row execute function public.fn_set_updated_at();

create trigger trg_usuarios_updated_at
    before update on public.usuarios
    for each row execute function public.fn_set_updated_at();

create trigger trg_liberacoes_updated_at
    before update on public.liberacoes
    for each row execute function public.fn_set_updated_at();

create trigger trg_liberacoes_before
    before insert or update on public.liberacoes
    for each row execute function public.fn_liberacoes_before();

create trigger trg_retiradas_before
    before insert or update on public.retiradas
    for each row execute function public.fn_retiradas_before();

create trigger trg_pacientes_audit
    after insert or update or delete on public.pacientes
    for each row execute function public.fn_auditoria();

create trigger trg_usuarios_audit
    after insert or update or delete on public.usuarios
    for each row execute function public.fn_auditoria();

create trigger trg_liberacoes_audit
    after insert or update or delete on public.liberacoes
    for each row execute function public.fn_auditoria();

create trigger trg_retiradas_audit
    after insert or update or delete on public.retiradas
    for each row execute function public.fn_auditoria();

create trigger trg_auditoria_imutavel
    before update or delete on public.auditoria_logs
    for each row execute function public.fn_auditoria_imutavel();
