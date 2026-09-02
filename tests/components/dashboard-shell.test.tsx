// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { PERFIS } from "@/lib/domain/enums";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    pathname: "/dashboard",
    logout: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/app/actions/auth", () => ({
  login: vi.fn(),
  logout: (...args: unknown[]) => mocks.logout(...args),
}));

const user = userEvent.setup();

function renderizarShell(sobre: {
  perfil?: (typeof PERFIS)[keyof typeof PERFIS] | null;
  statusAtivo?: boolean | null;
} = {}) {
  return render(
    <DashboardShell
      email="gestor@caps.local"
      perfil={sobre.perfil ?? PERFIS.GESTOR}
      statusAtivo={sobre.statusAtivo ?? true}
    >
      <p>conteúdo real da página</p>
    </DashboardShell>
  );
}

beforeEach(() => {
  mocks.pathname = "/dashboard";
  mocks.logout.mockReset();
  mocks.logout.mockImplementation(async () => {});
});

describe("DashboardShell", () => {
  it("renderiza identidade, conteúdo e navegação do Gestor", () => {
    renderizarShell();
    expect(screen.getByRole("link", { name: "Vale Transporte CAPS" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo real da página")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "href",
      "/dashboard/pacientes"
    );
    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute(
      "href",
      "/dashboard/usuarios"
    );
  });

  it("mantém o módulo ativo com aria-current (além da cor)", () => {
    mocks.pathname = "/dashboard/pacientes";
    renderizarShell();
    const pacientes = screen.getByRole("link", { name: "Pacientes" });
    expect(pacientes).toHaveAttribute("aria-current", "page");
    for (const dashboard of screen.getAllByRole("link", { name: "Dashboard" })) {
      expect(dashboard).not.toHaveAttribute("aria-current");
    }
  });

  it("exibe breadcrumb 'Dashboard / Módulo' na(s) rota(s) do módulo ativo", () => {
    mocks.pathname = "/dashboard/retiradas";
    renderizarShell();
    const trilha = screen.getByRole("navigation", { name: "Navegação estrutural" });
    expect(trilha).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThanOrEqual(2);
    expect(trilha).toHaveTextContent("Retiradas");
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "href",
      "/dashboard/pacientes"
    );
  });

  it("não exibe breadcrumb no /dashboard (sem profundidade)", () => {
    renderizarShell();
    expect(screen.queryByRole("navigation", { name: "Navegação estrutural" })).toBeNull();
  });

  it("não mostra Usuários para autorizador", () => {
    renderizarShell({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR, statusAtivo: true });
    expect(screen.getByRole("link", { name: "Pacientes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).toBeNull();
  });

  it("não mostra Usuários para recepcionista", () => {
    renderizarShell({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true });
    expect(screen.getByRole("link", { name: "Pacientes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuários" })).toBeNull();
  });

  it("Liberações, Retiradas, Auditoria e Relatórios são links reais para o Gestor", () => {
    renderizarShell();
    expect(screen.getByRole("link", { name: "Liberações" })).toHaveAttribute(
      "href",
      "/dashboard/liberacoes"
    );
    expect(screen.getByRole("link", { name: "Retiradas" })).toHaveAttribute(
      "href",
      "/dashboard/retiradas"
    );
    expect(screen.getByRole("link", { name: "Auditoria" })).toHaveAttribute(
      "href",
      "/dashboard/auditoria"
    );
    expect(screen.getByRole("link", { name: "Relatórios" })).toHaveAttribute(
      "href",
      "/dashboard/relatorios"
    );
    expect(screen.queryByText("Em desenvolvimento")).toBeNull();
  });

  it("Auditoria e Relatórios não aparecem para autorizador nem recepcionista", () => {
    renderizarShell({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR, statusAtivo: true });
    expect(screen.queryByRole("link", { name: "Auditoria" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Relatórios" })).toBeNull();

    renderizarShell({ perfil: PERFIS.RECEPCIONISTA, statusAtivo: true });
    expect(screen.queryByRole("link", { name: "Auditoria" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Relatórios" })).toBeNull();
  });

  it("Retiradas TAMBÉM aparecem para o profissional autorizador — Sprint44 (todos operam)", () => {
    renderizarShell({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR, statusAtivo: true });
    expect(screen.getByRole("link", { name: "Retiradas" })).toHaveAttribute("href", "/dashboard/retiradas");
  });

  it("logout funciona (botão Sair no painel)", async () => {
    renderizarShell();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  });

  it("menu mobile abre como dialog acessível e fecha por Escape", async () => {
    renderizarShell();
    const abrir = screen.getByRole("button", { name: "Abrir menu" });
    expect(abrir).toHaveAttribute("aria-expanded", "false");
    await user.click(abrir);
    expect(abrir).toHaveAttribute("aria-expanded", "true");

    const dialog = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Pacientes" }).length).toBeGreaterThanOrEqual(2);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Menu de navegação" })).toBeNull()
    );
    expect(abrir).toHaveAttribute("aria-expanded", "false");
  });

  it("menu mobile fecha ao escolher um módulo", async () => {
    renderizarShell();
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByRole("dialog", { name: "Menu de navegação" })).toBeInTheDocument();

    const linksDoMenu = screen.getAllByRole("link", { name: "Pacientes" });
    await user.click(linksDoMenu[linksDoMenu.length - 1]);

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Menu de navegação" })).toBeNull()
    );
  });

  it("menu mobile move o foco para o botão fechar ao abrir e devolve o foco ao fechar (Escape)", async () => {
    renderizarShell();
    const abrir = screen.getByRole("button", { name: "Abrir menu" });

    await user.click(abrir);
    const fechar = screen.getByRole("button", { name: "Fechar menu" });
    await waitFor(() => expect(fechar).toHaveFocus());

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(abrir).toHaveFocus());
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Menu de navegação" })).toBeNull()
    );
  });

  it("não expõe informações sensíveis no HTML", () => {
    renderizarShell();
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/SERVICE_ROLE|supabase\.co|postgres|auth\.users|token/i);
  });
});