import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import { normalizarBusca } from "@/lib/repositories/paciente-repository";
import type {
  AtualizacaoUsuario,
  NovoUsuario,
  UsuarioFuncional,
} from "@/lib/domain/usuarios/types";

// Contrato usado pelos services (permite injeção de fakes nos testes).
export interface UsuarioRepository {
  listar(busca?: string): Promise<UsuarioFuncional[]>;
  buscarPorId(id: string): Promise<UsuarioFuncional | null>;
  buscarPorEmail(email: string): Promise<UsuarioFuncional | null>;
  criar(dados: NovoUsuario): Promise<UsuarioFuncional>;
  atualizar(id: string, dados: AtualizacaoUsuario): Promise<UsuarioFuncional>;
  atualizarStatusAtivo(id: string, statusAtivo: boolean): Promise<UsuarioFuncional>;
}

export class UsuarioRepositoryPostgres implements UsuarioRepository {
  constructor(private readonly client: SupabaseClient) {}

  // Leitura exclusiva do Gestor (policy usuarios_select_gestor). Nenhuma coluna
  // sensível (auth.users/tokens/senhas) é consultada — somente public.usuarios.
  async listar(busca?: string): Promise<UsuarioFuncional[]> {
    const termo = normalizarBusca(busca);
    let query = this.client.from("usuarios").select("*");

    if (termo) {
      query = query.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`);
    }

    const { data, error } = await query.order("nome", { ascending: true });

    if (error) throw mapSupabaseError(error);
    return (data ?? []) as UsuarioFuncional[];
  }

  async buscarPorId(id: string): Promise<UsuarioFuncional | null> {
    const { data, error } = await this.client
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    return (data as UsuarioFuncional | null) ?? null;
  }

  // Usado na criação (Sprint 16) para detectar duplicidade de e-mail ANTES de
  // criar o usuário no Auth — evita Auth órfão num caso previsível.
  async buscarPorEmail(email: string): Promise<UsuarioFuncional | null> {
    const { data, error } = await this.client
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    return (data as UsuarioFuncional | null) ?? null;
  }

  async criar(dados: NovoUsuario): Promise<UsuarioFuncional> {
    const { data, error } = await this.client
      .from("usuarios")
      .insert({
        auth_user_id: dados.auth_user_id,
        nome: dados.nome,
        email: dados.email,
        perfil: dados.perfil,
        profissao: dados.profissao ?? null,
        unidade_id: dados.unidade_id ?? null,
      })
      .select("*")
      .single();

    if (error) throw mapSupabaseError(error);
    return data as UsuarioFuncional;
  }

  async atualizar(id: string, dados: AtualizacaoUsuario): Promise<UsuarioFuncional> {
    const { data, error } = await this.client
      .from("usuarios")
      .update(dados)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw mapSupabaseError(error);
    return data as UsuarioFuncional;
  }

  // Inativação = UPDATE status_ativo (NUNCA exclusão física). A policy
  // usuarios_delete_gestor permanece no banco, mas o serviço não a expõe.
  async atualizarStatusAtivo(id: string, statusAtivo: boolean): Promise<UsuarioFuncional> {
    return this.atualizar(id, { status_ativo: statusAtivo });
  }
}
