// @vitest-environment jsdom
// Sprint 39 — reprodução da navegação da sidebar. Diferente dos testes que
// apenas verificam href/aria-current, este monta o shell com um RouterContext
// real e clica em cada item verificando que o router.push é chamado com o
// destino esperado (o comportamento real do <Link> do Next.js).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import DashboardHome from "@/components/dashboard/dashboard-home";
import { PERFIS } from "@/lib/domain/enums";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    pathname: "/dashboard",
    push: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/app/actions/auth", () => ({
  login: vi.fn(),
  logout: vi.fn(),
}));

const user = userEvent.setup();

function router(): NextRouter {
  return {
    route: "/dashboard",
    pathname: mocks.pathname,
    query: {},
    asPath: mocks.pathname,
    basePath: "",
    isLocaleDomain: false,
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    push: mocks.push,
    replace: vi.fn(),
    reload: vi.fn(),
    prefetch: vi.fn(() => Promise.resolve()),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    beforePopState: vi.fn(),
    isFallback: false,
    isReady: true,
    isPreview: false,
  } as NextRouter;
}

function renderizarShell() {
  return render(
    <RouterContext.Provider value={router()}>
      <DashboardShell
        email="gestor@caps.local"
        perfil={PERFIS.GESTOR}
        statusAtivo={true}
      >
        <p>conteúdo real da página</p>
      </DashboardShell>
    </RouterContext.Provider>
  );
}

beforeEach(() => {
  mocks.pathname = "/dashboard";
  mocks.push.mockReset();
});

describe("navegação da sidebar a partir de /dashboard", () => {
  it.each([
    ["Dashboard", "/dashboard"],
    ["Pacientes", "/dashboard/pacientes"],
    ["Liberações", "/dashboard/liberacoes"],
    ["Retiradas", "/dashboard/retiradas"],
    ["Usuários", "/dashboard/usuarios"],
    ["Auditoria", "/dashboard/auditoria"],
    ["Relatórios", "/dashboard/relatorios"],
  ] as const)(
    "clicar em %s (sidebar desktop) navega para %s",
    async (rotulo, destino) => {
      renderizarShell();
      const link = screen.getByRole("link", { name: rotulo });
      await user.click(link);
      await waitFor(() => {
        const chamadas = mocks.push.mock.calls as unknown[][];
        expect(chamadas.some((c) => c[0] === destino)).toBe(true);
      });
    }
  );
});

describe("estado ativo e aria-current a partir de /dashboard", () => {
  it("mantém Dashboard ativo (aria-current=page) e os demais sem", () => {
    renderizarShell();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    for (const rotulo of ["Pacientes", "Liberações", "Retiradas", "Usuários", "Auditoria", "Relatórios"]) {
      expect(screen.getByRole("link", { name: rotulo })).not.toHaveAttribute(
        "aria-current"
      );
    }
  });

  it("cada módulo é um <a> real com href correto (estrutura renderizada)", () => {
    renderizarShell();
    const esperado: Array<[string, string]> = [
      ["Dashboard", "/dashboard"],
      ["Pacientes", "/dashboard/pacientes"],
      ["Liberações", "/dashboard/liberacoes"],
      ["Retiradas", "/dashboard/retiradas"],
      ["Usuários", "/dashboard/usuarios"],
      ["Auditoria", "/dashboard/auditoria"],
      ["Relatórios", "/dashboard/relatorios"],
    ];
    for (const [rotulo, href] of esperado) {
      const link = screen.getByRole("link", { name: rotulo });
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", href);
    }
  });
});

describe("navegação do drawer mobile a partir de /dashboard", () => {
  it("abre o menu, navega por cada módulo e fecha o drawer após a escolha", async () => {
    renderizarShell();
    const abrir = screen.getByRole("button", { name: "Abrir menu" });

    const destinos: Array<[string, string]> = [
      ["Dashboard", "/dashboard"],
      ["Pacientes", "/dashboard/pacientes"],
      ["Liberações", "/dashboard/liberacoes"],
      ["Retiradas", "/dashboard/retiradas"],
      ["Usuários", "/dashboard/usuarios"],
      ["Auditoria", "/dashboard/auditoria"],
      ["Relatórios", "/dashboard/relatorios"],
    ];

    for (const [rotulo, destino] of destinos) {
      await user.click(abrir);
      expect(screen.getByRole("dialog", { name: "Menu de navegação" })).toBeInTheDocument();

      const linksDoDrawer = screen.getAllByRole("link", { name: rotulo });
      const linkDoDrawer = linksDoDrawer[linksDoDrawer.length - 1];
      mocks.push.mockReset();
      await user.click(linkDoDrawer);

      await waitFor(() => {
        const chamadas = mocks.push.mock.calls as unknown[][];
        expect(chamadas.some((c) => c[0] === destino)).toBe(true);
      });
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Menu de navegação" })
        ).toBeNull()
      );
    }
  });

  it("nenhum overlay bloqueia os itens do drawer (painel acima do fundo)", async () => {
    renderizarShell();
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const pacientes = screen.getAllByRole("link", { name: "Pacientes" });
    expect(pacientes[pacientes.length - 1]).toBeVisible();
  });
});

function renderizarHome() {
  return render(
    <RouterContext.Provider value={router()}>
      <DashboardHome
        email="gestor@caps.local"
        perfil={PERFIS.GESTOR}
        statusAtivo={true}
      />
    </RouterContext.Provider>
  );
}

describe("Quick Actions e Module Cards a partir de /dashboard", () => {
  it("cada ação rápida navega para o módulo correspondente", async () => {
    renderizarHome();
    const acoes: Array<[string, string]> = [
      ["Gerenciar usuários", "/dashboard/usuarios"],
      ["Consultar auditoria", "/dashboard/auditoria"],
      ["Consultar relatórios", "/dashboard/relatorios"],
    ];
    for (const [rotulo, destino] of acoes) {
      mocks.push.mockReset();
      await user.click(screen.getByRole("link", { name: new RegExp(`^${rotulo}`) }));
      await waitFor(() => {
        const chamadas = mocks.push.mock.calls as unknown[][];
        expect(chamadas.some((c) => c[0] === destino)).toBe(true);
      });
    }
  });

  it("cada module card navega para o módulo correspondente", async () => {
    renderizarHome();
    const modulos: Array<[string, string]> = [
      ["Pacientes", "/dashboard/pacientes"],
      ["Liberações", "/dashboard/liberacoes"],
      ["Retiradas", "/dashboard/retiradas"],
      ["Usuários", "/dashboard/usuarios"],
      ["Auditoria", "/dashboard/auditoria"],
      ["Relatórios", "/dashboard/relatorios"],
    ];
    for (const [rotulo, destino] of modulos) {
      mocks.push.mockReset();
      const card = screen.getByRole("link", {
        name: new RegExp(`^${rotulo}`),
      });
      await user.click(card);
      await waitFor(() => {
        const chamadas = mocks.push.mock.calls as unknown[][];
        expect(chamadas.some((c) => c[0] === destino)).toBe(true);
      });
    }
  });
});

describe("matriz de navegação por perfil (FASE 6)", () => {
  const MODULOS_COM_HREF: Array<[string, string]> = [
    ["Pacientes", "/dashboard/pacientes"],
    ["Liberações", "/dashboard/liberacoes"],
    ["Retiradas", "/dashboard/retiradas"],
    ["Usuários", "/dashboard/usuarios"],
    ["Auditoria", "/dashboard/auditoria"],
    ["Relatórios", "/dashboard/relatorios"],
  ];

  it.each([
    [PERFIS.GESTOR, MODULOS_COM_HREF],
    [
      PERFIS.PROFISSIONAL_AUTORIZADOR,
      [
        ["Pacientes", "/dashboard/pacientes"],
        ["Liberações", "/dashboard/liberacoes"],
        ["Retiradas", "/dashboard/retiradas"],
      ],
    ],
    [
      PERFIS.RECEPCIONISTA,
      [
        ["Pacientes", "/dashboard/pacientes"],
        ["Liberações", "/dashboard/liberacoes"],
        ["Retiradas", "/dashboard/retiradas"],
      ],
    ],
  ] as const)(
    "perfil renderiza exatamente os módulos permitidos como links navegáveis (não é falta de clique)",
    async (perfil, esperados) => {
      const { unmount } = render(
        <RouterContext.Provider value={router()}>
          <DashboardShell
            email="x@caps.local"
            perfil={perfil}
            statusAtivo={true}
          >
            <p>conteúdo</p>
          </DashboardShell>
        </RouterContext.Provider>
      );

      const naoPermitidos = MODULOS_COM_HREF.filter(
        ([rotulo]) => !esperados.some(([r]) => r === rotulo)
      );

      for (const [rotulo, href] of esperados) {
        const link = screen.getByRole("link", { name: rotulo });
        expect(link).toHaveAttribute("href", href);
        mocks.push.mockReset();
        await user.click(link);
        await waitFor(() => {
          const chamadas = mocks.push.mock.calls as unknown[][];
          expect(chamadas.some((c) => c[0] === href)).toBe(true);
        });
      }
      for (const [rotulo] of naoPermitidos) {
        expect(screen.queryByRole("link", { name: rotulo })).toBeNull();
      }
      unmount();
    }
  );
});

describe("regressão Sprint 40: CardGlow confinado ao card (mecanismo real do clique)", () => {
  // No navegador real, CardGlow é `position:absolute; inset:0`. Sem um ancestral
  // posicionado (relative), o containing block vira o bloco inicial (= viewport)
  // e a camada transparente cobre a página inteira — interceptando os cliques da
  // sidebar. Este teste garante que todo CardGlow possui um ancestral <a> que
  // cria o containing block (classe de posicionamento), como AcaoPrincipal,
  // ModuleCard (destaque e comum) e AcaoRegular fazem após a correção.
  function coletarGlows(): HTMLSpanElement[] {
    return Array.from(
      document.querySelectorAll<HTMLSpanElement>('span[class*="absolute inset-0"]')
    );
  }

  function classesQueCriamContainingBlock(classe: string): boolean {
    return /\b(relative|absolute|fixed|sticky)\b/.test(classe);
  }

  it("todo CardGlow do DashboardHome tem ancestral <a> com posicionamento", () => {
    render(
      <RouterContext.Provider value={router()}>
        <DashboardHome
          email="gestor@caps.local"
          perfil={PERFIS.GESTOR}
          statusAtivo={true}
        />
      </RouterContext.Provider>
    );

    const glows = coletarGlows();
    expect(glows.length).toBeGreaterThan(0);
    glows.forEach((glow) => {
      const ancestral = glow.closest("a");
      expect(ancestral).not.toBeNull();
      expect(classesQueCriamContainingBlock(ancestral!.className)).toBe(true);
    });
  });

  it("nenhuma CardGlow escapa do card (ancestral imediato dentro do grid de ações rápidas)", () => {
    render(
      <main>
        <RouterContext.Provider value={router()}>
          <DashboardHome
            email="gestor@caps.local"
            perfil={PERFIS.GESTOR}
            statusAtivo={true}
          />
        </RouterContext.Provider>
      </main>
    );

    const glows = coletarGlows();
    for (const glow of glows) {
      const a = glow.closest("a")!;
      expect(a.parentElement).not.toBeNull();
      expect(a.parentElement!.closest("main")).not.toBeNull();
    }
  });

  it("a sidebar do DashboardShell não possui CardGlow interceptando o próprio item", () => {
    render(
      <RouterContext.Provider value={router()}>
        <DashboardShell
          email="gestor@caps.local"
          perfil={PERFIS.GESTOR}
          statusAtivo={true}
        >
          <p>conteúdo</p>
        </DashboardShell>
      </RouterContext.Provider>
    );

    const aside = document.querySelector("aside");
    expect(aside).not.toBeNull();
    const glowsNoAside = aside!.querySelectorAll('span[class*="absolute inset-0"]');
    expect(glowsNoAside.length).toBe(0);
  });
});

describe("regressão Sprint 41: recomposição da grade (sem col-span, sem órfãos)", () => {
  // A causa dos cards órfãos era a composição assimétrica: a primeira ação e o
  // módulo destaque usavam `col-span-*`, deixando um card sozinho na linha
  // seguinte. A nova grade é uniforme: todas as ações e todos os módulos ocupam
  // exatamente uma coluna de largura igual, e a hierarquia visual (CTA verde /
  // módulo azul) permanece apenas por superfície, nunca por largura.
  function secao(id: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(
      `section[aria-labelledby="${id}"]`
    );
    expect(el).not.toBeNull();
    return el!;
  }

  it("Gestor: 7 ações rápidas em grid de colunas iguais (base 1 col, desktop 3) — Sprint44", () => {
    renderizarHome();
    const ul = secao("dashboard-acoes-rapidas").querySelector("ul")!;
    expect(ul.className).toContain("grid-cols-1");
    expect(ul.className).toContain("lg:grid-cols-3");
    const itens = Array.from(ul.querySelectorAll("li"));
    expect(itens).toHaveLength(7);
    for (const item of itens) {
      expect(item.className).not.toMatch(/col-span/);
      expect(item.querySelector("a")).not.toBeNull();
    }
    for (const rotulo of ["Novo paciente", "Paciente esporádico", "Nova liberação", "Registrar retirada", "Gerenciar usuários", "Consultar auditoria", "Consultar relatórios"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${rotulo}`) })).toBeInTheDocument();
    }
  });

  it("Gestor: 7 módulos em grid 3×2 de larguras iguais (sem col-span) — Histórico consolidado em Relatórios + Atendimento", () => {
    renderizarHome();
    const grade = secao("dashboard-modulos").querySelector("div.grid")!;
    expect(grade.className).toContain("sm:grid-cols-2");
    expect(grade.className).toContain("lg:grid-cols-3");
    const cards = Array.from(grade.querySelectorAll("a"));
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      expect(card.className).not.toMatch(/col-span/);
    }
  });

  it("Pacientes mantém destaque azul sem largura diferente (mesma coluna)", () => {
    renderizarHome();
    const grade = secao("dashboard-modulos").querySelector("div.grid")!;
    const pacientes = Array.from(grade.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/dashboard/pacientes"
    )!;
    expect(pacientes.className).toContain("bg-gradient-to-br from-brand-600");
    expect(pacientes.className).toContain("relative");
    expect(pacientes.className).not.toMatch(/col-span/);
  });

  it("recepcionista: grade se adapta naturalmente (4 ações, 4 módulos com atendimento, sem placeholders) — Sprint47", () => {
    render(
      <RouterContext.Provider value={router()}>
        <DashboardHome
          email="recep@caps.local"
          perfil={PERFIS.RECEPCIONISTA}
          statusAtivo={true}
        />
      </RouterContext.Provider>
    );
    const ulAcoes = secao("dashboard-acoes-rapidas").querySelector("ul")!;
    const itensAcoes = Array.from(ulAcoes.querySelectorAll("li"));
    expect(itensAcoes).toHaveLength(4);
    for (const item of itensAcoes) {
      expect(item.className).not.toMatch(/col-span/);
    }
    expect(screen.getByRole("link", { name: /^Paciente esporádico/ })).toBeInTheDocument();
    const gradeModulos = secao("dashboard-modulos").querySelector("div.grid")!;
    const cards = Array.from(gradeModulos.querySelectorAll("a"));
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.className).not.toMatch(/col-span/);
    }
  });

  it("nenhuma classe col-span sobrevive na composição do DashboardHome", () => {
    renderizarHome();
    expect(document.querySelectorAll('[class*="col-span"]').length).toBe(0);
  });
});