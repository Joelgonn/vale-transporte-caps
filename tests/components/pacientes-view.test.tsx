// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PacientesView from "@/app/dashboard/pacientes/components/pacientes-view";
import { PERFIS, type PerfilUsuario } from "@/lib/domain/enums";
import type { PacienteSemCpf } from "@/lib/domain/pacientes/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    refresh: vi.fn(),
    atualizarPacienteAction: vi.fn(),
    criarPacienteAction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/pacientes", () => ({
  atualizarPacienteAction: (...args: unknown[]) =>
    mocks.atualizarPacienteAction(...args),
  criarPacienteAction: (...args: unknown[]) => mocks.criarPacienteAction(...args),
}));

function paciente(sobre?: Partial<PacienteSemCpf>): PacienteSemCpf {
  return {
    id: "p1",
    gestor_sus: "123456",
    nome: "Maria da Silva",
    status: "ativo",
    origem: "regular",
    data_inicio_acompanhamento: "2026-01-10",
    data_fim_acompanhamento: null,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

function renderizar(opts: {
  perfil: PerfilUsuario;
  statusAtivo?: boolean;
  busca?: string;
  pacientes?: PacienteSemCpf[];
  erroInicial?: string | null;
}) {
  return render(
    <PacientesView
      perfil={opts.perfil}
      statusAtivo={opts.statusAtivo ?? true}
      busca={opts.busca ?? ""}
      pacientesIniciais={opts.pacientes ?? [paciente()]}
      erroInicial={opts.erroInicial ?? null}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PacientesView — leitura", () => {
  it("usuário autenticado carrega a página e vê a lista de pacientes", () => {
    renderizar({ perfil: PERFIS.GESTOR, pacientes: [paciente()] });

    expect(screen.getByRole("heading", { name: "Pacientes" })).toBeInTheDocument();
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.getByText("123456")).toBeInTheDocument();
  });

  it("exibe o status ATIVO/INATIVO com os enums canônicos", () => {
    renderizar({
      perfil: PERFIS.RECEPCIONISTA,
      pacientes: [
        paciente({ id: "a", status: "ativo" }),
        paciente({ id: "b", status: "inativo" }),
      ],
    });

    expect(screen.getAllByText("ATIVO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("INATIVO").length).toBeGreaterThan(0);
  });

  it("pesquisa repassada pela URL aparece no campo e a lista já vem filtrada do servidor", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      busca: "maria",
      pacientes: [paciente()],
    });

    const campo = screen.getByLabelText("Buscar pacientes por nome ou Gestor SUS");
    expect(campo).toHaveValue("maria");
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.queryByText("João Oliveira")).not.toBeInTheDocument();
  });

  it("exibe o contador de resultados", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacientes: [paciente({ id: "a" }), paciente({ id: "b" })],
    });
    expect(screen.getByText("2 pacientes cadastrados.")).toBeInTheDocument();
  });

  it("estado vazio sem busca", () => {
    renderizar({ perfil: PERFIS.GESTOR, pacientes: [] });

    expect(screen.getByText("Nenhum paciente cadastrado ainda.")).toBeInTheDocument();
  });

  it("estado vazio de pesquisa", () => {
    renderizar({ perfil: PERFIS.GESTOR, busca: "xyz", pacientes: [] });

    expect(
      screen.getByText("Nenhum paciente encontrado para esta busca.")
    ).toBeInTheDocument();
  });

  it("erro inicial é exibido sem tela branca", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      erroInicial: "Não foi possível carregar os pacientes.",
    });

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent("Não foi possível carregar os pacientes.");
  });

  it("CPF não aparece na listagem", () => {
    renderizar({ perfil: PERFIS.GESTOR, pacientes: [paciente()] });

    expect(screen.queryByText(/12345678900/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cpf/i)).not.toBeInTheDocument();
  });
});

describe("PacientesView — permissões por perfil (política de UI)", () => {
  it("recepcionista recebe SOMENTE o botão de paciente esporádico", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });

    expect(screen.getByRole("button", { name: "Paciente Esporádico" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo paciente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reativar" })).not.toBeInTheDocument();
  });

  it("profissional autorizador recebe cadastro regular e edição, sem alteração de status", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });

    expect(screen.getByRole("button", { name: "Novo paciente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Paciente Esporádico" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Editar" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Inativar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reativar" })).not.toBeInTheDocument();
  });

  it("gestor recebe cadastro regular e controle de status, mas não edição de dados", () => {
    renderizar({ perfil: PERFIS.GESTOR });

    expect(screen.getByRole("button", { name: "Novo paciente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Paciente Esporádico" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Inativar" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});

describe("PacientesView — interações", () => {
  it("autorizador abre o formulário de novo paciente (origem regular)", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });

    fireEvent.click(screen.getByRole("button", { name: "Novo paciente" }));

    expect(
      screen.getByRole("dialog", { name: "Novo paciente" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Gestor SUS")).toBeInTheDocument();
  });

  it("recepcionista abre o formulário de paciente esporádico", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });

    fireEvent.click(screen.getByRole("button", { name: "Paciente Esporádico" }));

    expect(
      screen.getByRole("dialog", { name: "Paciente esporádico" })
    ).toBeInTheDocument();
  });

  it("paciente esporádico é exibido com o selo de origem", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      pacientes: [paciente({ id: "p2", origem: "esporadico", nome: "José" })],
    });

    expect(screen.getAllByText("Esporádico").length).toBeGreaterThan(0);
  });

  it("autorizador abre o formulário de edição preenchido", () => {
    renderizar({
      perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
      pacientes: [paciente({ id: "p9", gestor_sus: "999", nome: "João" })],
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);

    const dialog = screen.getByRole("dialog", { name: "Editar paciente" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("João");
    expect(screen.getByLabelText("Gestor SUS")).toHaveValue("999");
  });

  it("gestor altera status e mostra feedback de sucesso transitório", async () => {
    mocks.atualizarPacienteAction.mockResolvedValue({
      ok: true,
      data: paciente({ status: "inativo" }),
    });
    renderizar({ perfil: PERFIS.GESTOR });

    fireEvent.click(screen.getAllByRole("button", { name: "Inativar" })[0]);

    await waitFor(() => {
      expect(mocks.atualizarPacienteAction).toHaveBeenCalledWith("p1", {
        status: "inativo",
      });
    });
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole("status")
    ).toHaveTextContent("Paciente inativado com sucesso.");
  });

  it("exibe erro amigável quando a alteração de status falha", async () => {
    mocks.atualizarPacienteAction.mockResolvedValue({
      ok: false,
      error: "Não foi possível atualizar o paciente.",
    });
    renderizar({ perfil: PERFIS.GESTOR });

    fireEvent.click(screen.getAllByRole("button", { name: "Inativar" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível atualizar o paciente."
    );
  });

  it("mobile-first: exibe os cards de paciente (além da tabela desktop)", () => {
    renderizar({ perfil: PERFIS.GESTOR, pacientes: [paciente()] });

    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Gestor SUS 123456").length).toBeGreaterThan(0);
  });
});
