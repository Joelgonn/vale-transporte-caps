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

describe("LiberacoesView — sem paciente selecionado", () => {
  it("não exibe botão Nova liberação quando sem paciente", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    expect(screen.queryByRole("button", { name: /nova liberação/i })).not.toBeInTheDocument();
  });

  it("elemento de descricao aria existe no DOM", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    const desc = document.getElementById("nova-liberacao-descricao");
    expect(desc).toBeInTheDocument();
  });

  it("exibe mensagem de ajuda para buscar paciente (sr-only)", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    const desc = document.getElementById("nova-liberacao-descricao");
    expect(desc).toHaveTextContent(/pesquise e selecione um paciente/i);
  });
});

describe("LiberacoesView — selecao regular sem continua ativa", () => {
  it("exibe botão + Nova liberação contínua habilitado", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [],
    });
    const btns = screen.getAllByRole("button", { name: /nova liberação contínua/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
    expect(btns[0]).not.toBeDisabled();
  });
});

describe("LiberacoesView — continua ativa bloqueia nova liberacao", () => {
  it("não exibe botão Nova liberação quando há contínua ativa", () => {
    const libAtiva = liberacao({ id: "l1", status: "ativa", tipo: TIPOS_LIBERACAO.CONTINUA });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [libAtiva],
    });
    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();
  });

  it("exibe aviso de contínua ativa no contexto do paciente", () => {
    const libAtiva = liberacao({ id: "l1", status: "ativa", tipo: TIPOS_LIBERACAO.CONTINUA });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [libAtiva],
    });
    expect(screen.getByText(/contínua ativa — nova liberação indisponível/i)).toBeInTheDocument();
  });
});

describe("LiberacoesView — paciente esporadico", () => {
  it("não exibe botão Nova liberação para esporádico", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Esporadico", origem: "esporadico" },
      liberacoes: [],
    });
    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();
  });

  it("feedback de bloqueio aparece no contexto do paciente", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Esporadico", origem: "esporadico" },
      liberacoes: [],
    });
    const texts = screen.getAllByText(/paciente esporádico não pode receber liberação contínua/i);
    expect(texts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("LiberacoesView — contínua expirada/cancelada permite nova", () => {
  it("exibe botão Nova liberação quando contínua expirada", () => {
    const libExp = liberacao({ id: "l1", status: "expirada", tipo: TIPOS_LIBERACAO.CONTINUA });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [libExp],
    });
    expect(screen.getByRole("button", { name: /nova liberação contínua/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nova liberação contínua/i })).not.toBeDisabled();
  });

  it("exibe botão Nova liberação quando contínua cancelada", () => {
    const libCan = liberacao({ id: "l1", status: "cancelada", tipo: TIPOS_LIBERACAO.CONTINUA });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [libCan],
    });
    expect(screen.getByRole("button", { name: /nova liberação contínua/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nova liberação contínua/i })).not.toBeDisabled();
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

    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/maria/i)).not.toBeInTheDocument();
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

  it("não exibe 'Novo atendimento' para autorizador", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    expect(screen.queryByRole("link", { name: /atendimento/i })).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — ações das liberações (cards)", () => {
  it("Registrar retirada existe nas liberações ativas", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });
    expect(screen.getAllByText("Registrar retirada").length).toBeGreaterThan(0);
  });

  it("Editar existe nas liberações", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });
    expect(screen.getAllByText("Editar").length).toBeGreaterThan(0);
  });
});

describe("LiberacoesView — permissões preservadas", () => {
  it("recepcionista NÃO recebe Nova liberação", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });
    expect(screen.queryByRole("button", { name: /nova liberação/i })).not.toBeInTheDocument();
  });

  it("autorizador vê busca mas não botão Nova liberação sem paciente", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();
  });

  it("autorizador vê botão Nova liberação quando paciente selecionado", () => {
    renderizar({
      perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [],
    });
    const btns = screen.getAllByRole("button", { name: /nova liberação contínua/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
    expect(btns[0]).not.toBeDisabled();
  });
});

describe("LiberacoesView — busca sem resultado limpa estado", () => {
  it("alterar busca limpa seleção anterior e remove botão", () => {
    mocks.listarPacientesAction.mockResolvedValue({ ok: true, data: [] });
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });

    const input = screen.getByRole("combobox", { name: /buscar/i });
    fireEvent.change(input, { target: { value: "xyz" } });

    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();

    mocks.listarPacientesAction.mockResolvedValue({
      ok: true,
      data: [{ id: "p2", gestor_sus: "999", nome: "Novo Paciente", origem: "regular" }],
    });
    mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [] });
    fireEvent.change(input, { target: { value: "novo" } });
    fireEvent.click(await screen.findByText("Novo Paciente"));

    await vi.waitFor(() => expect(screen.getByRole("button", { name: /nova liberação contínua/i })).toBeInTheDocument());
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

    await vi.waitFor(() => {
      const btns = screen.getAllByRole("button", { name: /nova liberação contínua/i });
      expect(btns.length).toBeGreaterThanOrEqual(1);
    });

    resolveA!({ ok: true, data: [liberacao({ id: "l-old", paciente_id: "p1", status: "ativa", tipo: "continua" })] });
    await vi.waitFor(() => {});

    const btns = screen.getAllByRole("button", { name: /nova liberação contínua/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/contínua ativa/i)).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — Limpar limpa tudo", () => {
  it("Limpar remove seleção, busca, URL, feedback e remove botão Nova liberação", () => {
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
    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();
    const input = screen.getByRole("combobox", { name: /buscar/i }) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.queryByText(/esporádico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contínua ativa/i)).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — ausência de card contextual duplicado", () => {
  it("não exibe card duplicado com dados do paciente fora dos cards de liberação", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao()],
    });

    const cards = document.querySelectorAll('[class*="rounded-2xl"][class*="bg-white"]');
    expect(cards.length).toBeLessThanOrEqual(4);
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
  it("ao clicar + Nova liberação contínua, form abre com pacienteInicial", async () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [],
    });

    const btns = screen.getAllByRole("button", { name: /nova liberação contínua/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(btns[0]);
    const dialog = await screen.findByRole("dialog", { name: "Nova liberação" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Maria");
  });
});

describe("LiberacoesView — server-side protection preserved", () => {
  it("não exibe botão Nova liberação quando há contínua ativa (proteção client-side)", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacienteSelecionado: { id: "p1", gestor_sus: "123456", nome: "Maria", origem: "regular" },
      liberacoes: [liberacao({ status: "ativa", tipo: TIPOS_LIBERACAO.CONTINUA })],
    });

    expect(screen.queryByRole("button", { name: /nova liberação contínua/i })).not.toBeInTheDocument();
    const feedbacks = screen.getAllByText(/contínua ativa/i);
    expect(feedbacks.length).toBeGreaterThanOrEqual(1);
  });
});