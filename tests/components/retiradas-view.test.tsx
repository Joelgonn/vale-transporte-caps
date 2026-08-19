// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import RetiradasView from "@/app/dashboard/retiradas/components/retiradas-view";
import { PERFIS, TIPOS_LIBERACAO, type PerfilUsuario } from "@/lib/domain/enums";
import type { RetiradaComDetalhes } from "@/lib/domain/retiradas/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    refresh: vi.fn(),
    listarRetiradasAction: vi.fn(),
    registrarRetiradaAction: vi.fn(),
    listarLiberacoesAction: vi.fn(),
    listarPacientesAction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/retiradas", () => ({
  listarRetiradasAction: (...args: unknown[]) => mocks.listarRetiradasAction(...args),
  registrarRetiradaAction: (...args: unknown[]) => mocks.registrarRetiradaAction(...args),
}));

vi.mock("@/app/actions/liberacoes", () => ({
  listarLiberacoesAction: (...args: unknown[]) => mocks.listarLiberacoesAction(...args),
}));

vi.mock("@/app/actions/pacientes", () => ({
  listarPacientesAction: (...args: unknown[]) => mocks.listarPacientesAction(...args),
}));

function retirada(sobre?: Partial<RetiradaComDetalhes>): RetiradaComDetalhes {
  return {
    id: "r1",
    liberacao_id: "l1",
    paciente_id: "p1",
    recepcionista_id: "u1",
    quantidade: 2,
    data_hora: "2026-01-05T10:30:00.000000+00:00",
    unidade_id: null,
    paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    liberacao: {
      id: "l1",
      tipo: TIPOS_LIBERACAO.CONTINUA,
      quantidade: 4,
      data_inicio: "2026-01-01T00:00:00.000Z",
      data_fim: "2026-04-01T00:00:00.000Z",
    },
    recepcionista: { id: "u1", nome: "João Recep" },
    ...sobre,
  };
}

function renderizar(opts: {
  perfil: PerfilUsuario;
  statusAtivo?: boolean;
  retiradas?: RetiradaComDetalhes[];
  erroInicial?: string | null;
}) {
  return render(
    <RetiradasView
      perfil={opts.perfil}
      statusAtivo={opts.statusAtivo ?? true}
      retiradasIniciais={opts.retiradas ?? [retirada()]}
      erroInicial={opts.erroInicial ?? null}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RetiradasView — leitura", () => {
  it("exibe a lista com dados prioritários (paciente, liberação, quantidade, data/hora)", () => {
    renderizar({ perfil: PERFIS.GESTOR });

    expect(screen.getByRole("heading", { name: "Retiradas" })).toBeInTheDocument();
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gestor SUS 123456").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contínua · 4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("05/01/2026 10:30").length).toBeGreaterThan(0);
  });

  it("gestor vê a coluna de responsável com o nome do recepcionista", () => {
    renderizar({ perfil: PERFIS.GESTOR });

    expect(screen.getAllByText("João Recep").length).toBeGreaterThan(0);
  });

  it("recepcionista NÃO vê a coluna de responsável (RLS usuarios só p/ gestor)", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });

    expect(screen.queryByText("Responsável")).not.toBeInTheDocument();
    expect(screen.queryByText("João Recep")).not.toBeInTheDocument();
  });

  it("liberação não visível (RLS) cai em placeholder sem quebrar", () => {
    renderizar({
      perfil: PERFIS.RECEPCIONISTA,
      retiradas: [retirada({ liberacao: null })],
    });

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
  });

  it("estado vazio", () => {
    renderizar({ perfil: PERFIS.GESTOR, retiradas: [] });
    expect(screen.getByText("Nenhuma retirada registrada ainda.")).toBeInTheDocument();
  });

  it("erro inicial é exibido sem tela branca", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      erroInicial: "Não foi possível carregar as retiradas.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as retiradas."
    );
  });

  it("CPF não aparece na listagem", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    expect(screen.queryByText(/12345678900/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cpf/i)).not.toBeInTheDocument();
  });

  it("exibe o contador de resultados", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      retiradas: [retirada({ id: "a" }), retirada({ id: "b" })],
    });
    expect(screen.getByText("2 retiradas registradas.")).toBeInTheDocument();
  });
});

describe("RetiradasView — permissões por perfil (política de UI)", () => {
  it("recepcionista recebe o botão 'Registrar retirada'", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });
    expect(screen.getByRole("button", { name: "Registrar retirada" })).toBeInTheDocument();
  });

  it("gestor é somente leitura (sem ação de registro)", () => {
    renderizar({ perfil: PERFIS.GESTOR });
    expect(screen.queryByRole("button", { name: "Registrar retirada" })).not.toBeInTheDocument();
  });
});

describe("RetiradasView — interações", () => {
  it("recepcionista abre o diálogo de registro de retirada", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });

    fireEvent.click(screen.getByRole("button", { name: "Registrar retirada" }));

    expect(screen.getByRole("dialog", { name: "Registrar retirada" })).toBeInTheDocument();
  });

  it("mostra feedback de sucesso e atualiza a lista após registrar", async () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });

    fireEvent.click(screen.getByRole("button", { name: "Registrar retirada" }));
    const dialog = screen.getByRole("dialog", { name: "Registrar retirada" });

    // Passo 1 — seleciona o paciente.
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Buscar paciente por nome ou Gestor SUS" })
    );
    fireEvent.change(within(dialog).getByLabelText("Buscar paciente"), {
      target: { value: "maria" },
    });
    mocks.listarPacientesAction.mockResolvedValue({
      ok: true,
      data: [{ id: "p1", gestor_sus: "123456", nome: "Maria da Silva", status: "ativo" }],
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buscar" }));
    fireEvent.click(await within(dialog).findByText("Maria da Silva"));

    // Passo 2 — carrega liberações + retiradas e seleciona a liberação.
    mocks.listarLiberacoesAction.mockResolvedValue({
      ok: true,
      data: [
        {
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
        },
      ],
    });
    mocks.listarRetiradasAction.mockResolvedValue({
      ok: true,
      data: [retirada()],
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Contínua/ }));

    // Passo 3 — quantidade já pré-selecionada em 1; segue para revisão.
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));

    // Passo 4 — registra.
    mocks.registrarRetiradaAction.mockResolvedValue({ ok: true, data: retirada() });
    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar retirada" }));
    await within(dialog).findByText("Retirada registrada com sucesso.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Concluir" }));

    expect(mocks.registrarRetiradaAction).toHaveBeenCalledWith({
      liberacaoId: "l1",
      pacienteId: "p1",
      quantidade: 1,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Retirada registrada com sucesso."
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});