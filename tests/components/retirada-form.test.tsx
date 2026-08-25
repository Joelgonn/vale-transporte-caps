// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import RetiradaForm from "@/app/dashboard/retiradas/components/retirada-form";
import { TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listarPacientesAction: vi.fn(),
    listarLiberacoesAction: vi.fn(),
    listarRetiradasAction: vi.fn(),
    registrarRetiradaAction: vi.fn(),
  },
}));

vi.mock("@/app/actions/pacientes", () => ({
  listarPacientesAction: (...args: unknown[]) => mocks.listarPacientesAction(...args),
}));

vi.mock("@/app/actions/liberacoes", () => ({
  listarLiberacoesAction: (...args: unknown[]) => mocks.listarLiberacoesAction(...args),
}));

vi.mock("@/app/actions/retiradas", () => ({
  listarRetiradasAction: (...args: unknown[]) => mocks.listarRetiradasAction(...args),
  registrarRetiradaAction: (...args: unknown[]) => mocks.registrarRetiradaAction(...args),
}));

function paciente() {
  return { id: "p1", gestor_sus: "123456", nome: "Maria da Silva", status: "ativo" };
}

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
    paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    ...sobre,
  };
}

function retirada(id: string, quantidade: number) {
  return {
    id,
    liberacao_id: "l1",
    paciente_id: "p1",
    recepcionista_id: "u1",
    quantidade,
    data_hora: "2026-01-05T10:30:00.000000+00:00",
    unidade_id: null,
  };
}

function renderizar() {
  return render(<RetiradaForm onClose={() => {}} onSalvo={() => {}} />);
}

async function selecionarPaciente() {
  fireEvent.click(
    screen.getByRole("button", { name: "Buscar paciente por nome ou Gestor SUS" })
  );
  fireEvent.change(screen.getByLabelText("Buscar paciente"), {
    target: { value: "maria" },
  });
  mocks.listarPacientesAction.mockResolvedValue({ ok: true, data: [paciente()] });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  fireEvent.click(await screen.findByText("Maria da Silva"));
}

// Configura liberações do paciente com retirado = 2 (previsto 4 − retirado 2
// já retirados) e avança pelo passo 1, selecionando a liberação no passo 2.
async function irParaQuantidade() {
  await selecionarPaciente();
  mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [liberacao()] });
  mocks.listarRetiradasAction.mockResolvedValue({
    ok: true,
    data: [retirada("r1", 2)],
  });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(await screen.findByRole("radio", { name: /Contínua/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

function avancar() {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RetiradaForm — fluxo em etapas", () => {
  it("exibe o fluxo com as etapas e o seletor de paciente", () => {
    renderizar();

    expect(screen.getByRole("dialog", { name: "Registrar retirada" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Buscar paciente por nome ou Gestor SUS" })
    ).toBeInTheDocument();
    const progresso = screen.getByLabelText("Progresso do registro de retirada");
    expect(within(progresso).getByText("Paciente")).toBeInTheDocument();
    expect(within(progresso).getByText("Liberação")).toBeInTheDocument();
    expect(within(progresso).getByText("Quantidade")).toBeInTheDocument();
    expect(within(progresso).getByText("Revisão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar retirada" })).not.toBeInTheDocument();
  });

  it("bloqueia avançar sem paciente selecionado", async () => {
    renderizar();

    avancar();

    expect(await screen.findByText("Selecione o paciente.")).toBeInTheDocument();
    expect(mocks.registrarRetiradaAction).not.toHaveBeenCalled();
  });

  it("bloqueia avançar da liberação sem selecionar uma liberação", async () => {
    renderizar();

    await selecionarPaciente();
    mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [liberacao()] });
    mocks.listarRetiradasAction.mockResolvedValue({ ok: true, data: [retirada("r1", 2)] });
    avancar();
    await screen.findByRole("radio", { name: /Contínua/ });
    avancar();

    expect(await screen.findByText("Selecione a liberação.")).toBeInTheDocument();
  });

  it("exibe Previsto e Retirado da liberação (a previsão não limita — Sprint 42)", async () => {
    renderizar();

    await selecionarPaciente();
    mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [liberacao()] });
    mocks.listarRetiradasAction.mockResolvedValue({ ok: true, data: [retirada("r1", 2)] });
    avancar();

    expect(await screen.findByText(/Previsto: 4 · Retirado: 2/)).toBeInTheDocument();
  });

  it("permite quantidade acima da previsão (previsão não bloqueia — Sprint 42)", async () => {
    renderizar();

    await irParaQuantidade();

    const input = screen.getByLabelText("Quantidade a retirar");
    fireEvent.change(input, { target: { value: "6" } });
    expect(input).toHaveValue(6);
  });

  it("envia ao servidor apenas os dados do negócio e registra com sucesso", async () => {
    renderizar();
    mocks.registrarRetiradaAction.mockResolvedValue({
      ok: true,
      data: retirada("rnova", 1),
    });

    await irParaQuantidade();
    avancar();

    // Revisão.
    expect(screen.getByRole("button", { name: "Registrar retirada" })).toBeInTheDocument();
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Contínua ·/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Previsto: .*Retirado:/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Registrar retirada" }));

    await waitFor(() => {
      expect(mocks.registrarRetiradaAction).toHaveBeenCalledWith({
        liberacaoId: "l1",
        pacienteId: "p1",
        quantidade: 1,
      });
    });
    expect(
      await screen.findByText("Retirada registrada com sucesso.")
    ).toBeInTheDocument();
  });

  it("exibe erro claro de saldo insuficiente sem código técnico", async () => {
    renderizar();
    mocks.registrarRetiradaAction.mockResolvedValue({
      ok: false,
      error: "Quantidade excede o saldo disponível da liberação (RN14).",
    });

    await irParaQuantidade();
    avancar();
    fireEvent.click(screen.getByRole("button", { name: "Registrar retirada" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A quantidade solicitada excede o saldo disponível para esta liberação."
    );
    expect(
      screen.getByRole("alert").textContent
    ).not.toMatch(/RN14/);
  });

  it("volta ao passo anterior sem perder a liberação selecionada", async () => {
    renderizar();

    await irParaQuantidade();
    avancar();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByRole("radio", { name: /Contínua/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });

  it("liberação com retirado acima do previsto CONTINUA selecionável (Sprint 42)", async () => {
    renderizar();

    await selecionarPaciente();
    mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [liberacao()] });
    mocks.listarRetiradasAction.mockResolvedValue({
      ok: true,
      data: [retirada("r1", 4)],
    });
    avancar();

    const radio = await screen.findByRole("radio", { name: /Contínua/ });
    expect(radio).not.toBeDisabled();
    expect(screen.getAllByText(/Previsto:/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/saldo esgotado/i)).not.toBeInTheDocument();
  });

  it("indica a etapa atual do stepper (Etapa X de 4)", async () => {
    renderizar();

    expect(screen.getByText("Etapa 1 de 4")).toBeInTheDocument();

    await selecionarPaciente();
    mocks.listarLiberacoesAction.mockResolvedValue({ ok: true, data: [liberacao()] });
    mocks.listarRetiradasAction.mockResolvedValue({ ok: true, data: [retirada("r1", 2)] });
    avancar();
    fireEvent.click(await screen.findByRole("radio", { name: /Contínua/ }));
    avancar();

    expect(screen.getByText("Etapa 3 de 4")).toBeInTheDocument();
  });

  it("foca o diálogo ao abrir e fecha por Escape (acessibilidade)", () => {
    const onClose = vi.fn();
    render(<RetiradaForm onClose={onClose} onSalvo={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Registrar retirada" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cicla o foco dentro do diálogo ao pressionar Tab (trap)", () => {
    render(<RetiradaForm onClose={() => {}} onSalvo={() => {}} />);

    const continuar = screen.getByRole("button", { name: "Continuar" });
    continuar.focus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: "Buscar paciente por nome ou Gestor SUS" })
    ).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(continuar).toHaveFocus();
  });
});