import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RetiradaRepositoryPostgres } from "@/lib/repositories/retirada-repository";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";

type Resultado = { data: unknown; error: unknown };

type Registros = {
  inserts: unknown[];
  calls: { tabela: string; metodos: string[] }[];
};

function chain(resultado: Resultado, registros: Registros, tabela: string) {
  const chamada = registros.calls.find((c) => c.tabela === tabela)!;
  const qb = {
    select: (s: string) => {
      chamada.metodos.push(`select:${s}`);
      return qb;
    },
    eq: () => {
      chamada.metodos.push("eq");
      return qb;
    },
    order: vi.fn(() => {
      chamada.metodos.push("order");
      return qb;
    }),
    insert: (payload: unknown) => {
      registros.inserts.push(payload);
      chamada.metodos.push("insert");
      return qb;
    },
    single: () => qb,
    maybeSingle: () => qb,
    then: (resolve: (v: Resultado) => unknown) =>
      Promise.resolve(resultado).then(resolve),
  };
  return qb;
}

function makeRepo(opts: {
  listResultado?: Resultado;
  buscarResultado?: Resultado;
  insertResultado?: Resultado;
}) {
  const registros: Registros = { inserts: [], calls: [] };
  const from = vi.fn((tabela: string) => {
    registros.calls.push({ tabela, metodos: [] });
    let resultado: Resultado = { data: [], error: null };
    if (tabela === "retiradas" && opts.listResultado) resultado = opts.listResultado;
    if (tabela === "retiradas" && opts.buscarResultado) resultado = opts.buscarResultado;
    if (tabela === "retiradas" && opts.insertResultado) resultado = opts.insertResultado;
    return chain(resultado, registros, tabela);
  });

  const repo = new RetiradaRepositoryPostgres({ from } as unknown as SupabaseClient);
  return { repo, registros, from };
}

function linhaRetirada(sobre?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "r1",
    liberacao_id: "l1",
    paciente_id: "p1",
    recepcionista_id: "u1",
    quantidade: 2,
    data_hora: "2026-01-05T10:30:00.000000+00:00",
    unidade_id: null,
    pacientes: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    liberacoes: {
      id: "l1",
      tipo: TIPOS_LIBERACAO.CONTINUA,
      quantidade: 4,
      data_inicio: "2026-01-01T00:00:00.000Z",
      data_fim: "2026-04-01T00:00:00.000Z",
    },
    usuarios: { id: "u1", nome: "João Recep" },
    ...sobre,
  };
}

describe("RetiradaRepositoryPostgres", () => {
  it("listar embute paciente, liberação e usuário (nunca CPF)", async () => {
    const { repo, registros, from } = makeRepo({
      listResultado: { data: [linhaRetirada()], error: null },
    });

    const lista = await repo.listar();

    expect(from).toHaveBeenCalledWith("retiradas");
    const selecao = registros.calls[0].metodos[0];
    expect(selecao).toContain("pacientes(id, gestor_sus, nome)");
    expect(selecao).toContain("liberacoes(id, tipo, quantidade, data_inicio, data_fim)");
    expect(selecao).toContain("usuarios(id, nome)");
    expect(selecao).not.toContain("cpf");
    expect(lista[0]).toMatchObject({
      id: "r1",
      quantidade: 2,
      paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
      liberacao: {
        id: "l1",
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 4,
      },
      recepcionista: { id: "u1", nome: "João Recep" },
    });
  });

  it("listar ordena por data_hora decrescente", async () => {
    const { repo, from } = makeRepo({
      listResultado: { data: [linhaRetirada()], error: null },
    });

    await repo.listar();

    const ordem = from.mock.results[0].value.order;
    expect(ordem).toHaveBeenCalledWith("data_hora", { ascending: false });
  });

  it("listar tolera embeds ocultos por RLS (liberação não visível) como null", async () => {
    const { repo } = makeRepo({
      listResultado: {
        data: [linhaRetirada({ liberacoes: null, usuarios: null })],
        error: null,
      },
    });

    const lista = await repo.listar();

    expect(lista[0].liberacao).toBeNull();
    expect(lista[0].recepcionista).toBeNull();
    expect(lista[0].paciente?.nome).toBe("Maria da Silva");
  });

  it("buscarPorId consulta retiradas por id e embute as FKs", async () => {
    const { repo, from } = makeRepo({
      buscarResultado: { data: linhaRetirada(), error: null },
    });

    const ret = await repo.buscarPorId("r1");

    expect(from).toHaveBeenCalledWith("retiradas");
    expect(ret?.id).toBe("r1");
    expect(ret?.paciente?.nome).toBe("Maria da Silva");
    expect(ret?.liberacao?.tipo).toBe(TIPOS_LIBERACAO.CONTINUA);
  });

  it("criar envia somente os dados do negócio (sem recepcionista_id nem data_hora)", async () => {
    const { repo, registros } = makeRepo({
      insertResultado: { data: linhaRetirada(), error: null },
    });

    await repo.criar({
      liberacaoId: "l1",
      pacienteId: "p1",
      quantidade: 2,
    });

    const payload = registros.inserts[0] as Record<string, unknown>;
    expect(payload.liberacao_id).toBe("l1");
    expect(payload.paciente_id).toBe("p1");
    expect(payload.quantidade).toBe(2);
    expect(payload).not.toHaveProperty("recepcionista_id");
    expect(payload).not.toHaveProperty("data_hora");
  });

  it("propaga AppError mapeado quando o banco nega acesso", async () => {
    const { repo } = makeRepo({
      listResultado: {
        data: null,
        error: { message: "permission denied for table retiradas", code: "42501" },
      },
    });

    await expect(repo.listar()).rejects.toMatchObject({ code: "ACESSO_NEGADO" });
  });
});