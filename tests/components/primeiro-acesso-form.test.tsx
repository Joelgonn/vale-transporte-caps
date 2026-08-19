// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrimeiroAcessoForm from "@/app/primeiro-acesso/primeiro-acesso-form";
import type { TrocarSenhaState } from "@/app/actions/primeiro-acesso";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    trocarSenha: vi.fn(),
  },
}));

vi.mock("@/app/actions/primeiro-acesso", () => ({
  trocarSenhaPrimeiroAcesso: (...args: unknown[]) =>
    mocks.trocarSenha(...args),
}));

const user = userEvent.setup();

function preencherValido() {
  fireEvent.change(screen.getByLabelText("Nova senha"), {
    target: { value: "nova-senha-forte" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
    target: { value: "nova-senha-forte" },
  });
}

beforeEach(() => {
  mocks.trocarSenha.mockReset();
  mocks.trocarSenha.mockImplementation(async () => ({}));
});

describe("PrimeiroAcessoForm", () => {
  it("renderiza os campos de senha com labels reais e autocomplete novo", () => {
    render(<PrimeiroAcessoForm />);
    const novaSenha = screen.getByLabelText("Nova senha");
    const confirmacao = screen.getByLabelText("Confirmar nova senha");
    expect(novaSenha).toHaveAttribute("type", "password");
    expect(novaSenha).toHaveAttribute("autocomplete", "new-password");
    expect(confirmacao).toHaveAttribute("type", "password");
    expect(confirmacao).toHaveAttribute("autocomplete", "new-password");
  });

  it("envia nova senha e confirmação para a action no submit", async () => {
    render(<PrimeiroAcessoForm />);
    preencherValido();
    await user.click(screen.getByRole("button", { name: "Definir nova senha" }));

    await waitFor(() => expect(mocks.trocarSenha).toHaveBeenCalledTimes(1));
    const [estado, formData] = mocks.trocarSenha.mock.calls[0];
    expect(estado).toEqual({});
    expect(formData.get("novaSenha")).toBe("nova-senha-forte");
    expect(formData.get("confirmacao")).toBe("nova-senha-forte");
  });

  it("valida campos vazios sem chamar a action", async () => {
    render(<PrimeiroAcessoForm />);
    await user.click(screen.getByRole("button", { name: "Definir nova senha" }));

    expect(await screen.findByText("Informe a nova senha.")).toBeInTheDocument();
    expect(
      await screen.findByText("Confirme a nova senha.")
    ).toBeInTheDocument();
    expect(mocks.trocarSenha).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nova senha")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("rejeita senha curta na validação client", async () => {
    render(<PrimeiroAcessoForm />);
    await user.type(screen.getByLabelText("Nova senha"), "12345");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "12345");
    await user.click(screen.getByRole("button", { name: "Definir nova senha" }));

    expect(
      await screen.findByText(/A senha deve ter pelo menos 8 caracteres\./)
    ).toBeInTheDocument();
    expect(mocks.trocarSenha).not.toHaveBeenCalled();
  });

  it("rejeita senhas diferentes", async () => {
    render(<PrimeiroAcessoForm />);
    await user.type(screen.getByLabelText("Nova senha"), "senha123456");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "outra123456");
    await user.click(screen.getByRole("button", { name: "Definir nova senha" }));

    expect(
      await screen.findByText("As senhas não coincidem.")
    ).toBeInTheDocument();
    expect(mocks.trocarSenha).not.toHaveBeenCalled();
  });

  it("exibe erro seguro vindo da action (role=alert)", async () => {
    mocks.trocarSenha.mockImplementation(async () => ({
      error: "Muitas tentativas seguidas. Aguarde um instante e tente novamente.",
    }));
    render(<PrimeiroAcessoForm />);
    preencherValido();
    await user.click(screen.getByRole("button", { name: "Definir nova senha" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/Muitas tentativas/);
  });

  it("mostra estado de carregamento durante o submit", async () => {
    let resolver: (value: TrocarSenhaState) => void = () => {};
    mocks.trocarSenha.mockImplementation(
      () =>
        new Promise<TrocarSenhaState>((resolve) => {
          resolver = resolve;
        })
    );

    render(<PrimeiroAcessoForm />);
    preencherValido();
    await user.click(screen.getByRole("button", { name: "Definir nova senha" }));

    const botao = await screen.findByRole("button", {
      name: "Definindo senha...",
    });
    expect(botao).toBeDisabled();
    expect(screen.getByLabelText("Nova senha")).toBeDisabled();
    expect(screen.getByLabelText("Confirmar nova senha")).toBeDisabled();
    resolver({});
  });

  it("alterna mostrar/ocultar senha", async () => {
    render(<PrimeiroAcessoForm />);
    const novaSenha = screen.getByLabelText("Nova senha");
    expect(novaSenha).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Nova senha")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveAttribute(
      "type",
      "text"
    );

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(screen.getByLabelText("Nova senha")).toHaveAttribute(
      "type",
      "password"
    );
  });

  it("não expõe informações sensíveis no HTML", () => {
    render(<PrimeiroAcessoForm />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(
      /SERVICE_ROLE|supabase\.co|postgres|auth\.users|token|senha temporária/i
    );
  });
});