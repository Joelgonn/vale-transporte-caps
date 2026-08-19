"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useModalA11y } from "@/components/ui/use-modal-a11y";
import {
  criarUsuarioCompletoAction,
  type CriarUsuarioCompletoDados,
} from "@/app/actions/usuarios";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  INPUT,
  INPUT_ERRO,
  ROTULO,
} from "@/components/ui/visual-tokens";
import {
  EMAIL_RE,
} from "@/lib/domain/regras";
import {
  PERFIS,
  PROFISSOES,
  ROTULO_PERFIL,
  ROTULO_PROFISSAO,
  type PerfilUsuario,
  type Profissao,
} from "@/lib/domain/enums";

type NovoUsuarioFormProps = {
  onClose: () => void;
  onSalvo: () => void;
};

type FormState = { error?: string; senhaTemporaria?: string };

type ErrosCampo = { nome?: string; email?: string; perfil?: string };

function lerPerfil(valor: FormDataEntryValue | null): PerfilUsuario | null {
  const tag = typeof valor === "string" ? valor : "";
  return (Object.values(PERFIS) as string[]).includes(tag)
    ? (tag as PerfilUsuario)
    : null;
}

function lerProfissao(valor: FormDataEntryValue | null): Profissao | null {
  const tag = typeof valor === "string" ? valor : "";
  return (Object.values(PROFISSOES) as string[]).includes(tag)
    ? (tag as Profissao)
    : null;
}

export default function NovoUsuarioForm({ onClose, onSalvo }: NovoUsuarioFormProps) {
  const executar = async (
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> => {
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const perfil = lerPerfil(formData.get("perfil"));
    const profissao = lerProfissao(formData.get("profissao"));

    if (!perfil) {
      return { error: "Selecione o perfil do usuário." };
    }

    const dados: CriarUsuarioCompletoDados = {
      nome,
      email,
      perfil,
      profissao,
    };

    const resultado = await criarUsuarioCompletoAction(dados);
    return resultado.ok
      ? { senhaTemporaria: resultado.data.senhaTemporaria }
      : { error: resultado.error };
  };

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    executar,
    {}
  );
  const [erros, setErros] = useState<ErrosCampo>({});
  const [perfil, setPerfil] = useState<PerfilUsuario>(PERFIS.RECEPCIONISTA);

  const concluido = state.senhaTemporaria !== undefined;

  const bloq = pending || concluido;
  const ref = useModalA11y(onClose, !bloq);

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

    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    const novosErros: ErrosCampo = {};
    if (!nome) {
      novosErros.nome = "Informe o nome do usuário.";
    }
    if (!email) {
      novosErros.email = "Informe o e-mail.";
    } else if (!EMAIL_RE.test(email)) {
      novosErros.email = "Informe um e-mail válido.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 outline-none sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novo usuário"
    >
      <form
        action={formAction}
        onSubmit={aoEnviar}
        noValidate
        aria-busy={pending}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-lg bg-white p-6 sm:rounded-lg"
      >
        <div>
          <h2 className="text-lg font-semibold text-brand-900">Novo usuário</h2>
          <p className="text-sm text-zinc-500">
            Cria o acesso e o vínculo funcional do colaborador.
          </p>
        </div>

        {concluido ? (
          <div className="flex flex-col gap-3" role="status">
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Usuário criado com sucesso.
            </p>
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-800">
                Senha temporária (exibida uma única vez)
              </p>
              <p className="mt-2 select-all rounded bg-white px-3 py-2 font-mono text-base text-zinc-900">
                {state.senhaTemporaria}
              </p>
              <p className="mt-2 text-sm text-amber-800">
                Entregue ao usuário por um canal seguro e não compartilhe
                novamente.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="novo-usuario-nome" className={ROTULO}>
                Nome
              </label>
              <input
                id="novo-usuario-nome"
                name="nome"
                type="text"
                autoComplete="off"
                required
                disabled={pending}
                aria-invalid={erros.nome ? true : undefined}
                aria-describedby={erros.nome ? "novo-usuario-nome-erro" : undefined}
                onChange={() => limparErro("nome")}
                className={erros.nome ? INPUT_ERRO : INPUT}
              />
              {erros.nome && (
                <p id="novo-usuario-nome-erro" className="text-sm text-red-600">
                  {erros.nome}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="novo-usuario-email" className={ROTULO}>
                E-mail
              </label>
              <input
                id="novo-usuario-email"
                name="email"
                type="email"
                autoComplete="off"
                required
                disabled={pending}
                aria-invalid={erros.email ? true : undefined}
                aria-describedby={erros.email ? "novo-usuario-email-erro" : undefined}
                onChange={() => limparErro("email")}
                className={erros.email ? INPUT_ERRO : INPUT}
              />
              {erros.email && (
                <p id="novo-usuario-email-erro" className="text-sm text-red-600">
                  {erros.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="novo-usuario-perfil" className={ROTULO}>
                Perfil
              </label>
              <select
                id="novo-usuario-perfil"
                name="perfil"
                value={perfil}
                disabled={pending}
                onChange={(e) => {
                  setPerfil(e.target.value as PerfilUsuario);
                  limparErro("perfil");
                }}
                className={INPUT}
              >
                {(Object.keys(PERFIS) as Array<keyof typeof PERFIS>).map((chave) => (
                  <option key={PERFIS[chave]} value={PERFIS[chave]}>
                    {ROTULO_PERFIL[PERFIS[chave]]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500">
                O novo usuário entra pelo login e o acesso respeita o perfil
                escolhido.
              </p>
            </div>

            {perfil === PERFIS.PROFISSIONAL_AUTORIZADOR && (
              <div className="flex flex-col gap-2">
                <label htmlFor="novo-usuario-profissao" className={ROTULO}>
                  Profissão
                </label>
                <select
                  id="novo-usuario-profissao"
                  name="profissao"
                  required
                  disabled={pending}
                  defaultValue=""
                  className={INPUT}
                >
                  <option value="" disabled>
                    Selecione a profissão
                  </option>
                  {(Object.keys(PROFISSOES) as Array<keyof typeof PROFISSOES>).map(
                    (chave) => (
                      <option key={PROFISSOES[chave]} value={PROFISSOES[chave]}>
                        {ROTULO_PROFISSAO[PROFISSOES[chave]]}
                      </option>
                    )
                  )}
                </select>
                <p className="text-xs text-zinc-500">
                  O profissional autorizador exige profissão cadastrada (RN02).
                </p>
              </div>
            )}

            {state.error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {state.error}
              </p>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={`${BOTAO_SECUNDARIO} disabled:opacity-50`}
          >
            Cancelar
          </button>
          {concluido ? (
            <button
              type="button"
              onClick={onSalvo}
              className={BOTAO_PRIMARIO}
            >
              Concluir
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className={`${BOTAO_PRIMARIO} disabled:opacity-50`}
            >
              {pending ? "Criando..." : "Criar usuário"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
