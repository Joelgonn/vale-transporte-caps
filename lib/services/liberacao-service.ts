import { validarLiberacao } from "@/lib/domain/regras";
import type {
  LiberacaoComPaciente,
  NovaLiberacao,
} from "@/lib/domain/liberacoes/types";
import type { OrigemPaciente } from "@/lib/domain/enums";
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

  // origemPaciente alimenta a validação RN29 (esporádico somente avulsa).
  // O trigger fn_liberacoes_before permanece a autoridade final no banco.
  async criarLiberacao(
    dados: NovaLiberacao,
    origemPaciente?: OrigemPaciente | null
  ): Promise<LiberacaoComPaciente> {
    validarLiberacao({ ...dados, origemPaciente });
    return this.repo.criar(dados);
  }

  async buscarLiberacao(id: string): Promise<LiberacaoComPaciente | null> {
    return this.repo.buscarPorId(id);
  }

  async listarLiberacoes(busca?: string): Promise<LiberacaoComPaciente[]> {
    return this.repo.listar(busca);
  }
}
