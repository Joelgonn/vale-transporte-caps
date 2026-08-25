// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LiberacaoEditForm from "@/app/dashboard/liberacoes/components/liberacao-edit-form";
import { PERFIS, type PerfilUsuario } from "@/lib/domain/enums";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    atualizarLiberacaoAction: vi.fn(),
  },
}));

vi.mock("@/app/actions/liberacoes", () => ({
  atualizarLiberacaoAction: (...args: unknown[]) =>
    mocks.atualizarLiberacaoAction(...args),
}));

function liberacao(): LiberacaoComPaciente {
  return {
    id: "l1",
    paciente_id: "p1",
    tipo: "continua",
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

function renderizar(perfil: PerfilUsuario = PERFIS.PROFISSIONAL_AUTORIZADOR) {
  return render(
    <LiberacaoEditForm
      liberacao={liberacao()}
      perfil={perfil}
      onClose={() => {}}
      onSalvo={() => {}}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.atualizarLiberacaoAction.mockResolvedValue({ ok: true, data: liberacao() });
});

describe("LiberacaoEditForm — calculadora de previsão (Sprint 42.1)", () => {
  it("calculadora preenche a quantidade em tempo real (4×2×12 semanas = 96)", async () => {
    renderizar();

    expect(screen.getByLabelText("Quantidade prevista")).toHaveValue(4);

    fireEvent.change(screen.getByLabelText("Vales por dia"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Dias por semana"), { target: { value: "2" } });

    await waitFor(() => {
      expect(screen.getByLabelText("Quantidade prevista")).toHaveValue(96);
    });
    expect(screen.getByText(/Previsão total/)).toBeInTheDocument();
  });

  it("edição manual da quantidade permanece possível após o preenchimento", async () => {
    renderizar();

    fireEvent.change(screen.getByLabelText("Vales por dia"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Dias por semana"), { target: { value: "2" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Quantidade prevista")).toHaveValue(96);
    });

    fireEvent.change(screen.getByLabelText("Quantidade prevista"), {
      target: { value: "50" },
    });
    expect(screen.getByLabelText("Quantidade prevista")).toHaveValue(50);
  });

  it("payload persistido contém SOMENTE campos permitidos — sem parâmetros da calculadora", async () => {
    renderizar();

    fireEvent.change(screen.getByLabelText("Vales por dia"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Dias por semana"), { target: { value: "2" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Quantidade prevista")).toHaveValue(96);
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(mocks.atualizarLiberacaoAction).toHaveBeenCalledTimes(1);
    });

    const [id, dados] = mocks.atualizarLiberacaoAction.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe("l1");
    expect(dados["quantidade"]).toBe(96);
    expect(dados).not.toHaveProperty("valesPorDia");
    expect(dados).not.toHaveProperty("diasPorSemana");
    // apenas campos da whitelist do autorizador (datas fazem parte do form)
    expect(Object.keys(dados).sort()).toEqual(
      ["data_fim", "data_inicio", "quantidade"].sort()
    );
  });

  it("edição funciona normalmente SEM usar a calculadora", async () => {
    renderizar();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(mocks.atualizarLiberacaoAction).toHaveBeenCalledWith("l1", {
        quantidade: 4,
        data_inicio: "2026-01-01",
        data_fim: "2026-04-01",
      });
    });
  });

  it("gestor NÃO vê calculadora nem quantidade — apenas status", () => {
    renderizar(PERFIS.GESTOR);

    expect(
      screen.queryByLabelText("Calculadora de previsão")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade prevista")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });
});
