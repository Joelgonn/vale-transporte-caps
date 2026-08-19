"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import {
  trocarSenhaPrimeiroAcesso,
  type TrocarSenhaState,
} from "@/app/actions/primeiro-acesso";
import {
  BOTAO_PRIMARIO,
  INPUT,
  INPUT_ERRO,
  ROTULO,
} from "@/components/ui/visual-tokens";
import { SENHA_MINIMA_CARACTERES } from "@/lib/domain/regras";

type ErrosCampo = {
  novaSenha?: string;
  confirmacao?: string;
};

export default function PrimeiroAcessoForm() {
  const [state, formAction, pending] = useActionState<
    TrocarSenhaState,
    FormData
  >(trocarSenhaPrimeiroAcesso, {});
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

    const novaSenha = String(formData.get("novaSenha") ?? "");
    const confirmacao = String(formData.get("confirmacao") ?? "");

    const novosErros: ErrosCampo = {};
    if (!novaSenha) {
      novosErros.novaSenha = "Informe a nova senha.";
    } else if (novaSenha.length < SENHA_MINIMA_CARACTERES) {
      novosErros.novaSenha = `A senha deve ter pelo menos ${SENHA_MINIMA_CARACTERES} caracteres.`;
    }
    if (!confirmacao) {
      novosErros.confirmacao = "Confirme a nova senha.";
    } else if (novaSenha !== confirmacao) {
      novosErros.confirmacao = "As senhas não coincidem.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      action={formAction}
      onSubmit={aoEnviar}
      noValidate
      aria-busy={pending}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="primeiro-acesso-nova-senha" className={ROTULO}>
          Nova senha
        </label>
        <div className="relative">
          <input
            id="primeiro-acesso-nova-senha"
            name="novaSenha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={SENHA_MINIMA_CARACTERES}
            disabled={pending}
            aria-invalid={erros.novaSenha ? true : undefined}
            aria-describedby={
              erros.novaSenha ? "primeiro-acesso-nova-senha-erro" : undefined
            }
            onChange={() => limparErro("novaSenha")}
            className={`${erros.novaSenha ? INPUT_ERRO : INPUT} pr-12`}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-pressed={mostrarSenha}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-zinc-500 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {mostrarSenha ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.9A10.5 10.5 0 0 1 12 5c5 0 8.5 4 9.5 7a14.6 14.6 0 0 1-1.4 2.8M6.6 6.6C4.3 8 2.7 10.3 2.5 12c1 3 4.5 7 9.5 7a9.7 9.7 0 0 0 3.9-.8" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M2.5 12c1-3 4.5-7 9.5-7s8.5 4 9.5 7c-1 3-4.5 7-9.5 7S3.5 15 2.5 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {erros.novaSenha && (
          <p id="primeiro-acesso-nova-senha-erro" className="text-sm text-red-600">
            {erros.novaSenha}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="primeiro-acesso-confirmacao" className={ROTULO}>
          Confirmar nova senha
        </label>
        <div className="relative">
          <input
            id="primeiro-acesso-confirmacao"
            name="confirmacao"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={SENHA_MINIMA_CARACTERES}
            disabled={pending}
            aria-invalid={erros.confirmacao ? true : undefined}
            aria-describedby={
              erros.confirmacao ? "primeiro-acesso-confirmacao-erro" : undefined
            }
            onChange={() => limparErro("confirmacao")}
            className={`${erros.confirmacao ? INPUT_ERRO : INPUT} pr-12`}
          />
        </div>
        {erros.confirmacao && (
          <p id="primeiro-acesso-confirmacao-erro" className="text-sm text-red-600">
            {erros.confirmacao}
          </p>
        )}
      </div>

      {state?.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${BOTAO_PRIMARIO} w-full disabled:opacity-50`}
      >
        {pending ? "Definindo senha..." : "Definir nova senha"}
      </button>
    </form>
  );
}
