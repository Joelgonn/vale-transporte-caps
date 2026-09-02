import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LiberacaoRepositoryPostgres } from "@/lib/repositories/liberacao-repository";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";

type Resultado = { data: unknown; error: unknown };

type Registros = {
  selects: string[];
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
    or: vi.fn(() => {
      chamada.metodos.push("or");
      return qb;
    }),
    in: vi.fn(() => {
      chamada.metodos.push("in");
      return qb;
    }),
    ilike: () => qb,
    limit: vi.fn(() => {
      chamada.metodos.push("limit");
      return qb;
    }),
    range: vi.fn(() => {
      chamada.metodos.push("range");
      return qb;
    }),
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
  idsResultado?: Resultado;
  listResultado?: Resultado;
  buscarResultado?: Resultado;
  insertResultado?: Resultado;
}) {
  const registros: Registros = { selects: [], inserts: [], calls: [] };
  const from = vi.fn((tabela: string) => {
    registros.calls.push({ tabela, metodos: [] });
    let resultado: Resultado = { data: [], error: null };
    if (tabela === "v_pacientes" && opts.idsResultado) resultado = opts.idsResultado;
    if (tabela === "liberacoes" && opts.listResultado) resultado = opts.listResultado;
    if (tabela === "liberacoes" && opts.buscarResultado) resultado = opts.buscarResultado;
    if (tabela === "liberacoes" && opts.insertResultado) resultado = opts.insertResultado;
    return chain(resultado, registros, tabela);
  });

  const repo = new LiberacaoRepositoryPostgres({ from } as unknown as SupabaseClient);
  return { repo, registros, from };
}

function linhaLiberacao(sobre?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "l1",
    paciente_id: "p1",
    tipo: TIPOS_LIBERACAO.AVULSA,
    quantidade: 1,
    periodo_meses: null,
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-01-02T00:00:00.000Z",
    profissional_autorizador_id: "u1",
    registrado_por_id: "u1",
    renovacao_de_id: null,
    status: "ativa",
    justificativa: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    pacientes: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    ...sobre,
  };
}

describe("LiberacaoRepositoryPostgres", () => {
  it("listar embute o paciente (id, gestor_sus, nome — nunca CPF)", async () => {
    const { repo, registros, from } = makeRepo({
      listResultado: { data: [linhaLiberacao()], error: null },
    });

    const lista = await repo.listar();

    expect(from).toHaveBeenCalledWith("liberacoes");
    const selecao = registros.calls[0].metodos[0];
    expect(selecao).toContain("pacientes(id, gestor_sus, nome)");
    expect(selecao).not.toContain("cpf");
    expect(lista[0].paciente).toEqual({
      id: "p1",
      gestor_sus: "123456",
      nome: "Maria da Silva",
    });
  });

  it("listar com busca resolve ids via v_pacientes e filtra por paciente_id", async () => {
    const { repo, registros, from } = makeRepo({
      idsResultado: {
        data: [{ id: "p1" }, { id: "p2" }],
        error: null,
      },
      listResultado: { data: [linhaLiberacao()], error: null },
    });

    const lista = await repo.listar("maria");

    // 1ª consulta Sprint 44: v_pacientes com or(ilike) + range (paginação em chunks, sem limit silencioso)
    const idxV = from.mock.calls.findIndex(([t]) => t === "v_pacientes");
    const vChamada = registros.calls.find((c) => c.tabela === "v_pacientes")!;
    expect(vChamada.metodos[0]).toBe("select:id");
    expect(vChamada.metodos).toContain("or");
    expect(vChamada.metodos).toContain("range");
    const { or } = from.mock.results[idxV].value;
    expect(or).toHaveBeenCalledWith("nome.ilike.%maria%,gestor_sus.ilike.%maria%");

    // 2ª consulta: liberacoes com in(paciente_id, ids)
    const idxL = from.mock.calls.findIndex(([t]) => t === "liberacoes");
    const lChamada = registros.calls.find((c) => c.tabela === "liberacoes")!;
    expect(lChamada.metodos).toContain("in");
    const { in: inFn } = from.mock.results[idxL].value;
    expect(inFn).toHaveBeenCalledWith("paciente_id", ["p1", "p2"]);

    expect(lista).toHaveLength(1);
  });

  it("listar com busca sem pacientes correspondentes retorna lista vazia (sem consultar liberacoes)", async () => {
    const { repo, from } = makeRepo({
      idsResultado: { data: [], error: null },
      listResultado: { data: [linhaLiberacao()], error: null },
    });

    const lista = await repo.listar("xyz");

    expect(lista).toEqual([]);
    // A busca consulta v_pacientes, mas sem pacientes correspondentes a
    // segunda consulta de liberacoes (filtrada pelos ids) nunca acontece.
    expect(from.mock.calls.filter(([t]) => t === "liberacoes")).toHaveLength(1);
    expect(from.mock.calls.filter(([t]) => t === "v_pacientes")).toHaveLength(1);
  });

  it("buscarPorId consulta liberacoes por id e embute o paciente", async () => {
    const { repo, from } = makeRepo({
      buscarResultado: { data: linhaLiberacao(), error: null },
    });

    const lib = await repo.buscarPorId("l1");

    expect(from).toHaveBeenCalledWith("liberacoes");
    expect(lib?.id).toBe("l1");
    expect(lib?.paciente?.nome).toBe("Maria da Silva");
  });

  it("criar envia renovacao_de_id e NÃO envia registrado_por_id nem data_fim", async () => {
    const { repo, registros } = makeRepo({
      insertResultado: { data: linhaLiberacao(), error: null },
    });

    await repo.criar({
      pacienteId: "p1",
      profissionalAutorizadorId: "u1",
      tipo: TIPOS_LIBERACAO.CONTINUA,
      quantidade: 4,
      periodoMeses: 3,
      renovacaoDeId: "l-origem",
    });

    const payload = registros.inserts[0] as Record<string, unknown>;
    expect(payload.paciente_id).toBe("p1");
    expect(payload.profissional_autorizador_id).toBe("u1");
    expect(payload.renovacao_de_id).toBe("l-origem");
    expect(payload).not.toHaveProperty("registrado_por_id");
    expect(payload).not.toHaveProperty("data_fim");
  });

  it("propaga AppError mapeado quando o banco nega acesso", async () => {
    const { repo } = makeRepo({
      listResultado: {
        data: null,
        error: { message: "new row violates row-level security policy", code: "42501" },
      },
    });

    await expect(repo.listar()).rejects.toMatchObject({ code: "ACESSO_NEGADO" });
  });
});