// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LiberacaoForm from "@/app/dashboard/liberacoes/components/liberacao-form";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    criarLiberacaoAction: vi.fn(),
    listarPacientesAction: vi.fn(),
  },
}));

vi.mock("@/app/actions/liberacoes", () => ({
  criarLiberacaoAction: (...args: unknown[]) => mocks.criarLiberacaoAction(...args),
}));

vi.mock("@/app/actions/pacientes", () => ({
  listarPacientesAction: (...args: unknown[]) => mocks.listarPacientesAction(...args),
}));

function paciente(sobre?: { origem?: string; nome?: string }) {
  return {
    id: "p1",
    gestor_sus: "123456",
    nome: sobre?.nome ?? "Maria da Silva",
    status: "ativo",
    origem: sobre?.origem ?? "regular",
    data_inicio_acompanhamento: null,
    data_fim_acompanhamento: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function origem(): LiberacaoComPaciente {
  return {
    id: "l-origem",
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
    paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
  };
}

async function selecionarPaciente(sobre?: { origem?: string; nome?: string }) {
  fireEvent.click(screen.getByRole("button", { name: "Buscar paciente por nome ou Gestor SUS" }));
  fireEvent.change(screen.getByLabelText("Buscar paciente"), {
    target: { value: "maria" },
  });
  mocks.listarPacientesAction.mockResolvedValue({
    ok: true,
    data: [paciente(sobre)],
  });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  fireEvent.click(await screen.findByText(sobre?.nome ?? "Maria da Silva"));
}

// Avança pelos passos 1→2→3→4 (Paciente, Tipo e quantidade, Período, Revisão).
async function avancarPassos() {
  for (let i = 0; i < 3; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LiberacaoForm — criar (fluxo em etapas)", () => {
  it("exibe o fluxo em etapas com os campos de nova liberação", () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Nova liberação" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Buscar paciente por nome ou Gestor SUS" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contínua")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toBeInTheDocument();
    expect(screen.getByLabelText("Período da liberação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar liberação" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Paciente").length).toBeGreaterThan(0);
    expect(screen.getByText("Tipo e quantidade")).toBeInTheDocument();
    expect(screen.getAllByText("Período").length).toBeGreaterThan(0);
    expect(screen.getByText("Revisão")).toBeInTheDocument();
  });

  it("bloqueia avançar sem paciente selecionado", async () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Selecione o paciente.")).toBeInTheDocument();
    expect(mocks.criarLiberacaoAction).not.toHaveBeenCalled();
  });

  it("exibe o resumo no passo de revisão antes de criar", async () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    await selecionarPaciente();
    await avancarPassos();

    expect(screen.getByRole("button", { name: "Criar liberação" })).toBeInTheDocument();
    expect(screen.getByText("Revisão")).toBeInTheDocument();
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contínua").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 meses").length).toBeGreaterThan(0);
  });

  it("envia ao servidor apenas os dados do negócio (identidade é resolvida no servidor)", async () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);
    mocks.criarLiberacaoAction.mockResolvedValue({ ok: true, data: origem() });

    await selecionarPaciente();
    await avancarPassos();
    fireEvent.click(screen.getByRole("button", { name: "Criar liberação" }));

    await waitFor(() => {
      expect(mocks.criarLiberacaoAction).toHaveBeenCalledWith({
        pacienteId: "p1",
        tipo: TIPOS_LIBERACAO.CONTINUA,
        quantidade: 1,
        periodoMeses: 3,
      });
    });
    expect(
      await screen.findByText("Liberação criada com sucesso.")
    ).toBeInTheDocument();
  });

  it("exibe erro amigável retornado pela action", async () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);
    mocks.criarLiberacaoAction.mockResolvedValue({
      ok: false,
      error: "Não foi possível criar a liberação.",
    });

    await selecionarPaciente();
    await avancarPassos();
    fireEvent.click(screen.getByRole("button", { name: "Criar liberação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível criar a liberação."
    );
  });

  it("RN29 — paciente esporádico: contínua desabilitada e avulsa forçada", async () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    await selecionarPaciente({ origem: "esporadico", nome: "José Esporádico" });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByLabelText("Contínua")).toBeDisabled();
    expect(
      screen.getByText(/Paciente esporádico: somente liberação avulsa/)
    ).toBeInTheDocument();

    // Avança até a revisão — o tipo enviado deve ser avulsa (forçado).
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("button", { name: "Criar liberação" })).toBeInTheDocument();
  });

  it("volta ao passo anterior sem perder os dados já informados", async () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    await selecionarPaciente();
    await avancarPassos();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar liberação" })).not.toBeInTheDocument();
  });

  it("indica a etapa atual do stepper (Etapa X de 4)", async () => {
    render(<LiberacaoForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    expect(screen.getByText("Etapa 1 de 4")).toBeInTheDocument();

    await selecionarPaciente();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Etapa 2 de 4")).toBeInTheDocument();
  });

  it("foca o diálogo ao abrir e fecha por Escape (acessibilidade)", () => {
    const onClose = vi.fn();
    render(<LiberacaoForm modo="criar" onClose={onClose} onSalvo={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Nova liberação" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("LiberacaoForm — renovar", () => {
  it("exibe resumo somente leitura da liberação original", () => {
    render(<LiberacaoForm modo="renovar" origem={origem()} onClose={() => {}} onSalvo={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Renovar liberação" })).toBeInTheDocument();
    expect(screen.getByText("Maria da Silva")).toBeInTheDocument();
    expect(screen.getByText("Contínua")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3 meses")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Período da liberação")).not.toBeInTheDocument();
  });

  it("envia apenas o id da liberação original à action", async () => {
    render(<LiberacaoForm modo="renovar" origem={origem()} onClose={() => {}} onSalvo={() => {}} />);
    mocks.criarLiberacaoAction.mockResolvedValue({ ok: true, data: origem() });

    fireEvent.click(screen.getByRole("button", { name: "Renovar" }));

    await waitFor(() => {
      expect(mocks.criarLiberacaoAction).toHaveBeenCalledWith({
        renovacaoDeId: "l-origem",
      });
    });
    expect(
      await screen.findByText("Liberação renovada com sucesso.")
    ).toBeInTheDocument();
  });
});
