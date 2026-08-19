import type { PerfilUsuario, Profissao } from "@/lib/domain/enums";

// Espelha a tabela public.usuarios (migration 20260811000003_usuarios.sql).
// NÃO existe campo `pode_autorizar`: a capacidade de autorizar é derivada de
// perfil + profissao + status_ativo (RN02/RN27) — ver lib/domain/regras.ts.
export type UsuarioFuncional = {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  profissao: Profissao | null;
  status_ativo: boolean;
  unidade_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NovoUsuario = {
  auth_user_id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  profissao?: Profissao | null;
  unidade_id?: string | null;
};

export type AtualizacaoUsuario = {
  nome?: string;
  perfil?: PerfilUsuario;
  profissao?: Profissao | null;
  unidade_id?: string | null;
  status_ativo?: boolean;
};
