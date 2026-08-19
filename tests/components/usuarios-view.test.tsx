// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UsuariosView from "@/app/dashboard/usuarios/components/usuarios-view";
import { PERFIS, PROFISSOES } from "@/lib/domain/enums";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    refresh: vi.fn(),
    ativarUsuarioAction: vi.fn(),
    inativarUsuarioAction: vi.fn(),
    criarUsuarioCompletoAction: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/usuarios", () => ({
  ativarUsuarioAction: (...args: unknown[]) => mocks.ativarUsuarioAction(...args),
  inativarUsuarioAction: (...args: unknown[]) => mocks.inativarUsuarioAction(...args),
  criarUsuarioCompletoAction: (...args: unknown[]) =>
    mocks.criarUsuarioCompletoAction(...args),
}));

function usuario(sobre?: Partial<UsuarioFuncional>): UsuarioFuncional {
  return {
    id: "u1",
    auth_user_id: "a1",
    nome: "João da Silva",
    email: "joao@example.com",
    perfil: PERFIS.RECEPCIONISTA,
    profissao: null,
    status_ativo: true,
    unidade_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...sobre,
  };
}

function renderizar(opts: {
  busca?: string;
  usuarios?: UsuarioFuncional[];
  erroInicial?: string | null;
}) {
  return render(
    <UsuariosView
      busca={opts.busca ?? ""}
      usuariosIniciais={opts.usuarios ?? [usuario()]}
      erroInicial={opts.erroInicial ?? null}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsuariosView — leitura", () => {
  it("exibe a lista com nome, e-mail, perfil, profissão e status", () => {
    renderizar({
      usuarios: [
        usuario({
          id: "u1",
          nome: "João da Silva",
          email: "joao@example.com",
          perfil: PERFIS.GESTOR,
          status_ativo: true,
        }),
        usuario({
          id: "u2",
          nome: "Ana Souza",
          email: "ana@example.com",
          perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
          profissao: PROFISSOES.PSICOLOGO,
          status_ativo: false,
        }),
      ],
    });

    expect(screen.getByRole("heading", { name: "Usuários" })).toBeInTheDocument();
    expect(screen.getByText("João da Silva")).toBeInTheDocument();
    expect(screen.getByText("Gestor")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Profissional autorizador")).toBeInTheDocument();
    expect(screen.getByText("Psicólogo(a)")).toBeInTheDocument();
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
    expect(screen.getByText("INATIVO")).toBeInTheDocument();
  });

  it("profissão ausente é exibida como em-dash", () => {
    renderizar({ usuarios: [usuario({ perfil: PERFIS.RECEPCIONISTA, profissao: null })] });

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("pesquisa repassada pela URL aparece no campo", () => {
    renderizar({ busca: "maria", usuarios: [usuario()] });

    const campo = screen.getByLabelText("Buscar usuários por nome ou e-mail");
    expect(campo).toHaveValue("maria");
  });

  it("estado vazio sem busca", () => {
    renderizar({ usuarios: [] });

    expect(screen.getByText("Nenhum usuário cadastrado ainda.")).toBeInTheDocument();
  });

  it("estado vazio de pesquisa", () => {
    renderizar({ busca: "xyz", usuarios: [] });

    expect(screen.getByText("Nenhum usuário encontrado para esta busca.")).toBeInTheDocument();
  });

  it("erro inicial é exibido sem tela branca", () => {
    renderizar({ erroInicial: "Não foi possível carregar os usuários." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os usuários."
    );
  });

  it("não exibe nenhum campo interno de autenticação (auth_user_id)", () => {
    renderizar({ usuarios: [usuario({ auth_user_id: "a-1" })] });

    expect(screen.queryByText("a-1")).not.toBeInTheDocument();
  });
});

describe("UsuariosView — alternância de status (somente Gestor ativo renderiza esta view)", () => {
  it("usuário ativo exibe botão Inativar", () => {
    renderizar({ usuarios: [usuario({ status_ativo: true })] });

    expect(screen.getByRole("button", { name: "Inativar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reativar" })).not.toBeInTheDocument();
  });

  it("usuário inativo exibe botão Reativar", () => {
    renderizar({ usuarios: [usuario({ status_ativo: false })] });

    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar" })).not.toBeInTheDocument();
  });

  it("Inativar chama inativarUsuarioAction e atualiza a página", async () => {
    mocks.inativarUsuarioAction.mockResolvedValue({
      ok: true,
      data: usuario({ status_ativo: false }),
    });
    renderizar({ usuarios: [usuario({ id: "u9", status_ativo: true })] });

    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));

    await waitFor(() => {
      expect(mocks.inativarUsuarioAction).toHaveBeenCalledWith("u9");
    });
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
  });

  it("Reativar chama ativarUsuarioAction", async () => {
    mocks.ativarUsuarioAction.mockResolvedValue({
      ok: true,
      data: usuario({ status_ativo: true }),
    });
    renderizar({ usuarios: [usuario({ id: "u9", status_ativo: false })] });

    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));

    await waitFor(() => {
      expect(mocks.ativarUsuarioAction).toHaveBeenCalledWith("u9");
    });
  });

  it("erro retornado pela action aparece em role=alert", async () => {
    mocks.inativarUsuarioAction.mockResolvedValue({
      ok: false,
      error: "Somente o Gestor ativo pode gerenciar usuários.",
    });
    renderizar({ usuarios: [usuario({ status_ativo: true })] });

    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Gestor");
    });
  });
});

describe("UsuariosView — criação de usuário (Sprint 16)", () => {
  it("exibe o botão Novo usuário e abre o formulário", () => {
    renderizar({ usuarios: [] });

    const botao = screen.getByRole("button", { name: "Novo usuário" });
    expect(botao).toBeInTheDocument();

    fireEvent.click(botao);

    expect(screen.getByRole("dialog", { name: "Novo usuário" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("após criar e concluir, fecha o formulário e atualiza a lista", async () => {
    mocks.criarUsuarioCompletoAction.mockResolvedValue({
      ok: true,
      data: {
        usuario: usuario({ id: "u-novo", nome: "Novo Usuário" }),
        senhaTemporaria: "senha-16chars",
      },
    });
    renderizar({ usuarios: [usuario()] });

    fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Novo Usuário" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "novo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    fireEvent.click(await screen.findByRole("button", { name: "Concluir" }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(screen.queryByRole("dialog", { name: "Novo usuário" })).not.toBeInTheDocument();
  });
});