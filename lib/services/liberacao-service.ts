import { validarAtualizacaoLiberacao, validarLiberacao } from "@/lib/domain/regras";
import type {
  AtualizacaoLiberacao,
  LiberacaoComPaciente,
  NovaLiberacao,
} from "@/lib/domain/liberacoes/types";
import type { OrigemPaciente, PerfilUsuario } from "@/lib/domain/enums";
import {
  LiberacaoRepositoryPostgres,
  type LiberacaoRepository,
} from "@/lib/repositories/liberacao-repository";

// Casos de uso de liberações. O frontend NÃO determina registrado_por_id nem
// data_fim — o banco (sessão/triggers) é a autoridade. No fluxo do autorizador
// o profissional_autorizador_id é resolvido pela action (sessão). A EDIÇÃO
// (Sprint 42) recebe o payload JÁ filtrado pela whitelist do perfil na action;
// aqui apenas revalidamos o domínio antes do repasse.
export class LiberacaoService {
  constructor(private readonly repo: LiberacaoRepository) {}

  static async create(): Promise<LiberacaoService> {
    const { createClient } = await import("@/lib/supabase/server");
    return new LiberacaoService(new LiberacaoRepositoryPostgres(await createClient()));
  }

  // origemPaciente alimenta a validação RN29 (esporádico somente avulsa).
  // O trigger fn_liberacoes_before permanece a autoridade final no banco.
  async criarLiberacao(
    dados: NovaLiberacao,
    origemPaciente?: OrigemPaciente | null
  ): Promise<LiberacaoComPaciente> {
    validarLiberacao({ ...dados, origemPaciente });
    return this.repo.criar(dados);
  }

  // Sprint 42 — edição segura. O payload chega da action já filtrado; a
  // validação de domínio é refeita aqui (defesa em profundidade) e a autoridade
  // final permanece no trigger + policy RLS.
  async atualizarLiberacao(
    id: string,
    perfil: PerfilUsuario,
    dados: Record<string, unknown>
  ): Promise<LiberacaoComPaciente> {
    validarAtualizacaoLiberacao(perfil, dados);
    return this.repo.atualizar(id, dados as AtualizacaoLiberacao);
  }

  async buscarLiberacao(id: string): Promise<LiberacaoComPaciente | null> {
    return this.repo.buscarPorId(id);
  }

  async listarLiberacoes(busca?: string): Promise<LiberacaoComPaciente[]> {
    return this.repo.listar(busca);
  }
}
