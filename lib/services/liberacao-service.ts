import { validarLiberacao } from "@/lib/domain/regras";
import type {
  LiberacaoComPaciente,
  NovaLiberacao,
} from "@/lib/domain/liberacoes/types";
import {
  LiberacaoRepositoryPostgres,
  type LiberacaoRepository,
} from "@/lib/repositories/liberacao-repository";

// Casos de uso de liberações. O frontend NÃO determina registrado_por_id nem
// data_fim — o banco (sessão/triggers) é a autoridade. No fluxo do autorizador
// o profissional_autorizador_id é resolvido pela action (sessão). Sem
// update()/delete(): essas operações permanecem pendentes na especificação.
export class LiberacaoService {
  constructor(private readonly repo: LiberacaoRepository) {}

  static async create(): Promise<LiberacaoService> {
    const { createClient } = await import("@/lib/supabase/server");
    return new LiberacaoService(new LiberacaoRepositoryPostgres(await createClient()));
  }

  async criarLiberacao(dados: NovaLiberacao): Promise<LiberacaoComPaciente> {
    validarLiberacao(dados);
    return this.repo.criar(dados);
  }

  async buscarLiberacao(id: string): Promise<LiberacaoComPaciente | null> {
    return this.repo.buscarPorId(id);
  }

  async listarLiberacoes(busca?: string): Promise<LiberacaoComPaciente[]> {
    return this.repo.listar(busca);
  }
}
