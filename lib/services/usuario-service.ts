import { validarNovoUsuario } from "@/lib/domain/regras";
import type {
  AtualizacaoUsuario,
  NovoUsuario,
  UsuarioFuncional,
} from "@/lib/domain/usuarios/types";
import {
  UsuarioRepositoryPostgres,
  type UsuarioRepository,
} from "@/lib/repositories/usuario-repository";

// Casos de uso de usuários funcionais — apenas operações permitidas ao Gestor
// (RLS). Inativação é UPDATE status_ativo; o serviço NÃO expõe exclusão física
// (a policy usuarios_delete_gestor permanece no banco por decisão institucional).
export class UsuarioService {
  constructor(private readonly repo: UsuarioRepository) {}

  static async create(): Promise<UsuarioService> {
    const { createClient } = await import("@/lib/supabase/server");
    return new UsuarioService(new UsuarioRepositoryPostgres(await createClient()));
  }

  async listarUsuarios(busca?: string): Promise<UsuarioFuncional[]> {
    return this.repo.listar(busca);
  }

  async buscarUsuario(id: string): Promise<UsuarioFuncional | null> {
    return this.repo.buscarPorId(id);
  }

  async criarUsuarioFuncional(dados: NovoUsuario): Promise<UsuarioFuncional> {
    validarNovoUsuario(dados);
    return this.repo.criar(dados);
  }

  async atualizarUsuario(
    id: string,
    dados: AtualizacaoUsuario
  ): Promise<UsuarioFuncional> {
    if (dados.perfil) {
      validarNovoUsuario({ perfil: dados.perfil, profissao: dados.profissao ?? null });
    }
    return this.repo.atualizar(id, dados);
  }

  async ativarUsuario(id: string): Promise<UsuarioFuncional> {
    return this.repo.atualizarStatusAtivo(id, true);
  }

  async inativarUsuario(id: string): Promise<UsuarioFuncional> {
    return this.repo.atualizarStatusAtivo(id, false);
  }
}
