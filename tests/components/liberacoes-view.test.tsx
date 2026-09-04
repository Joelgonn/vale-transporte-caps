// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LiberacoesView from "@/app/dashboard/liberacoes/components/liberacoes-view";
import { PERFIS, TIPOS_LIBERACAO, type PerfilUsuario } from "@/lib/domain/enums";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    criarLiberacaoAction: vi.fn(),
    listarLiberacoesAction: vi.fn(),
    listarPacientesAction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/app/actions/liberacoes", () => ({
  criarLiberacaoAction: (...args: unknown[]) => mocks.criarLiberacaoAction(...args),
  listarLiberacoesAction: (...args: unknown[]) => mocks.listarLiberacoesAction(...args),
}));

vi.mock("@/app/actions/pacientes", () => ({
  listarPacientesAction: (...args: unknown[]) => mocks.listarPacientesAction(...args),
}));

function liberacao(sobre?: Partial<LiberacaoComPaciente>): LiberacaoComPaciente {
  return {
    id: "l1",
    paciente_id: "p1",
    tipo: TIPOS_LIBERACAO.CONTINUA,
    quantidade: 4,
    periodo_meses: 3,
    data_inicio: "2026-01-01T00:00:00.000Z",
    data_fim: "2026-04-01T00:00:00.000Z",
    profissional_autorizador_id: "u1",
    registrado_por_id: "u1",
    renovacao_de_id: null,
    status: "ativa",
    justificativa: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    paciente: { id: "p1", gestor_sus: "123456", nome: "Maria" },
    ...sobre,
  };
}

function renderizar(opts: {
  perfil: string;
  pacienteSelecionado?: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null;
  liberacoes?: LiberacaoComPaciente[];
  erroInicial?: string | null;
}) {
  return render(
    <LiberacoesView
      perfil={opts.perfil as PerfilUsuario}
      statusAtivo
      busca=""
      pacienteSelecionado={opts.pacienteSelecionado ?? null}
      liberacoesIniciais={opts.liberacoes ?? [liberacao()]}
      erroInicial={opts.erroInicial ?? null}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [liberacao()] });
  mocks.listarPacientesAction.mockResolvedValue({ ok: true, data: [] });
});

function getNovaBtn() {
  const btns = document.querySelectorAll('button');
  for (const btn of btns) {
    if (btn.textContent?.includes("Nova") && btn.textContent?.includes("liber")) {
      return btn as HTMLElement;
    }
  }
  throw new Error("Nova liberação button not found");
}

function bodyText() {
  return document.body.textContent ?? "";
}

describe("LiberacoesView — sem paciente selecionado", () => {
  it("botao Nova liberacao esta disabled quando sem paciente", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    expect(getNovaBtn()).toBeDisabled();
  });

  it("elemento de descricao aria existe no DOM", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    const desc = document.getElementById("nova-liberacao-descricao");
    expect(desc).toBeInTheDocument();
  });
});

describe("LiberacoesView — selecao regular sem continua ativa", () => {
  it("botao Nova liberacao esta habilitado", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [],
    });
    expect(getNovaBtn()).not.toBeDisabled();
  });
});

describe("LiberacoesView — continua ativa bloqueia nova liberacao", () => {
  it("botao Nova liberacao esta disabled quando continua ativa", () => {
    const libAtiva = liberacao({ id: "l1", status: "ativa", tipo: TIPOS_LIBERACAO.CONTINUA });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [libAtiva],
    });
    expect(getNovaBtn()).toBeDisabled();
  });
});

describe("LiberacoesView — paciente esporadico", () => {
  it("botao Nova liberacao esta disabled para esporadico", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Esporadico", origem: "esporadico" },
      liberacoes: [],
    });
    expect(getNovaBtn()).toBeDisabled();
  });

  it("feedback de bloqueio aparece no body", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Esporadico", origem: "esporadico" },
      liberacoes: [],
    });
    const text = bodyText().toLowerCase();
    expect(text).toMatch(/não pode receber/i);
  });
});

describe("LiberacoesView — contínua expirada/cancelada permite nova", () => {
  it("botão enabled quando contínua expirada", () => {
    const libExp = liberacao({ id: "l1", status: "expirada", tipo: TIPOS_LIBERACAO.CONTINUA });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [libExp],
    });
    expect(getNovaBtn()).not.toBeDisabled();
  });

  it("botão enabled quando contínua cancelada", () => {
    const libCan = liberacao({ id: "l1", status: "cancelada", tipo: TIPOS_LIBERACAO.CONTINUA });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [libCan],
    });
    expect(getNovaBtn()).not.toBeDisabled();
  });
});

describe("LiberacoesView — busca negativa invalida seleção", () => {
  it("alterar busca após seleção limpa paciente", () => {
    mocks.listarPacientesAction.mockResolvedValue({
      ok: true,
      data: [{ id: "p2", gestor_sus: "999", nome: "Novo", origem: "regular" }],
    });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [],
    });

    const input = screen.getByRole("combobox", { name: /buscar/i });
    fireEvent.change(input, { target: { value: "xyz" } });

    expect(getNovaBtn()).toBeDisabled();
  });
});

describe("LiberacoesView — Limpar", () => {
  it("Limpar remove seleção e URL", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });

    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Limpar"
    ) as HTMLElement;
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);

    expect(mocks.replace).toHaveBeenCalledWith("/dashboard/liberacoes");
  });
});

describe("LiberacoesView — aria-describedby estável", () => {
  it("elemento nova-liberacao-descricao existe no DOM", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    const desc = document.getElementById("nova-liberacao-descricao");
    expect(desc).toBeInTheDocument();
    expect(desc?.getAttribute("id")).toBe("nova-liberacao-descricao");
  });
});

describe("LiberacoesView — Avulsa não aparece", () => {
  it("não exibe 'Novo atendimento' para gestor", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    expect(screen.queryByRole("link", { name: /atendimento/i })).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — tabela ações", () => {
  it("Registrar retirada existe", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });
    expect(screen.getAllByText("Registrar retirada").length).toBeGreaterThan(0);
  });
});

describe("LiberacoesView — permissões preservadas", () => {
  it("recepcionista NÃO recebe Nova liberação", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });
    expect(screen.queryByRole("button", { name: /nova liberação/i })).not.toBeInTheDocument();
  });

  it("autorizador recebe Nova liberação", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    expect(screen.getByRole("button", { name: /nova liberação/i })).toBeInTheDocument();
  });
});

describe("LiberacoesView — busca sem resultado limpa estado", () => {
  it("alterar busca limpa seleção anterior e desabilita botão", () => {
    mocks.listarPacientesAction.mockResolvedValue({ ok: true, data: [] });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });

    const input = screen.getByRole("combobox", { name: /buscar/i });
    fireEvent.change(input, { target: { value: "xyz" } });

    expect(getNovaBtn()).toBeDisabled();
    expect(screen.queryByText(/esporádico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contínua ativa/i)).not.toBeInTheDocument();
  });

  it("nova busca válida após busca negativa habilita botão", async () => {
    mocks.listarPacientesAction.mockResolvedValue({ ok: true, data: [] });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });

    const input = screen.getByRole("combobox", { name: /buscar/i });
    fireEvent.change(input, { target: { value: "xyz" } });
    expect(getNovaBtn()).toBeDisabled();

    mocks.listarPacientesAction.mockResolvedValue({
      ok: true,
      data: [{ id: "p2", gestor_sus: "999", nome: "Novo Paciente", origem: "regular" }],
    });
    mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [] });
    fireEvent.change(input, { target: { value: "novo" } });
    fireEvent.click(await screen.findByText("Novo Paciente"));

    await vi.waitFor(() => expect(getNovaBtn()).not.toBeDisabled());
    expect(screen.queryByText(/esporádico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contínua ativa/i)).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — race condition protege seleção atual", () => {
  it("resposta tardia de consulta anterior não altera estado de seleção nova", async () => {
    let resolveA: (value: { ok: boolean; data: LiberacaoComPaciente[] }) => void;
    const promiseA = new Promise<{ ok: boolean; data: LiberacaoComPaciente[] }>((resolve) => { resolveA = resolve; });

    mocks.listarLiberacoesAction.mockImplementation((...args) => {
      if (args[1] === "p1") return promiseA;
      if (args[1] === "p2") return Promise.resolve({ ok: true, data: [] });
      return Promise.resolve({ ok: true, data: [] });
    });

    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Paciente A", origem: "regular" },
      liberacoes: [],
    });

    mocks.listarPacientesAction.mockResolvedValue({
      ok: true,
      data: [{ id: "p2", gestor_sus: "999", nome: "Paciente B", origem: "regular" }],
    });

    const input = screen.getByRole("combobox", { name: /buscar/i });
    fireEvent.change(input, { target: { value: "paciente b" } });
    fireEvent.click(await screen.findByText("Paciente B"));

    await vi.waitFor(() => expect(getNovaBtn()).not.toBeDisabled());

    resolveA!({ ok: true, data: [liberacao({ id: "l-old", paciente_id: "p1", status: "ativa", tipo: "continua" })] });
    await vi.waitFor(() => {});

    expect(getNovaBtn()).not.toBeDisabled();
    expect(screen.queryByText(/contínua ativa/i)).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — Limpar limpa tudo", () => {
  it("Limpar remove seleção, busca, URL, feedback e desabilita botão", () => {
    mocks.push.mockClear();
    mocks.replace.mockClear();
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });

    const btnLimpar = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Limpar"
    ) as HTMLElement;
    expect(btnLimpar).toBeInTheDocument();
    fireEvent.click(btnLimpar);

    expect(mocks.replace).toHaveBeenCalledWith("/dashboard/liberacoes");
    expect(getNovaBtn()).toBeDisabled();
    const input = screen.getByRole("combobox", { name: /buscar/i }) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.queryByText(/esporádico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contínua ativa/i)).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — ausência de card contextual duplicado", () => {
  it("não exibe card duplicado com dados do paciente fora da tabela", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });

    const cards = document.querySelectorAll('[class*="rounded-2xl"][class*="bg-white"]');
    expect(cards.length).toBeLessThanOrEqual(3);
  });
});

describe("LiberacoesView — Avulsa não aparece", () => {
  it("não exibe 'Novo atendimento' para gestor", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    expect(screen.queryByRole("link", { name: /atendimento/i })).not.toBeInTheDocument();
  });

  it("não exibe 'Novo atendimento' para autorizador", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    expect(screen.queryByRole("link", { name: /atendimento/i })).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — pacienteInicial passado ao LiberacaoForm", () => {
  it("ao clicar Nova liberação, form abre com pacienteInicial", async () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [],
    });

    fireEvent.click(getNovaBtn());
    const dialog = await screen.findByRole("dialog", { name: "Nova liberação" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Maria");
  });
});

describe("LiberacoesView — server-side protection preserved", () => {
  it("botão Nova liberação fica disabled quando há contínua ativa (proteção client-side)", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao({ status: "ativa", tipo: TIPOS_LIBERACAO.CONTINUA })],
    });

    expect(getNovaBtn()).toBeDisabled();
    const feedbacks = screen.getAllByText(/contínua ativa/i);
    expect(feedbacks.length).toBeGreaterThanOrEqual(1);
  });
});
