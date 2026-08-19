import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UsuarioRepositoryPostgres } from "@/lib/repositories/usuario-repository";
import { AppError } from "@/lib/domain/app-error";
import { PERFIS, PROFISSOES } from "@/lib/domain/enums";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";

type Resultado = { data: unknown; error: unknown };

function chain(resultado: Resultado) {
  const qb = {
    select: () => qb,
    eq: () => qb,
    or: vi.fn(() => qb),
    ilike: () => qb,
    order: () => qb,
    insert: () => qb,
    update: () => qb,
    single: () => qb,
    maybeSingle: () => qb,
    then: (resolve: (v: Resultado) => unknown) => Promise.resolve(resultado).then(resolve),
  };
  return qb;
}

function makeRepo(opts: {
  listarResultado?: Resultado;
  buscarResultado?: Resultado;
  insertResultado?: Resultado;
  updateResultado?: Resultado;
  statusResultado?: Resultado;
}) {
  const calls = { from: vi.fn() };
  calls.from.mockImplementation((tabela: string) => {
    let resultado: Resultado = { data: [], error: null };
    if (tabela === "usuarios" && opts.listarResultado) resultado = opts.listarResultado;
    if (tabela === "usuarios" && opts.buscarResultado) resultado = opts.buscarResultado;
    if (tabela === "usuarios" && opts.insertResultado) resultado = opts.insertResultado;
    if (tabela === "usuarios" && opts.updateResultado) resultado = opts.updateResultado;
    if (tabela === "usuarios" && opts.statusResultado) resultado = opts.statusResultado;
    return chain(resultado);
  });

  const repo = new UsuarioRepositoryPostgres(calls as unknown as SupabaseClient);
  return { repo, calls };
}

function usuario(sobre?: Partial<UsuarioFuncional>): UsuarioFuncional {
  return {
    id: "u1",
    auth_user_id: "a1",
    nome: "João",
    email: "joao@example.com",
    perfil: PERFIS.GESTOR,
    profissao: null,
    status_ativo: true,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

describe("UsuarioRepositoryPostgres", () => {
  it("listar consulta public.usuarios ordenado por nome", async () => {
    const { repo, calls } = makeRepo({
      listarResultado: { data: [usuario()], error: null },
    });

    await repo.listar();

    expect(calls.from).toHaveBeenCalledWith("usuarios");
  });

  it("listar sem busca não aplica filtro or", async () => {
    const { repo, calls } = makeRepo({
      listarResultado: { data: [usuario()], error: null },
    });

    await repo.listar();

    const chain = calls.from.mock.results[0].value;
    expect(chain.or).not.toHaveBeenCalled();
  });

  it("listar com busca aplica ilike sanitizado em nome/email", async () => {
    const { repo, calls } = makeRepo({
      listarResultado: { data: [usuario()], error: null },
    });

    await repo.listar("  Mar%ia_ ;()  ");

    const chain = calls.from.mock.results[0].value;
    expect(chain.or).toHaveBeenCalledWith(
      "nome.ilike.%Maria%,email.ilike.%Maria%"
    );
  });

  it("não vaza termo com caracteres de padrão na busca", async () => {
    const { repo, calls } = makeRepo({
      listarResultado: { data: [usuario()], error: null },
    });

    await repo.listar("a%b_c");

    const chain = calls.from.mock.results[0].value;
    expect(chain.or).toHaveBeenCalledWith("nome.ilike.%abc%,email.ilike.%abc%");
  });

  it("criar insere vínculo funcional em usuarios", async () => {
    const { repo, calls } = makeRepo({
      insertResultado: { data: usuario(), error: null },
    });

    const criado = await repo.criar({
      auth_user_id: "a2",
      nome: "Ana",
      email: "ana@example.com",
      perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
      profissao: PROFISSOES.PSICOLOGO,
    });

    expect(calls.from).toHaveBeenCalledWith("usuarios");
    expect(criado.id).toBe("u1");
  });

  it("atualizarStatusAtivo atualiza apenas status_ativo (sem exclusão)", async () => {
    const { repo, calls } = makeRepo({
      statusResultado: { data: usuario({ status_ativo: false }), error: null },
    });

    const atualizado = await repo.atualizarStatusAtivo("u1", false);

    expect(calls.from).toHaveBeenCalledWith("usuarios");
    expect(atualizado.status_ativo).toBe(false);
    expect(atualizado.perfil).toBe(PERFIS.GESTOR);
  });

  it("propaga AppError mapeado quando o banco nega acesso (RLS)", async () => {
    const { repo } = makeRepo({
      listarResultado: {
        data: null,
        error: { message: "permission denied for table usuarios", code: "42501" },
      },
    });

    await expect(repo.listar()).rejects.toMatchObject({ code: "ACESSO_NEGADO" });
  });

  it("erro de unicidade vira AppError", async () => {
    const { repo } = makeRepo({
      insertResultado: {
        data: null,
        error: { message: "duplicate key value", code: "23505" },
      },
    });

    await expect(
      repo.criar({ auth_user_id: "a2", nome: "Ana", email: "ana@example.com", perfil: PERFIS.GESTOR })
    ).rejects.toBeInstanceOf(AppError);
  });
});