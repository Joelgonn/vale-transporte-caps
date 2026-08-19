import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RelatorioRepositoryPostgres } from "@/lib/repositories/relatorio-repository";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type { FiltrosRelatorio } from "@/lib/domain/relatorios/types";

type Resultado = { data: unknown; error: unknown };
type Registros = { calls: { tabela: string; metodos: string[] }[] };

function chain(resultado: Resultado, registros: Registros) {
  const chamada = registros.calls[registros.calls.length - 1];
  const qb = {
    select: (s: string) => {
      chamada.metodos.push(`select:${s}`);
      return qb;
    },
    eq: (coluna: string, valor: unknown) => {
      chamada.metodos.push(`eq:${coluna}=${valor}`);
      return qb;
    },
    gte: (coluna: string, valor: unknown) => {
      chamada.metodos.push(`gte:${coluna}=${valor}`);
      return qb;
    },
    lte: (coluna: string, valor: unknown) => {
      chamada.metodos.push(`lte:${coluna}=${valor}`);
      return qb;
    },
    in: (coluna: string, valores: unknown[]) => {
      chamada.metodos.push(`in:${coluna}=${valores.join(",")}`);
      return qb;
    },
    or: (expressao: string) => {
      chamada.metodos.push(`or:${expressao}`);
      return qb;
    },
    limit: (n: number) => {
      chamada.metodos.push(`limit:${n}`);
      return qb;
    },
    order: (coluna: string, opts: unknown) => {
      chamada.metodos.push(`order:${coluna}`);
      void opts;
      return qb;
    },
    range: (a: number, b: number) => {
      chamada.metodos.push(`range:${a}-${b}`);
      return qb;
    },
    is: (coluna: string, valor: unknown) => {
      chamada.metodos.push(`is:${coluna}=${valor}`);
      return qb;
    },
    not: (coluna: string, valor: unknown) => {
      chamada.metodos.push(`not:${coluna}=${valor}`);
      return qb;
    },
    maybeSingle: () => Promise.resolve(resultado),
    then: (resolve: (v: Resultado) => unknown) =>
      Promise.resolve(resultado).then(resolve),
  };
  return qb;
}

function makeRepo(opts: {
  liberacoesResultado?: Resultado;
  retiradasResultado?: Resultado;
  pacientesResultado?: Resultado;
  vPacientesResultado?: Resultado;
}) {
  const registros: Registros = { calls: [] };
  const from = vi.fn((tabela: string) => {
    registros.calls.push({ tabela, metodos: [] });
    const resultado: Resultado =
      tabela === "liberacoes" && opts.liberacoesResultado
        ? opts.liberacoesResultado
        : tabela === "retiradas" && opts.retiradasResultado
          ? opts.retiradasResultado
          : tabela === "v_pacientes"
            ? (opts.vPacientesResultado ?? opts.pacientesResultado ?? { data: [], error: null })
            : { data: [], error: null };
    return chain(resultado, registros);
  });

  const repo = new RelatorioRepositoryPostgres({ from } as unknown as SupabaseClient);
  return { repo, registros, from };
}

function linhaLiberacao(sobre?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "l1",
    paciente_id: "p1",
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade: 4,
    periodo_meses: 3,
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-04-01T00:00:00.000Z",
    status: "ativa",
    profissional_autorizador_id: "u1",
    pacientes: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    autorizador: { id: "u1", nome: "Dr. João" },
    retiradas: [{ quantidade: 2 }, { quantidade: 1 }],
    ...sobre,
  };
}

function linhaRetirada(sobre?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "r1",
    data_hora: "2026-01-05T10:30:00.000000+00:00",
    paciente_id: "p1",
    liberacao_id: "l1",
    recepcionista_id: "u2",
    quantidade: 2,
    pacientes: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    liberacoes: { id: "l1", tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 1 },
    recepcionista: { id: "u2", nome: "Joana Recep" },
    ...sobre,
  };
}

const filtrosBase: FiltrosRelatorio = { tipo: "liberacoes", pagina: 1 };

describe("RelatorioRepositoryPostgres", () => {
  it("listarLiberacoes embute paciente, autorizador e retiradas (nunca CPF) e pagina no banco", async () => {
    const { repo, registros } = makeRepo({
      liberacoesResultado: { data: [linhaLiberacao()], error: null },
    });

    const resultado = await repo.listarLiberacoes(filtrosBase);

    const chamada = registros.calls.find((c) => c.tabela === "liberacoes")!;
    const select = chamada.metodos.find((m) => m.startsWith("select:"))!;
    expect(select).toContain("pacientes(id, gestor_sus, nome)");
    expect(select).toContain("autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey");
    expect(select).toContain("retiradas(quantidade)");
    expect(select).not.toContain("cpf");
    expect(chamada.metodos).toContain("order:data_inicio");
    expect(chamada.metodos).toContain("range:0-19");

    expect(resultado.tipo).toBe("liberacoes");
    if (resultado.tipo !== "liberacoes") return;
    expect(resultado.linhas[0].totalRetirado).toBe(3);
    expect(resultado.linhas[0].autorizador?.nome).toBe("Dr. João");
  });

  it("listarLiberacoes aplica filtros de período e tipo no PostgREST", async () => {
    const { repo, registros } = makeRepo({ liberacoesResultado: { data: [], error: null } });

    await repo.listarLiberacoes({
      ...filtrosBase,
      de: "2026-01-01",
      ate: "2026-01-31",
      tipoLiberacao: TIPOS_LIBERACAO.AVULSA,
    });

    const chamada = registros.calls.find((c) => c.tabela === "liberacoes")!;
    expect(chamada.metodos).toContain("gte:data_inicio=2026-01-01");
    expect(chamada.metodos).toContain("lte:data_inicio=2026-01-31T23:59:59.999");
    expect(chamada.metodos).toContain(`eq:tipo=${TIPOS_LIBERACAO.AVULSA}`);
  });

  it("busca por paciente resolve ids via v_pacientes e filtra por paciente_id", async () => {
    const { repo, registros } = makeRepo({
      pacientesResultado: { data: [{ id: "p1" }, { id: "p2" }], error: null },
      liberacoesResultado: { data: [], error: null },
    });

    await repo.listarLiberacoes({ ...filtrosBase, busca: "Maria" });

    const chamadaPacientes = registros.calls.find((c) => c.tabela === "v_pacientes")!;
    expect(chamadaPacientes.metodos).toContain("or:nome.ilike.%Maria%,gestor_sus.ilike.%Maria%");
    const chamadaLiberacoes = registros.calls.find((c) => c.tabela === "liberacoes")!;
    expect(chamadaLiberacoes.metodos).toContain("in:paciente_id=p1,p2");
  });

  it("busca sem correspondência retorna vazio sem consultar a tabela principal", async () => {
    const { repo, registros } = makeRepo({
      pacientesResultado: { data: [], error: null },
      liberacoesResultado: { data: [], error: null },
    });

    const resultado = await repo.listarLiberacoes({ ...filtrosBase, busca: "ninguém" });

    expect(registros.calls.some((c) => c.tabela === "liberacoes")).toBe(false);
    expect(resultado.total).toBe(0);
    if (resultado.tipo !== "liberacoes") return;
    expect(resultado.linhas).toEqual([]);
  });

  it("listarRetiradas embute recepcionista via FK e pagina por data_hora", async () => {
    const { repo, registros } = makeRepo({
      retiradasResultado: { data: [linhaRetirada()], error: null },
    });

    const resultado = await repo.listarRetiradas({
      tipo: "retiradas",
      de: "2026-01-01",
      pagina: 2,
    });

    const chamada = registros.calls.find((c) => c.tabela === "retiradas")!;
    const select = chamada.metodos.find((m) => m.startsWith("select:"))!;
    expect(select).toContain("recepcionista:usuarios!retiradas_recepcionista_id_fkey");
    expect(chamada.metodos).toContain("gte:data_hora=2026-01-01");
    expect(chamada.metodos).toContain("order:data_hora");
    expect(chamada.metodos).toContain("range:20-39");

    expect(resultado.tipo).toBe("retiradas");
    if (resultado.tipo !== "retiradas") return;
    expect(resultado.linhas[0].recepcionista?.nome).toBe("Joana Recep");
    expect(resultado.linhas[0].liberacao?.quantidade).toBe(1);
  });

  it("listarConsolidado deriva saldo por liberação e aplica filtros", async () => {
    const { repo } = makeRepo({
      liberacoesResultado: {
        data: [linhaLiberacao(), linhaLiberacao({ id: "l2", quantidade: 1, retiradas: [{ quantidade: 3 }] })],
        error: null,
      },
    });

    const resultado = await repo.listarConsolidado({ ...filtrosBase, tipo: "consolidado" });

    expect(resultado.tipo).toBe("consolidado");
    if (resultado.tipo !== "consolidado") return;
    expect(resultado.linhas[0].quantidadeRetirada).toBe(3);
    expect(resultado.linhas[0].saldo).toBe(1);
    expect(resultado.linhas[1].saldo).toBe(-2);
  });
});

////// Tests for listarHistorico /////

function historicoLinhaBruta(sobre?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "l1",
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-04-01T00:00:00.000Z",
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade: 4,
    periodo_meses: 3,
    status: "ativa",
    renovacao_de_id: null,
    autorizador: { id: "u1", nome: "Dr. João" },
    registrador: { id: "u2", nome: "Joana Recep" },
    retiradas: [{ quantidade: 2 }, { quantidade: 1 }],
    origem: { id: "l0", data_inicio: "2025-01-01T00:00:00.000Z", tipo: TIPOS_LIBERACAO.AVULSA, quantidade: 1 },
    ...sobre,
  };
}

function vPacienteResultado(): Resultado {
  return { data: [{ id: "p1", gestor_sus: "0000000001", nome: "Paciente Teste" }], error: null };
}

describe("listarHistorico", () => {
  it("lista histórico com embeds de autorizador, registrador, retiradas e origem via FK", async () => {
    const { repo, registros } = makeRepo({
      liberacoesResultado: { data: [historicoLinhaBruta()], error: null },
      vPacientesResultado: vPacienteResultado(),
    });

    const resultado = await repo.listarHistorico({
      tipo: "historico",
      paciente: "p1",
      pagina: 1,
    });

    const chamada = registros.calls.find((c) => c.tabela === "liberacoes")!;
    const select = chamada.metodos.find((m) => m.startsWith("select:"))!;
    expect(select).toContain("autorizador:usuarios!liberacoes_profissional_autorizador_id_fkey");
    expect(select).toContain("registrador:usuarios!liberacoes_registrado_por_id_fkey");
    expect(select).toContain("retiradas(data_hora, quantidade)");
    expect(select).toContain("origem:liberacoes!liberacoes_renovacao_de_id_fkey");
    expect(chamada.metodos).toContain("order:data_inicio");
    expect(chamada.metodos).toContain("range:0-19");

    expect(resultado.tipo).toBe("historico");
    if (resultado.tipo !== "historico") return;
    expect(resultado.linhas[0].id).toBe("l1");
    expect(resultado.linhas[0].autorizador?.nome).toBe("Dr. João");
    expect(resultado.linhas[0].registrador?.nome).toBe("Joana Recep");
    expect(resultado.linhas[0].quantidade).toBe(4);
    expect(resultado.linhas[0].quantidadeRetirada).toBe(3);
    expect(resultado.linhas[0].origem?.id).toBe("l0");
  });

  it("busca por paciente via v_pacientes e filtra por paciente_id", async () => {
    const { repo } = makeRepo({
      liberacoesResultado: { data: [], error: null },
      vPacientesResultado: vPacienteResultado(),
    });

    const resultado = await repo.listarHistorico({
      ...filtrosBase, paciente: "p1" });

    expect(resultado.linhas).toEqual([]);
  });

  it("paciente não encontrado retorna vazio sem consultar liberacoes", async () => {
    const { repo, registros } = makeRepo({
      liberacoesResultado: { data: [], error: null },
      vPacientesResultado: { data: null, error: null },
    });

    const resultado = await repo.listarHistorico({
      ...filtrosBase, paciente: "patient-nonexistent" });

    expect(registros.calls.some((c) => c.tabela === "liberacoes")).toBe(false);
    expect(resultado.total).toBe(0);
    if (resultado.tipo !== "historico") return;
    expect(resultado.linhas).toEqual([]);
    expect(resultado.paciente).toBeNull();
  });

  it("listarHistorico aplica filtros de período (de/ate) no PostgREST", async () => {
    const { repo, registros } = makeRepo({
      liberacoesResultado: { data: [historicoLinhaBruta()], error: null },
      vPacientesResultado: vPacienteResultado(),
    });

    await repo.listarHistorico({
      ...filtrosBase,
      paciente: "p1",
      de: "2026-01-01",
      ate: "2026-01-31",
    });

    const chamada = registros.calls.find((c) => c.tabela === "liberacoes")!;
    expect(chamada.metodos).toContain("gte:data_inicio=2026-01-01");
    expect(chamada.metodos).toContain("lte:data_inicio=2026-01-31T23:59:59.999");
  });

  it("listarHistorico aplica filtro de status no PostgREST", async () => {
    const { repo, registros } = makeRepo({
      liberacoesResultado: { data: [historicoLinhaBruta()], error: null },
      vPacientesResultado: vPacienteResultado(),
    });

    await repo.listarHistorico({
      ...filtrosBase,
      paciente: "p1",
      status: "ativa",
    });

    const chamada = registros.calls.find((c) => c.tabela === "liberacoes")!;
    expect(chamada.metodos).toContain(`eq:status=ativa`);
  });

  it("listarHistorico aplica filtro de origem (original/renovacao) no PostgREST", async () => {
    const { repo } = makeRepo({
      liberacoesResultado: { data: [historicoLinhaBruta()], error: null },
      vPacientesResultado: vPacienteResultado(),
    });

    const resultadoOriginal = await repo.listarHistorico({
      ...filtrosBase,
      paciente: "p1",
      origem: "original",
    });
    expect(resultadoOriginal.linhas.length).toBeGreaterThan(0);

    const resultadoRenovacao = await repo.listarHistorico({
      ...filtrosBase,
      paciente: "p1",
      origem: "renovacao",
    });
    expect(resultadoRenovacao.linhas.length).toBeGreaterThan(0);
  });

  it("listarHistorico ordena dados por data_inicio de forma crescente", async () => {
    const { repo } = makeRepo({
      liberacoesResultado: {
        data: [historicoLinhaBruta(), historicoLinhaBruta({ data_inicio: "2025-07-01T00:00:00.000Z" })],
        error: null,
      },
      vPacientesResultado: vPacienteResultado(),
    });

    const resultado = await repo.listarHistorico({
      tipo: "historico",
      paciente: "p1",
      pagina: 1,
    });

    if (resultado.tipo !== "historico") return;
    expect(resultado.linhas[0].dataInicio).toBe("2026-01-01T00:00:00.000Z");
    expect(resultado.linhas[1].dataInicio).toBe("2025-07-01T00:00:00.000Z");
  });

  it("listarHistorico sem paciente retorna vazio sem consultar a tabela principal", async () => {
    const { repo, registros } = makeRepo({
      liberacoesResultado: { data: [historicoLinhaBruta()], error: null },
      vPacientesResultado: vPacienteResultado(),
    });

    const resultado = await repo.listarHistorico({
      tipo: "historico", pagina: 1 });

    expect(registros.calls.some((c) => c.tabela === "liberacoes")).toBe(false);
    expect(resultado.total).toBe(0);
    if (resultado.tipo !== "historico") return;
    expect(resultado.linhas).toEqual([]);
  });
});