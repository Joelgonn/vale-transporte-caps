// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Landing from "@/components/landing/landing";

describe("Landing", () => {
  it("renderiza a marca e o título principal", () => {
    render(<Landing />);
    const marcas = screen.getAllByText("Vale Transporte CAPS");
    expect(marcas.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Vale Transporte CAPS" }),
    ).toBeDefined();
  });

  it("oferece o CTA 'Entrar no sistema' apontando para /login (header, hero e seção final)", () => {
    render(<Landing />);
    const ctas = screen.getAllByRole("link", { name: "Entrar no sistema" });
    expect(ctas.length).toBeGreaterThanOrEqual(3);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/login");
    }
  });

  it("navegação mobile: abre menu acessível com âncoras e CTA de login", async () => {
    const user = userEvent.setup();
    render(<Landing />);

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Menu de navegação",
    });
    expect(within(dialogo).getByRole("link", { name: "O que organiza" })).toHaveAttribute(
      "href",
      "#organiza",
    );
    expect(within(dialogo).getByRole("link", { name: "Fluxo" })).toHaveAttribute(
      "href",
      "#fluxo",
    );
    expect(within(dialogo).getByRole("link", { name: "Entrar no sistema" })).toHaveAttribute(
      "href",
      "/login",
    );

    await user.click(
      within(dialogo).getByRole("button", { name: "Fechar menu" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("não abre o menu mobile sem interação", () => {
    render(<Landing />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("apresenta as seções institucionais", () => {
    render(<Landing />);
    const secoes = [
      "O que o sistema organiza",
      "Controle e segurança",
      "Como o benefício flui",
      "Continue o acompanhamento",
    ];
    for (const secao of secoes) {
      expect(screen.getByRole("heading", { level: 2, name: secao })).toBeDefined();
    }
  });

  it("apresenta os módulos do sistema com os cinco pilares", () => {
    render(<Landing />);
    const secao = screen.getByRole("heading", {
      level: 2,
      name: "O que o sistema organiza",
    }).parentElement;
    expect(secao).not.toBeNull();
    for (const pilares of ["Pacientes", "Liberações", "Retiradas", "Usuários", "Auditoria"]) {
      const textos = screen.getAllByText(pilares);
      expect(textos.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("descreve o fluxo paciente → liberação → retirada", () => {
    render(<Landing />);
    expect(screen.getByText("Paciente")).toBeDefined();
    expect(screen.getByText("Liberação")).toBeDefined();
    expect(screen.getByText("Retirada")).toBeDefined();
  });

  it("não expõe informações sensíveis nem dados de conexão", () => {
    render(<Landing />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/SERVICE_ROLE|auth\.users|\.env|postgres|supabase\.co/i);
  });

  it("não sugere cadastro público nem ações fora do fluxo institucional", () => {
    render(<Landing />);
    expect(screen.queryByText(/criar conta/i)).toBeNull();
    expect(screen.queryByText(/começar agora/i)).toBeNull();
    expect(screen.queryByText(/download/i)).toBeNull();
  });

  it("usa navegação semântica (links âncora restritos às seções da página)", () => {
    render(<Landing />);
    const nav = screen.getByRole("navigation", { name: /navegação da página/i });
    expect(within(nav).getByRole("link", { name: "O que organiza" })).toHaveAttribute(
      "href",
      "#organiza",
    );
    expect(within(nav).getByRole("link", { name: "Fluxo" })).toHaveAttribute("href", "#fluxo");
  });
});