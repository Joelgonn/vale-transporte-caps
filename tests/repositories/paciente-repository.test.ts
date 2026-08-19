import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PacienteRepositoryPostgres } from "@/lib/repositories/paciente-repository";
import { AppError } from "@/lib/domain/app-error";

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
  cpfResultado?: Resultado;
  insertResultado?: Resultado;
  updateResultado?: Resultado;
}) {
  const calls = { from: vi.fn(), rpc: vi.fn() };

  calls.from.mockImplementation((tabela: string) => {
    let resultado: Resultado = { data: [], error: null };
    if (tabela === "v_pacientes" && opts.listarResultado) resultado = opts.listarResultado;
    if (tabela === "v_pacientes" && opts.buscarResultado) resultado = opts.buscarResultado;
    if (tabela === "pacientes" && opts.insertResultado) resultado = opts.insertResultado;
    if (tabela === "pacientes" && opts.updateResultado) resultado = opts.updateResultado;
    return chain(resultado);
  });
  calls.rpc.mockReturnValue(chain(opts.cpfResultado ?? { data: [], error: null }));

  const repo = new PacienteRepositoryPostgres(calls as unknown as SupabaseClient);
  return { repo, calls };
}

describe("PacienteRepositoryPostgres", () => {
  it("listar consulta v_pacientes (sem coluna cpf)", async () => {
    const { repo, calls } = makeRepo({
      listarResultado: { data: [{ id: "p1" }], error: null },
    });

    await repo.listar();

    expect(calls.from).toHaveBeenCalledWith("v_pacientes");
    const selecao = calls.from.mock.calls[0];
    expect(selecao).toBeTruthy();
  });

  it("listar com busca aplica filtro ilike em nome/gestor_sus e limpa o termo", async () => {
    const { repo, calls } = makeRepo({
      listarResultado: { data: [{ id: "p1" }], error: null },
    });

    await repo.listar("  mar%ia_ ;()  ");

    expect(calls.from).toHaveBeenCalledWith("v_pacientes");
    const { or } = calls.from.mock.results[0].value;
    expect(or).toHaveBeenCalledWith("nome.ilike.%maria%,gestor_sus.ilike.%maria%");
  });

  it("buscarCpf usa RPC pacientes_com_cpf e não from('pacientes')", async () => {
    const { repo, calls } = makeRepo({
      cpfResultado: { data: { id: "p1", cpf: "12345678900" }, error: null },
    });

    const resultado = await repo.buscarCpf("p1");

    expect(calls.rpc).toHaveBeenCalledWith("pacientes_com_cpf");
    expect(calls.from).not.toHaveBeenCalled();
    expect(resultado?.cpf).toBe("12345678900");
  });

  it("buscarCpf retorna null quando não há linha (ex.: perfil não gestor)", async () => {
    const { repo } = makeRepo({ cpfResultado: { data: null, error: null } });

    expect(await repo.buscarCpf("p1")).toBeNull();
  });

  it("criar insere em pacientes", async () => {
    const { repo, calls } = makeRepo({
      insertResultado: { data: { id: "p1", gestor_sus: "123", nome: "Ana" }, error: null },
    });

    const criado = await repo.criar({ gestor_sus: "123", nome: "Ana" });

    expect(calls.from).toHaveBeenCalledWith("pacientes");
    expect(criado.id).toBe("p1");
  });

  it("propaga AppError mapeado quando o banco nega acesso", async () => {
    const { repo } = makeRepo({
      listarResultado: {
        data: null,
        error: { message: "permission denied for view v_pacientes", code: "42501" },
      },
    });

    await expect(repo.listar()).rejects.toMatchObject({ code: "ACESSO_NEGADO" });
  });

  it("erro de trigger de domínio vira AppError", async () => {
    const { repo } = makeRepo({
      insertResultado: {
        data: null,
        error: { message: "Paciente sem direito ativo (RN01)", code: "P0001" },
      },
    });

    await expect(repo.criar({ gestor_sus: "1", nome: "X" })).rejects.toBeInstanceOf(AppError);
  });
});
