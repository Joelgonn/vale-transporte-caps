// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "@/app/login/login-form";
import type { LoginState } from "@/app/actions/auth";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    login: vi.fn(),
  },
}));

vi.mock("@/app/actions/auth", () => ({
  login: (...args: unknown[]) => mocks.login(...args),
}));

const user = userEvent.setup();

async function preencherValido() {
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "gestor@caps.local" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "senha-segura" },
  });
}

beforeEach(() => {
  mocks.login.mockReset();
  mocks.login.mockImplementation(async () => ({}));
});

describe("LoginForm", () => {
  it("renderiza os campos de e-mail e senha com labels reais (não placeholder)", () => {
    render(<LoginForm />);
    const email = screen.getByLabelText("E-mail");
    const senha = screen.getByLabelText("Senha");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(senha).toHaveAttribute("type", "password");
    expect(senha).toHaveAttribute("autocomplete", "current-password");
  });

  it("envia os dados para a action de login no submit", async () => {
    render(<LoginForm />);
    await preencherValido();
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    const [estado, formData] = mocks.login.mock.calls[0];
    expect(estado).toEqual({});
    expect(formData.get("email")).toBe("gestor@caps.local");
    expect(formData.get("password")).toBe("senha-segura");
  });

  it("valida campos vazios sem chamar a action", async () => {
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe o e-mail.")).toBeInTheDocument();
    expect(await screen.findByText("Informe a senha.")).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
  });

  it("valida formato de e-mail", async () => {
    render(<LoginForm />);
    await user.type(screen.getByLabelText("E-mail"), "sem-arroba");
    await user.type(screen.getByLabelText("Senha"), "senha-segura");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("limpa o erro do campo ao digitar novamente", async () => {
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    await user.type(email, "gestor@caps.local");
    expect(email).not.toHaveAttribute("aria-invalid");
  });

  it("exibe mensagem de erro de autenticação vinda da action (role=alert)", async () => {
    mocks.login.mockImplementation(async () => ({
      error: "E-mail ou senha incorretos.",
    }));
    render(<LoginForm />);
    await preencherValido();
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("E-mail ou senha incorretos.");
  });

  it("mostra estado de carregamento durante o submit", async () => {
    let resolver: (value: LoginState) => void = () => {};
    mocks.login.mockImplementation(
      () =>
        new Promise<LoginState>((resolve) => {
          resolver = resolve;
        })
    );

    render(<LoginForm />);
    await preencherValido();
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const botao = await screen.findByRole("button", { name: "Entrando..." });
    expect(botao).toBeDisabled();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.getByLabelText("Senha")).toBeDisabled();
    resolver({});
  });

  it("preserva o parâmetro ?next= no campo oculto", () => {
    render(<LoginForm next="/dashboard/pacientes" />);
    const oculto = document.querySelector<HTMLInputElement>('input[name="next"]');
    expect(oculto?.value).toBe("/dashboard/pacientes");
  });

  it("oferece o CTA de retorno à Landing", () => {
    render(<LoginForm />);
    const link = screen.getByRole("link", { name: /voltar para a página inicial/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("alterna mostrar/ocultar senha", async () => {
    render(<LoginForm />);
    const senha = screen.getByLabelText("Senha");
    expect(senha).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  });

  it("não expõe informações sensíveis no HTML", () => {
    render(<LoginForm />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/SERVICE_ROLE|supabase\.co|postgres|auth\.users|token/i);
  });
});