// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AuditoriaView from "@/app/dashboard/auditoria/components/auditoria-view";
import type { EventoAuditoria, FiltrosAuditoria } from "@/lib/domain/auditoria/types";

function evento(sobre?: Partial<EventoAuditoria>): EventoAuditoria {
  return {
    id: 1,
    acao: "usuario.perfil_alterado",
    entidadeTipo: "usuarios",
    entidadeId: "u7",
    usuarioId: "u7",
    dadosAntes: { perfil: "recepcionista", status_ativo: true, nome: "Maria" },
    dadosDepois: { perfil: "gestor", status_ativo: true, nome: "Maria" },
    dataHora: "2026-08-13T09:31:00+00:00",
    responsavel: { id: "u1", nome: "João Recep" },
    ...sobre,
  };
}

function filtros(sobre?: Partial<FiltrosAuditoria>): FiltrosAuditoria {
  return { acao: null, entidadeTipo: null, dataDe: null, dataAte: null, usuarioId: null, pagina: 1, ...sobre };
}

function renderizar(opts: {
  filtros?: FiltrosAuditoria;
  eventos?: EventoAuditoria[];
  total?: number;
  porPagina?: number;
  erroInicial?: string | null;
  responsaveis?: { id: string; nome: string }[];
} = {}) {
  return render(
    <AuditoriaView
      filtros={opts.filtros ?? filtros()}
      eventos={opts.eventos ?? [evento()]}
      total={opts.total ?? 1}
      porPagina={opts.porPagina ?? 20}
      erroInicial={opts.erroInicial ?? null}
      responsaveis={opts.responsaveis ?? [{ id: "u1", nome: "João Recep" }]}
    />
  );
}

describe("AuditoriaView — leitura", () => {
  it("exibe título, descrição e contador de eventos", () => {
    renderizar();
    expect(screen.getByRole("heading", { name: "Auditoria" })).toBeInTheDocument();
    expect(screen.getByText("1 evento encontrado.")).toBeInTheDocument();
  });

  it("lista ações rotuladas, entidade, data/hora e responsável", () => {
    renderizar();
    expect(screen.getAllByText("Perfil de usuário alterado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Usuário").length).toBeGreaterThan(0);
    expect(screen.getAllByText("13/08/2026 · 09:31").length).toBeGreaterThan(0);
    expect(screen.getAllByText("João Recep").length).toBeGreaterThan(0);
  });

  it("exibe placeholder de tabela quando não há eventos", () => {
    renderizar({ eventos: [], total: 0, filtros: filtros({ pagina: 1 }) });
    expect(screen.getByText("Nenhum evento de auditoria registrado ainda.")).toBeInTheDocument();
  });

  it("com filtros ativos e sem resultado, mensagem contextual", () => {
    renderizar({ eventos: [], total: 0, filtros: filtros({ acao: "retirada.registrada" }) });
    expect(screen.getByText("Nenhum evento encontrado para os filtros.")).toBeInTheDocument();
  });

  it("erro inicial é exibido sem tela branca", () => {
    renderizar({ erroInicial: "Não foi possível carregar a auditoria." });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a auditoria."
    );
  });
});

describe("AuditoriaView — filtros", () => {
  it("oferece os filtros de ação, entidade e responsável como GET", () => {
    renderizar();

    expect(screen.getByLabelText("Ação")).toBeInTheDocument();
    expect(screen.getByLabelText("Entidade")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsável")).toBeInTheDocument();
    expect(screen.getByLabelText("De")).toBeInTheDocument();
    expect(screen.getByLabelText("Até")).toBeInTheDocument();

    const form = screen.getByRole("form", { name: "Filtros de auditoria" });
    expect(form).toHaveAttribute("method", "get");
  });

  it("link Limpar aponta para a auditoria sem filtros", () => {
    renderizar();
    expect(screen.getByRole("link", { name: "Limpar" })).toHaveAttribute(
      "href",
      "/dashboard/auditoria"
    );
  });
});

describe("AuditoriaView — paginação", () => {
  it("mostra links de paginação preservando a página e escondendo quando única", () => {
    const comFiltro = filtros({ acao: "retirada.registrada", pagina: 2 });
    renderizar({
      filtros: comFiltro,
      total: 21,
      porPagina: 20,
      eventos: [evento()],
    });

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/dashboard/auditoria?acao=retirada.registrada"
    );
    expect(screen.queryByRole("link", { name: "Próxima" })).toBeNull();
  });

  it("na primeira página mostra Próxima apontando para a página 2", () => {
    renderizar({ total: 21, porPagina: 20 });
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/dashboard/auditoria?pagina=2"
    );
    expect(screen.queryByRole("link", { name: "Anterior" })).toBeNull();
  });
});

describe("AuditoriaView — detalhes do evento", () => {
  it("abre o diálogo com dados Antes/Depois rotulados e formata os valores", () => {
    renderizar();

    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(within(dialog).getAllByText("Perfil de usuário alterado").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Perfil")).toBeInTheDocument();
    expect(within(dialog).getByText("Recepcionista")).toBeInTheDocument();
    expect(within(dialog).getByText("Gestor")).toBeInTheDocument();
    expect(within(dialog).getByText("João Recep")).toBeInTheDocument();
  });

  it("CPF jamais aparece nos detalhes (defesa em profundidade)", () => {
    renderizar({
      eventos: [
        evento({
          dadosAntes: { cpf: "123.456.789-00", nome: "Maria" },
          dadosDepois: { cpf: "123.456.789-00", nome: "Maria" },
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/123\.456\.789-00/)).toBeNull();
    expect(within(dialog).queryByText(/cpf/i)).toBeNull();
  });

  it("evento sem dados mostra aviso em vez de tabela vazia", () => {
    renderizar({ eventos: [evento({ dadosAntes: null, dadosDepois: null })] });

    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(screen.getByText("Nenhum dado detalhado registrado para este evento.")).toBeInTheDocument();
  });

  it("fecha por Escape", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
