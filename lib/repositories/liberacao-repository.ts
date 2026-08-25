import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import type {
  AtualizacaoLiberacao,
  Liberacao,
  LiberacaoComPaciente,
  NovaLiberacao,
  PacienteResumo,
} from "@/lib/domain/liberacoes/types";
import { normalizarBusca } from "@/lib/repositories/paciente-repository";

// Contrato usado pelos services (permite injeção de fakes nos testes).
export interface LiberacaoRepository {
  listar(busca?: string): Promise<LiberacaoComPaciente[]>;
  buscarPorId(id: string): Promise<LiberacaoComPaciente | null>;
  criar(dados: NovaLiberacao): Promise<LiberacaoComPaciente>;
  atualizar(id: string, dados: AtualizacaoLiberacao): Promise<LiberacaoComPaciente>;
}

// Colunas do paciente embutidas na listagem (nunca CPF).
const COLUNAS_PACIENTE = "id, gestor_sus, nome";

// PostgREST retorna a FK embutida como objeto (to-one) — normaliza para o tipo.
function mapearPaciente(pacientes: unknown): PacienteResumo | null {
  const alvo = Array.isArray(pacientes)
    ? (pacientes[0] as PacienteResumo | undefined)
    : (pacientes as PacienteResumo | null | undefined);
  if (!alvo?.id) return null;
  return {
    id: alvo.id,
    gestor_sus: alvo.gestor_sus ?? "",
    nome: alvo.nome ?? "",
  };
}

function mapearLinha(linha: Record<string, unknown>): LiberacaoComPaciente {
  const { pacientes, ...resto } = linha;
  return {
    ...(resto as Liberacao),
    paciente: mapearPaciente(pacientes),
  };
}

function mapearLista(data: unknown[]): LiberacaoComPaciente[] {
  return (data as Record<string, unknown>[]).map(mapearLinha);
}

export class LiberacaoRepositoryPostgres implements LiberacaoRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listar(busca?: string): Promise<LiberacaoComPaciente[]> {
    let query = this.client
      .from("liberacoes")
      .select(`*, pacientes(${COLUNAS_PACIENTE})`)
      .order("data_inicio", { ascending: false });

    const termo = normalizarBusca(busca);

    // Busca por nome/Gestor SUS do PACIENTE (não são colunas de liberacoes).
    // Segue o padrão seguro de Pacientes: resolve os ids correspondentes via
    // v_pacientes (sem CPF, RLS) e filtra liberacoes por paciente_id. Toda a
    // filtragem acontece no servidor/repositório (nunca SQL no componente).
    if (termo) {
      const { data: pacientes, error: erroIds } = await this.client
        .from("v_pacientes")
        .select("id")
        .or(`nome.ilike.%${termo}%,gestor_sus.ilike.%${termo}%`)
        .limit(100);

      if (erroIds) throw mapSupabaseError(erroIds);

      const ids = (pacientes ?? []).map((p: { id: string }) => p.id);
      if (ids.length === 0) return [];
      query = query.in("paciente_id", ids);
    }

    const { data, error } = await query;
    if (error) throw mapSupabaseError(error);
    return mapearLista(data ?? []);
  }

  async buscarPorId(id: string): Promise<LiberacaoComPaciente | null> {
    const { data, error } = await this.client
      .from("liberacoes")
      .select(`*, pacientes(${COLUNAS_PACIENTE})`)
      .eq("id", id)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    if (!data) return null;
    return mapearLinha(data as Record<string, unknown>);
  }

  // NÃO envia registrado_por_id (o trigger preenche a partir da sessão) nem
  // data_fim (o trigger calcula — RN13/RN21). O cliente NÃO informa
  // profissional_autorizador_id no fluxo do autorizador (a action resolve via
  // public.usuario_atual_id()); na renovação a recepção repassa o da liberação
  // original. O banco permanece a autoridade.
  async criar(dados: NovaLiberacao): Promise<LiberacaoComPaciente> {
    const { data, error } = await this.client
      .from("liberacoes")
      .insert({
        paciente_id: dados.pacienteId,
        tipo: dados.tipo,
        quantidade: dados.quantidade,
        periodo_meses: dados.periodoMeses ?? null,
        profissional_autorizador_id: dados.profissionalAutorizadorId,
        renovacao_de_id: dados.renovacaoDeId ?? null,
      })
      .select(`*, pacientes(${COLUNAS_PACIENTE})`)
      .single();

    if (error) throw mapSupabaseError(error);
    return mapearLinha(data as Record<string, unknown>);
  }

  // Sprint 42 — atualização de liberação. O payload JÁ chega filtrado pela
  // whitelist do perfil (action) — aqui é repasse puro ao PostgREST, que aplica
  // policy liberacoes_update_autorizador_gestor + branch UPDATE do trigger
  // fn_liberacoes_before (campos históricos imutáveis; split fino por perfil).
  async atualizar(
    id: string,
    dados: AtualizacaoLiberacao
  ): Promise<LiberacaoComPaciente> {
    const { data, error } = await this.client
      .from("liberacoes")
      .update(dados)
      .eq("id", id)
      .select(`*, pacientes(${COLUNAS_PACIENTE})`)
      .single();

    if (error) throw mapSupabaseError(error);
    return mapearLinha(data as Record<string, unknown>);
  }
}