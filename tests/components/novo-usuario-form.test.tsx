// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NovoUsuarioForm from "@/app/dashboard/usuarios/components/novo-usuario-form";
import { PERFIS, PROFISSOES } from "@/lib/domain/enums";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    criarUsuarioCompletoAction: vi.fn(),
  },
}));

vi.mock("@/app/actions/usuarios", () => ({
  criarUsuarioCompletoAction: (...args: unknown[]) =>
    mocks.criarUsuarioCompletoAction(...args),
}));

function renderizar(opts?: { onClose?: () => void; onSalvo?: () => void }) {
  return render(
    <NovoUsuarioForm
      onClose={opts?.onClose ?? (() => {})}
      onSalvo={opts?.onSalvo ?? (() => {})}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NovoUsuarioForm — campos e perfil", () => {
  it("exibe os campos obrigatórios e a seleção de perfil", () => {
    renderizar();

    expect(screen.getByRole("dialog", { name: "Novo usuário" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Perfil")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar usuário" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("perfil profissional autorizador exibe a profissão; recepcionista não", () => {
    renderizar();

    expect(screen.queryByLabelText("Profissão")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Perfil"), {
      target: { value: PERFIS.PROFISSIONAL_AUTORIZADOR },
    });

    expect(screen.getByLabelText("Profissão")).toBeInTheDocument();
  });

  it("não expõe nenhum campo interno do Auth (auth_user_id/senha)", () => {
    renderizar();

    expect(screen.queryByLabelText(/auth_user_id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/definir senha/i)).not.toBeInTheDocument();
  });
});

describe("NovoUsuarioForm — envio e feedback", () => {
  it("envia os dados à action (sem auth_user_id vindo do cliente) e mostra sucesso", async () => {
    mocks.criarUsuarioCompletoAction.mockResolvedValue({
      ok: true,
      data: {
        usuario: {
          id: "u1",
          auth_user_id: "auth-9",
          nome: "Ana Souza",
          email: "ana@example.com",
          perfil: PERFIS.RECEPCIONISTA,
          profissao: null,
          status_ativo: true,
          unidade_id: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        senhaTemporaria: "AbCdEfGh12345678",
      },
    });
    renderizar();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Souza" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    await waitFor(() => {
      expect(mocks.criarUsuarioCompletoAction).toHaveBeenCalledWith({
        nome: "Ana Souza",
        email: "ana@example.com",
        perfil: PERFIS.RECEPCIONISTA,
        profissao: null,
      });
    });

    expect(await screen.findByText("Usuário criado com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("AbCdEfGh12345678")).toBeInTheDocument();
    expect(screen.getByText(/exibida uma única vez/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument();
  });

  it("autorizador envia a profissão selecionada", async () => {
    mocks.criarUsuarioCompletoAction.mockResolvedValue({
      ok: true,
      data: {
        usuario: {
          id: "u2",
          auth_user_id: "auth-10",
          nome: "Dr. Souza",
          email: "souza@example.com",
          perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
          profissao: PROFISSOES.PSICOLOGO,
          status_ativo: true,
          unidade_id: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        senhaTemporaria: "senha-temp-1234",
      },
    });
    renderizar();

    fireEvent.change(screen.getByLabelText("Perfil"), {
      target: { value: PERFIS.PROFISSIONAL_AUTORIZADOR },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Dr. Souza" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "souza@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Profissão"), {
      target: { value: PROFISSOES.PSICOLOGO },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    await waitFor(() => {
      expect(mocks.criarUsuarioCompletoAction).toHaveBeenCalledWith({
        nome: "Dr. Souza",
        email: "souza@example.com",
        perfil: PERFIS.PROFISSIONAL_AUTORIZADOR,
        profissao: PROFISSOES.PSICOLOGO,
      });
    });
  });

  it("valida no cliente: nome e e-mail obrigatórios bloqueiam o envio", async () => {
    renderizar();

    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    expect(await screen.findByText("Informe o nome do usuário.")).toBeInTheDocument();
    expect(screen.getByText("Informe o e-mail.")).toBeInTheDocument();
    expect(mocks.criarUsuarioCompletoAction).not.toHaveBeenCalled();
  });

  it("valida formato do e-mail no cliente", async () => {
    renderizar();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "sem-arroba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(mocks.criarUsuarioCompletoAction).not.toHaveBeenCalled();
  });

  it("exibe erro da action em role=alert", async () => {
    mocks.criarUsuarioCompletoAction.mockResolvedValue({
      ok: false,
      error: "Já existe uma conta para este e-mail.",
    });
    renderizar();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe uma conta para este e-mail."
    );
  });

  it("mostra estado de carregamento enquanto cria", async () => {
    let resolver!: (v: { ok: boolean }) => void;
    mocks.criarUsuarioCompletoAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        })
    );
    renderizar();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    expect(await screen.findByRole("button", { name: "Criando..." })).toBeInTheDocument();
    resolver({ ok: false, error: "" } as never);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Criando..." })).not.toBeInTheDocument();
    });
  });

  it("cancelar fecha o formulário (onClose)", () => {
    const onClose = vi.fn();
    renderizar({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("foca o diálogo ao abrir e fecha por Escape (acessibilidade)", () => {
    const onClose = vi.fn();
    renderizar({ onClose });

    expect(screen.getByRole("dialog", { name: "Novo usuário" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("não fecha por Escape após sucesso (senha temporária exibida)", async () => {
    const onClose = vi.fn();
    mocks.criarUsuarioCompletoAction.mockResolvedValue({
      ok: true,
      data: {
        usuario: {
          id: "u4",
          auth_user_id: "auth-12",
          nome: "Ana",
          email: "ana@example.com",
          perfil: PERFIS.RECEPCIONISTA,
          profissao: null,
          status_ativo: true,
          unidade_id: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        senhaTemporaria: "senha-16chars",
      },
    });
    renderizar({ onClose });

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    await screen.findByText("Usuário criado com sucesso.");
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Concluir chama onSalvo (fecha e atualiza a lista)", async () => {
    const onSalvo = vi.fn();
    mocks.criarUsuarioCompletoAction.mockResolvedValue({
      ok: true,
      data: {
        usuario: {
          id: "u3",
          auth_user_id: "auth-11",
          nome: "Ana",
          email: "ana@example.com",
          perfil: PERFIS.RECEPCIONISTA,
          profissao: null,
          status_ativo: true,
          unidade_id: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        senhaTemporaria: "senha-16chars",
      },
    });
    renderizar({ onSalvo });

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    fireEvent.click(await screen.findByRole("button", { name: "Concluir" }));

    expect(onSalvo).toHaveBeenCalledOnce();
  });
});
