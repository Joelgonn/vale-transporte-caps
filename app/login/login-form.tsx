// app/login/login-form.tsx
"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import { login, type LoginState } from "@/app/actions/auth";
import {
  BOTAO_PRIMARIO,
  INPUT,
  INPUT_ERRO,
  LINK,
  ROTULO,
  ALERTA_ERRO,
} from "@/components/ui/visual-tokens";

type LoginFormProps = {
  next?: string;
};

type ErrosCampo = {
  email?: string;
  senha?: string;
};

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginForm({ next = "" }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    login,
    {}
  );
  const [erros, setErros] = useState<ErrosCampo>({});
  const [mostrarSenha, setMostrarSenha] = useState(false);

  function limparErro(campo: keyof ErrosCampo) {
    setErros((anteriores) => {
      if (!anteriores[campo]) return anteriores;
      return { ...anteriores, [campo]: undefined };
    });
  }

  function aoEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const email = String(formData.get("email") ?? "").trim();
    const senha = String(formData.get("password") ?? "");

    const novosErros: ErrosCampo = {};
    if (!email) {
      novosErros.email = "Informe o e-mail.";
    } else if (!emailValido(email)) {
      novosErros.email = "Informe um e-mail válido.";
    }
    if (!senha) {
      novosErros.senha = "Informe a senha.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    // O redirecionamento é responsabilidade da action (rotaInternaValida
    // protege contra open redirect) e do proxy/middleware. O formulário apenas
    // repassa o FormData — incluindo o campo oculto ?next=.
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      action={formAction}
      onSubmit={aoEnviar}
      noValidate
      aria-busy={isPending}
      className="space-y-4"
    >
      {state?.error && (
        <p role="alert" className={ALERTA_ERRO}>
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="login-email" className={ROTULO}>
          E-mail
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          aria-invalid={erros.email ? true : undefined}
          aria-describedby={erros.email ? "login-email-erro" : undefined}
          onChange={() => limparErro("email")}
          className={erros.email ? INPUT_ERRO : INPUT}
        />
        {erros.email && (
          <p id="login-email-erro" className="mt-1.5 text-sm text-red-600">
            {erros.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="login-senha" className={ROTULO}>
          Senha
        </label>
        <div className="relative">
          <input
            id="login-senha"
            name="password"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={isPending}
            aria-invalid={erros.senha ? true : undefined}
            aria-describedby={erros.senha ? "login-senha-erro" : undefined}
            onChange={() => limparErro("senha")}
            className={`${erros.senha ? INPUT_ERRO : INPUT} pr-12`}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors duration-150 hover:text-zinc-600 active:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 motion-reduce:transition-none"
          >
            {mostrarSenha ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
        </div>
        {erros.senha && (
          <p id="login-senha-erro" className="mt-1.5 text-sm text-red-600">
            {erros.senha}
          </p>
        )}
      </div>

      <input type="hidden" name="next" value={next} />

      <button
        type="submit"
        disabled={isPending}
        className={`${BOTAO_PRIMARIO} w-full`}
      >
        {isPending ? (
          <>
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </button>

      <p className="text-center">
        <Link href="/" className={LINK}>
          Voltar para a página inicial
        </Link>
      </p>
    </form>
  );
}
