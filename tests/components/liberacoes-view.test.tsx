// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import LiberacoesView from "@/app/dashboard/liberacoes/components/liberacoes-view";
import {
  PERFIS,
  TIPOS_LIBERACAO,
  type PerfilUsuario,
} from "@/lib/domain/enums";
import type { LiberacaoComPaciente } from "@/lib/domain/liberacoes/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    refresh: vi.fn(),
    criarLiberacaoAction: vi.fn(),
    listarPacientesAction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/liberacoes", () => ({
  criarLiberacaoAction: (...args: unknown[]) => mocks.criarLiberacaoAction(...args),
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
    paciente: { id: "p1", gestor_sus: "123456", nome: "Maria da Silva" },
    ...sobre,
  };
}

function renderizar(opts: {
  perfil: PerfilUsuario;
  statusAtivo?: boolean;
  busca?: string;
  liberacoes?: LiberacaoComPaciente[];
  erroInicial?: string | null;
}) {
  return render(
    <LiberacoesView
      perfil={opts.perfil}
      statusAtivo={opts.statusAtivo ?? true}
      busca={opts.busca ?? ""}
      liberacoesIniciais={opts.liberacoes ?? [liberacao()]}
      erroInicial={opts.erroInicial ?? null}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LiberacoesView — leitura", () => {
  it("carrega a página e exibe a lista com dados prioritários (paciente, tipo, quantidade, período)", () => {
    renderizar({ perfil: PERFIS.GESTOR });

    expect(screen.getByRole("heading", { name: "Liberações" })).toBeInTheDocument();
    expect(screen.getAllByText("Maria da Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gestor SUS 123456").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contínua").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("01/01/2026 – 01/04/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ativa").length).toBeGreaterThan(0);
  });

  it("exibe os status canônicos (Ativa/Expirada/Cancelada)", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      liberacoes: [
        liberacao({ id: "a", status: "ativa" }),
        liberacao({ id: "b", status: "expirada" }),
        liberacao({ id: "c", status: "cancelada" }),
      ],
    });

    expect(screen.getAllByText("Ativa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expirada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cancelada").length).toBeGreaterThan(0);
  });

  it("busca repassada pela URL aparece no campo; a filtragem é do servidor", () => {
    renderizar({ perfil: PERFIS.GESTOR, busca: "maria" });

    const campo = screen.getByLabelText("Buscar liberações por paciente ou Gestor SUS");
    expect(campo).toHaveValue("maria");
  });

  it("estado vazio sem busca", () => {
    renderizar({ perfil: PERFIS.GESTOR, liberacoes: [] });
    expect(screen.getByText("Nenhuma liberação registrada ainda.")).toBeInTheDocument();
  });

  it("estado vazio de pesquisa", () => {
    renderizar({ perfil: PERFIS.GESTOR, busca: "xyz", liberacoes: [] });
    expect(
      screen.getByText("Nenhuma liberação encontrada para esta busca.")
    ).toBeInTheDocument();
  });

  it("erro inicial é exibido sem tela branca", () => {
    renderizar({
      perfil: PERFIS.GESTOR,
      erroInicial: "Não foi possível carregar as liberações.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as liberações."
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
      liberacoes: [
        liberacao({ id: "a", status: "ativa" }),
        liberacao({ id: "b", status: "expirada" }),
        liberacao({ id: "c", status: "cancelada" }),
      ],
    });
    expect(screen.getByText("3 liberações registradas.")).toBeInTheDocument();
  });
});

describe("LiberacoesView — permissões por perfil (política de UI)", () => {
  it("autorizador recebe 'Nova liberação', mas não 'Renovar'", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });

    expect(screen.getByRole("button", { name: "Nova liberação" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renovar" })).not.toBeInTheDocument();
  });

  it("recepcionista NÃO recebe 'Nova liberação' — Sprint47 (usa Atendimento para avulsa)", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });
    expect(screen.queryByRole("button", { name: "Nova liberação" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo atendimento" })).toHaveAttribute("href", "/dashboard/atendimento");
  });

  it("recepcionista recebe 'Renovar' apenas para liberações ativas", () => {
    renderizar({
      perfil: PERFIS.RECEPCIONISTA,
      liberacoes: [
        liberacao({ id: "ativa", status: "ativa" }),
        liberacao({ id: "exp", status: "expirada" }),
      ],
    });

    // Cada liberação ativa renderiza "Renovar" na tabela (desktop) e no card (mobile).
    expect(screen.getAllByRole("button", { name: "Renovar" })).toHaveLength(2);
  });

  it("gestor TAMBÉM recebe 'Nova liberação' mas não Renovar — Sprint44", () => {
    renderizar({ perfil: PERFIS.GESTOR });

    expect(screen.getByRole("button", { name: "Nova liberação" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renovar" })).not.toBeInTheDocument();
  });
});

describe("LiberacoesView — interações", () => {
  it("autorizador abre o diálogo de nova liberação", () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });

    fireEvent.click(screen.getByRole("button", { name: "Nova liberação" }));

    expect(screen.getByRole("dialog", { name: "Nova liberação" })).toBeInTheDocument();
  });

  it("recepcionista abre o diálogo de renovação a partir de uma liberação ativa", () => {
    renderizar({ perfil: PERFIS.RECEPCIONISTA });

    fireEvent.click(screen.getAllByRole("button", { name: "Renovar" })[0]);

    expect(screen.getByRole("dialog", { name: "Renovar liberação" })).toBeInTheDocument();
  });

  it("mostra feedback de sucesso e atualiza a lista após criar uma liberação", async () => {
    renderizar({ perfil: PERFIS.PROFISSIONAL_AUTORIZADOR });
    mocks.criarLiberacaoAction.mockResolvedValue({ ok: true, data: liberacao() });

    fireEvent.click(screen.getByRole("button", { name: "Nova liberação" }));

    const dialog = screen.getByRole("dialog", { name: "Nova liberação" });
    mocks.listarPacientesAction.mockResolvedValue({
      ok: true,
      data: [
        { id: "p1", gestor_sus: "123456", nome: "Maria da Silva", status: "ativo" },
      ],
    });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Paciente" }), {
      target: { value: "maria" },
    });
    fireEvent.click(await within(dialog).findByText("Maria da Silva"));

    for (let i = 0; i < 3; i++) {
      fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar liberação" }));
    await within(dialog).findByText("Liberação criada com sucesso.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Concluir" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Liberação criada com sucesso."
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
