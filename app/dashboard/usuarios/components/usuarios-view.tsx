"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { ativarUsuarioAction, inativarUsuarioAction } from "@/app/actions/usuarios";
import {
  ROTULO_PERFIL,
  ROTULO_PROFISSAO,
  type PerfilUsuario,
  type Profissao,
} from "@/lib/domain/enums";
import {
  BOTAO_AVISO,
  BOTAO_POSITIVO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CARTAO,
  CONTAINER,
} from "@/components/ui/visual-tokens";
import { PageHeader } from "@/components/ui/page-header";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FeedbackErro } from "@/components/ui/feedback";
import { UserSearch } from "@/components/ui/user-search";
import type { UsuarioFuncional } from "@/lib/domain/usuarios/types";
import NovoUsuarioForm from "./novo-usuario-form";
import { UsuarioStatus } from "./usuario-status";

type UsuariosViewProps = {
  busca: string;
  usuarioSelecionado?: UsuarioFuncional | null;
  usuariosIniciais: UsuarioFuncional[];
  erroInicial: string | null;
};

function rotuloPerfil(perfil: PerfilUsuario): string {
  return ROTULO_PERFIL[perfil];
}

function rotuloProfissao(profissao: Profissao | null): string {
  return profissao ? ROTULO_PROFISSAO[profissao] : "—";
}

export default function UsuariosView(props: UsuariosViewProps) {
  const router = useRouter();
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [pendenteId, setPendenteId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [, startTransition] = useTransition();

  function alternarStatus(usuario: UsuarioFuncional) {
    const proximoAtivo = !usuario.status_ativo;
    setPendenteId(usuario.id);

    startTransition(async () => {
      try {
        const acao = proximoAtivo ? ativarUsuarioAction : inativarUsuarioAction;
        const resultado = await acao(usuario.id);
        if (!resultado.ok) {
          setErroStatus(resultado.error);
          return;
        }
        setErroStatus(null);
        router.refresh();
      } finally {
        setPendenteId(null);
      }
    });
  }

  const vazio = props.usuariosIniciais.length === 0;

  return (
    <div className="flex flex-1 flex-col py-6">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <PageHeader
          titulo="Usuários"
          descricao="Gestão de perfis e status — área exclusiva do Gestor ativo."
          acao={
            <button
              type="button"
              onClick={() => setFormAberto(true)}
              className={BOTAO_PRIMARIO}
            >
              Novo usuário
            </button>
          }
        />

        {props.usuarioSelecionado ? (
          <div className={`${CARTAO} flex items-center justify-between gap-3 p-4`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-900">{props.usuarioSelecionado.nome}</p>
              <p className="text-xs text-zinc-500">
                {props.usuarioSelecionado.email} · {ROTULO_PERFIL[props.usuarioSelecionado.perfil] ?? props.usuarioSelecionado.perfil}
              </p>
            </div>
            <button type="button" onClick={() => router.push("/dashboard/usuarios")} className={BOTAO_SECUNDARIO}>
              Limpar
            </button>
          </div>
        ) : (
          <div className={`${CARTAO} p-4`}>
            <UserSearch
              id="busca-usuarios"
              label="Buscar por nome ou e-mail"
              placeholder="🔎 Nome ou e-mail..."
              onSelect={(u) => router.push(`/dashboard/usuarios?usuario=${u.id}`)}
            />
          </div>
        )}

        {erroStatus && <FeedbackErro>{erroStatus}</FeedbackErro>}
        {props.erroInicial && <FeedbackErro>{props.erroInicial}</FeedbackErro>}

        {vazio ? (
          <EstadoVazio
            mensagem={
              props.usuarioSelecionado || props.busca
                ? "Nenhum usuário encontrado para esta busca."
                : "Nenhum usuário cadastrado ainda."
            }
          />
        ) : (
          <div className={`${CARTAO} overflow-x-auto`}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Profissão</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {props.usuariosIniciais.map((usuario) => (
                  <tr
                    key={usuario.id}
                    className="transition-colors duration-150 hover:bg-brand-50/40 motion-reduce:transition-none"
                  >
                    <td className="px-4 py-3 font-medium text-brand-900">
                      {usuario.nome}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{usuario.email}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {rotuloPerfil(usuario.perfil)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {rotuloProfissao(usuario.profissao)}
                    </td>
                    <td className="px-4 py-3">
                      <UsuarioStatus ativo={usuario.status_ativo} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={pendenteId === usuario.id}
                          onClick={() => alternarStatus(usuario)}
                          className={`${
                            usuario.status_ativo ? BOTAO_AVISO : BOTAO_POSITIVO
                          } h-9`}
                        >
                          {pendenteId === usuario.id
                            ? "Salvando..."
                            : usuario.status_ativo
                              ? "Inativar"
                              : "Reativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {formAberto && (
          <NovoUsuarioForm
            onClose={() => setFormAberto(false)}
            onSalvo={() => {
              setFormAberto(false);
              setErroStatus(null);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}