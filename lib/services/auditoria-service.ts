import { AppError } from "@/lib/domain/app-error";
import type {
  FiltrosAuditoria,
  ResultadoListaAuditoria,
} from "@/lib/domain/auditoria/types";
import {
  AuditoriaRepositoryPostgres,
  type AuditoriaRepository,
} from "@/lib/repositories/auditoria-repository";

// Caso de uso de auditoria. Somente leitura (append-only no banco) e somente
// para o Gestor ativo (policy auditoria_select_gestor). O repositório faz a
// paginação no banco; aqui apenas validamos a página solicitada.
export class AuditoriaService {
  constructor(private readonly repo: AuditoriaRepository) {}

  static async create(): Promise<AuditoriaService> {
    const { createClient } = await import("@/lib/supabase/server");
    return new AuditoriaService(new AuditoriaRepositoryPostgres(await createClient()));
  }

  async listarEventos(filtros: FiltrosAuditoria): Promise<ResultadoListaAuditoria> {
    const pagina = filtros.pagina;
    if (!Number.isInteger(pagina) || pagina < 1) {
      throw new AppError("VALIDACAO", "Página inválida.");
    }
    return this.repo.listar({ ...filtros, pagina });
  }
}
