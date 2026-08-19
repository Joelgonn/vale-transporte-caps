import { validarRetirada } from "@/lib/domain/regras";
import type {
  NovaRetirada,
  Retirada,
  RetiradaComDetalhes,
} from "@/lib/domain/retiradas/types";
import {
  RetiradaRepositoryPostgres,
  type RetiradaRepository,
} from "@/lib/repositories/retirada-repository";

// Casos de uso de retiradas. O frontend NÃO determina recepcionista_id, data_hora
// nem saldo restante — o banco (sessão/triggers) é a autoridade. Sem
// update()/delete(): essas operações permanecem pendentes na especificação.
export class RetiradaService {
  constructor(private readonly repo: RetiradaRepository) {}

  static async create(): Promise<RetiradaService> {
    const { createClient } = await import("@/lib/supabase/server");
    return new RetiradaService(new RetiradaRepositoryPostgres(await createClient()));
  }

  async registrarRetirada(dados: NovaRetirada): Promise<Retirada> {
    validarRetirada(dados);
    return this.repo.criar(dados);
  }

  async buscarRetirada(id: string): Promise<RetiradaComDetalhes | null> {
    return this.repo.buscarPorId(id);
  }

  async listarRetiradas(): Promise<RetiradaComDetalhes[]> {
    return this.repo.listar();
  }
}
