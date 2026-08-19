import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import type {
  EventoAuditoria,
  FiltrosAuditoria,
  ResultadoListaAuditoria,
} from "@/lib/domain/auditoria/types";

// Contrato usado pelos services (permite injeção de fakes nos testes).
export interface AuditoriaRepository {
  listar(filtros: FiltrosAuditoria): Promise<ResultadoListaAuditoria>;
}

// Normaliza termos de filtro: remove bordas e limita tamanho. Como os filtros
// vão como parâmetros do PostgREST (eq/gte/lte), nunca há interpolação de SQL.
// Comprimento mínimo de 1 evita filtros vazios mapearem para "" (equivale a sem
// filtro no PostgREST, mas mantemos a semântica explícita de "sem filtro").
export function normalizarFiltroAuditoria(valor?: string | null): string | undefined {
  const v = valor?.trim();
  return v ? v.slice(0, 100) : undefined;
}

// "2026-08-13" (input date) → fim do dia em UTC para o .lte() incluir o dia todo.
// Valores já completos (com hora) passam intactos.
function normalizarDataAte(valor?: string | null): string | undefined {
  const v = normalizarFiltroAuditoria(valor);
  if (!v) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59.999` : v;
}

type LinhaAuditoria = {
  id: number;
  acao: string;
  entidade_tipo: string;
  entidade_id: string;
  usuario_id: string;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
  data_hora: string;
  usuarios: { id: string; nome: string } | null;
};

function mapearEventos(linhas: LinhaAuditoria[]): EventoAuditoria[] {
  return linhas.map((l) => ({
    id: l.id,
    acao: l.acao,
    entidadeTipo: l.entidade_tipo,
    entidadeId: l.entidade_id,
    usuarioId: l.usuario_id,
    dadosAntes: l.dados_antes,
    dadosDepois: l.dados_depois,
    dataHora: l.data_hora,
    responsavel: l.usuarios
      ? { id: l.usuarios.id, nome: l.usuarios.nome }
      : null,
  }));
}

export class AuditoriaRepositoryPostgres implements AuditoriaRepository {
  constructor(private readonly client: SupabaseClient) {}

  // Leitura sempre via RLS (auditoria_select_gestor) — só o Gestor ativo vê
  // registros; inativos/sem-vínculo recebem lista vazia do próprio banco.
  async listar(filtros: FiltrosAuditoria): Promise<ResultadoListaAuditoria> {
    const porPagina = 20;
    const offset = (filtros.pagina - 1) * porPagina;

    const acao = normalizarFiltroAuditoria(filtros.acao);
    const entidadeTipo = normalizarFiltroAuditoria(filtros.entidadeTipo);
    const dataDe = normalizarFiltroAuditoria(filtros.dataDe);
    const dataAte = normalizarDataAte(filtros.dataAte);
    const usuarioId = normalizarFiltroAuditoria(filtros.usuarioId);

    let query = this.client
      .from("auditoria_logs")
      .select("*, usuarios(id, nome)", { count: "exact" });

    if (acao) query = query.eq("acao", acao);
    if (entidadeTipo) query = query.eq("entidade_tipo", entidadeTipo);
    if (dataDe) query = query.gte("data_hora", dataDe);
    if (dataAte) query = query.lte("data_hora", dataAte);
    if (usuarioId) query = query.eq("usuario_id", usuarioId);

    const { data, error, count } = await query
      .order("data_hora", { ascending: false })
      .range(offset, offset + porPagina - 1);

    if (error) throw mapSupabaseError(error);

    return {
      eventos: mapearEventos((data ?? []) as LinhaAuditoria[]),
      total: count ?? 0,
      pagina: filtros.pagina,
      porPagina,
    };
  }
}
