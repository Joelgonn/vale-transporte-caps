// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PacienteForm from "@/app/dashboard/pacientes/components/paciente-form";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    criarPacienteAction: vi.fn(),
    atualizarPacienteAction: vi.fn(),
  },
}));

vi.mock("@/app/actions/pacientes", () => ({
  criarPacienteAction: (...args: unknown[]) => mocks.criarPacienteAction(...args),
  atualizarPacienteAction: (...args: unknown[]) =>
    mocks.atualizarPacienteAction(...args),
}));

function paciente(): PacienteSemCpf {
  return {
    id: "p1",
    gestor_sus: "123456",
    nome: "Maria da Silva",
    status: "ativo",
    data_inicio_acompanhamento: "2026-01-10",
    data_fim_acompanhamento: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PacienteForm — criar", () => {
  it("exibe os campos de cadastro (inclusive CPF opcional)", () => {
    render(<PacienteForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Novo paciente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Gestor SUS")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText(/CPF/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cadastrar" })
    ).toBeInTheDocument();
  });

  it("envia os dados preenchidos à action e mostra sucesso", async () => {
    mocks.criarPacienteAction.mockResolvedValue({
      ok: true,
      data: paciente(),
    });
    render(<PacienteForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    fireEvent.change(screen.getByLabelText("Gestor SUS"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Maria da Silva" },
    });
    fireEvent.change(screen.getByLabelText(/CPF/), {
      target: { value: "12345678900" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => {
      expect(mocks.criarPacienteAction).toHaveBeenCalledWith({
        gestor_sus: "123456",
        nome: "Maria da Silva",
        cpf: "12345678900",
        data_inicio_acompanhamento: null,
        data_fim_acompanhamento: null,
      });
    });
    expect(
      await screen.findByText("Paciente cadastrado com sucesso.")
    ).toBeInTheDocument();
  });

  it("exibe erro de validação retornado pela action", async () => {
    mocks.criarPacienteAction.mockResolvedValue({
      ok: false,
      error: "Já existe um paciente com este Gestor SUS (ou CPF).",
    });
    render(<PacienteForm modo="criar" onClose={() => {}} onSalvo={() => {}} />);

    fireEvent.change(screen.getByLabelText("Gestor SUS"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Maria" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um paciente com este Gestor SUS (ou CPF)."
    );
  });
});

describe("PacienteForm — editar", () => {
  it("não exibe campo de CPF nem de status na edição de dados", () => {
    render(
      <PacienteForm
        modo="editar"
        paciente={paciente()}
        onClose={() => {}}
        onSalvo={() => {}}
      />
    );

    expect(screen.getByRole("dialog", { name: "Editar paciente" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/CPF/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Status/i)).not.toBeInTheDocument();
  });

  it("pré-preenche os dados e envia apenas campos editáveis (sem cpf/status)", async () => {
    mocks.atualizarPacienteAction.mockResolvedValue({
      ok: true,
      data: paciente(),
    });
    render(
      <PacienteForm
        modo="editar"
        paciente={paciente()}
        onClose={() => {}}
        onSalvo={() => {}}
      />
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Maria da Silva");

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Maria Silva Atualizada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(mocks.atualizarPacienteAction).toHaveBeenCalledWith("p1", {
        nome: "Maria Silva Atualizada",
        data_inicio_acompanhamento: "2026-01-10",
        data_fim_acompanhamento: null,
      });
    });
    expect(
      await screen.findByText("Paciente atualizado com sucesso.")
    ).toBeInTheDocument();
  });
});
