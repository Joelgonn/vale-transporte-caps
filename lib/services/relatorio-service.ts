import { AppError } from "@/lib/domain/app-error";
import {
  TIPOS_RELATORIO,
  type FiltrosRelatorio,
  type ResultadoListaRelatorio,
} from "@/lib/domain/relatorios/types";
import {
  RelatorioRepositoryPostgres,
  type RelatorioRepository,
} from "@/lib/repositories/relatorio-repository";

// Caso de uso de relatórios (Sprint 37 — Fase 8). Somente leitura via RLS e
// somente para o Gestor ativo (a action aplica o gate; o banco continua a
// autoridade). O repositório faz filtros + paginação no servidor; aqui apenas
// validamos o tipo e a página solicitados.
export class RelatorioService {
  constructor(private readonly repo: RelatorioRepository) {}

  static async create(): Promise<RelatorioService> {
    const { createClient } = await import("@/lib/supabase/server");
    return new RelatorioService(new RelatorioRepositoryPostgres(await createClient()));
  }

  async consultar(filtros: FiltrosRelatorio): Promise<ResultadoListaRelatorio> {
    if (!(TIPOS_RELATORIO as readonly string[]).includes(filtros.tipo)) {
      throw new AppError("VALIDACAO", "Tipo de relatório inválido.");
    }

    const pagina = filtros.pagina;
    if (!Number.isInteger(pagina) || pagina < 1) {
      throw new AppError("VALIDACAO", "Página inválida.");
    }

    const filtrosNormatizados: FiltrosRelatorio = { ...filtros, pagina };

    switch (filtros.tipo) {
      case "liberacoes":
        return this.repo.listarLiberacoes(filtrosNormatizados);
      case "retiradas":
        return this.repo.listarRetiradas(filtrosNormatizados);
      case "consolidado":
        return this.repo.listarConsolidado(filtrosNormatizados);
      case "historico":
        return this.repo.listarHistorico(filtrosNormatizados);
    }
  }
}