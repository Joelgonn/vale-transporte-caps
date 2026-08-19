// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RelatoriosView from "@/app/dashboard/relatorios/components/relatorios-view";
import type {
  FiltrosRelatorio,
  ResultadoListaRelatorio,
} from "@/lib/domain/relatorios/types";

function filtros(sobre?: Partial<FiltrosRelatorio>): FiltrosRelatorio {
  return {
    tipo: "liberacoes",
    de: null,
    ate: null,
    busca: null,
    tipoLiberacao: null,
    pagina: 1,
    ...sobre,
  };
}

function resultadoLiberacoes(sobre?: Partial<Extract<ResultadoListaRelatorio, { tipo: "liberacoes" }>>) {
  return {
    tipo: "liberacoes" as const,
    linhas: [
      {
        id: "l1",
        paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
        tipo: "continua",
        quantidade: 4,
        periodoMeses: 3,
        dataInicio: "2026-01-01T00:00:00.000Z",
        dataFim: "2026-04-01T00:00:00.000Z",
        status: "ativa",
        autorizador: { id: "u1", nome: "Dr. João" },
        totalRetirado: 3,
      },
    ],
    total: 1,
    pagina: 1,
    porPagina: 20,
    ...sobre,
  };
}

function renderizar(opts: {
  filtros?: FiltrosRelatorio;
  resultado?: ResultadoListaRelatorio | null;
  erroInicial?: string | null;
} = {}) {
  return render(
    <RelatoriosView
      filtros={opts.filtros ?? filtros()}
      resultado={opts.resultado ?? resultadoLiberacoes()}
      erroInicial={opts.erroInicial ?? null}
    />
  );
}

describe("RelatoriosView — leitura", () => {
  it("exibe título, descrição e contador de registros", () => {
    renderizar();
    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeInTheDocument();
    expect(screen.getByText("1 registro encontrado.")).toBeInTheDocument();
  });

  it("oferece os três tipos de relatório como abas", () => {
    renderizar();
    const liberacoes = screen.getByRole("link", { name: "Liberações" });
    const retiradas = screen.getByRole("link", { name: "Retiradas" });
    const consolidado = screen.getByRole("link", { name: "Consolidado" });
    expect(liberacoes).toHaveAttribute("aria-current", "page");
    expect(retiradas).not.toHaveAttribute("aria-current");
    expect(consolidado).not.toHaveAttribute("aria-current");
    expect(retiradas.getAttribute("href")).toContain("tipo=retiradas");
    expect(consolidado.getAttribute("href")).toContain("tipo=consolidado");
  });

  it("trocar de tipo preserva os filtros digitados", () => {
    renderizar({
      filtros: filtros({ de: "2026-01-01", ate: "2026-01-31", busca: "Maria", tipo: "liberacoes" }),
    });
    const consolidado = screen.getByRole("link", { name: "Consolidado" });
    const href = consolidado.getAttribute("href") ?? "";
    expect(href).toContain("tipo=consolidado");
    expect(href).toContain("de=2026-01-01");
    expect(href).toContain("ate=2026-01-31");
    expect(href).toContain("busca=Maria");
  });

  it("exibe placeholder quando não há registros", () => {
    renderizar({ resultado: { tipo: "liberacoes", linhas: [], total: 0, pagina: 1, porPagina: 20 } });
    expect(screen.getByText("Nenhum registro encontrado ainda.")).toBeInTheDocument();
  });

  it("com filtros ativos e sem resultado, mensagem contextual", () => {
    renderizar({
      filtros: filtros({ de: "2026-01-01" }),
      resultado: { tipo: "liberacoes", linhas: [], total: 0, pagina: 1, porPagina: 20 },
    });
    expect(screen.getByText("Nenhum registro encontrado para os filtros.")).toBeInTheDocument();
  });

  it("erro inicial é exibido sem tela branca", () => {
    renderizar({ erroInicial: "Não foi possível carregar os relatórios." });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os relatórios."
    );
  });
});

describe("RelatoriosView — tabela de liberações", () => {
  it("lista paciente, tipo, quantidade, período, status, autorizador e total retirado", () => {
    renderizar();
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SUS 123456").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contínua").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("01/01/2026 a 01/04/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ativa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dr. João").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });
});

describe("RelatoriosView — tabela de retiradas", () => {
  it("lista data/hora, paciente, liberação, quantidade e recepcionista", () => {
    renderizar({
      filtros: filtros({ tipo: "retiradas" }),
      resultado: {
        tipo: "retiradas",
        linhas: [
          {
            id: "r1",
            dataHora: "2026-01-05T10:30:00.000000+00:00",
            paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
            liberacao: { id: "l1", tipo: "avulsa", quantidade: 1 },
            quantidade: 2,
            recepcionista: { id: "u2", nome: "Joana Recep" },
          },
        ],
        total: 1,
        pagina: 1,
        porPagina: 20,
      },
    });
    expect(screen.getAllByText("05/01/2026 · 10:30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Avulsa · 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Joana Recep").length).toBeGreaterThan(0);
    expect(screen.queryByText("Período")).toBeNull();
  });

  it("não oferece o filtro de tipo de liberação no relatório de retiradas", () => {
    renderizar({
      filtros: filtros({ tipo: "retiradas" }),
      resultado: { tipo: "retiradas", linhas: [], total: 0, pagina: 1, porPagina: 20 },
    });
    expect(screen.queryByLabelText("Tipo de liberação")).toBeNull();
  });
});

describe("RelatoriosView — consolidado", () => {
  it("lista autorizado, retirado e saldo; saldo negativo destacado", () => {
    renderizar({
      filtros: filtros({ tipo: "consolidado" }),
      resultado: {
        tipo: "consolidado",
        linhas: [
          {
            liberacaoId: "l1",
            paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
            tipo: "avulsa",
            quantidadeAutorizada: 1,
            quantidadeRetirada: 3,
            saldo: -2,
          },
        ],
        total: 1,
        pagina: 1,
        porPagina: 20,
      },
    });
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-2").length).toBeGreaterThan(0);
  });
});

describe("RelatoriosView — paginação", () => {
  it("exibe botões Anterior/Próxima preservando filtros", () => {
    renderizar({
      filtros: filtros({ de: "2026-01-01", pagina: 2 }),
      resultado: { ...resultadoLiberacoes(), total: 60, pagina: 2 },
    });
    const anterior = screen.getByRole("link", { name: "Anterior" });
    expect(anterior.getAttribute("href")).toContain("de=2026-01-01");
    // Página 1 é a página implícita — o construtor de URL a omite.
    expect(anterior.getAttribute("href")).not.toContain("pagina=");
    const proxima = screen.getByRole("link", { name: "Próxima" });
    expect(proxima.getAttribute("href")).toContain("pagina=3");
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("sem paginação quando não há total", () => {
    renderizar({
      resultado: { tipo: "liberacoes", linhas: [], total: 0, pagina: 1, porPagina: 20 },
    });
    expect(screen.queryByRole("link", { name: "Próxima" })).toBeNull();
  });
});

describe("RelatoriosView — filtros", () => {
  it("exibe busca, de e até; e tipo de liberação no relatório de liberações", () => {
    renderizar();
    expect(screen.getByLabelText("Paciente (nome ou Gestor SUS)")).toBeInTheDocument();
    expect(screen.getByLabelText("De")).toBeInTheDocument();
    expect(screen.getByLabelText("Até")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de liberação")).toBeInTheDocument();
  });
});