import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import type {
  LiberacaoResumo,
  NovaRetirada,
  PacienteResumo,
  Retirada,
  RetiradaComDetalhes,
  UsuarioResumo,
} from "@/lib/domain/retiradas/types";

// Contrato usado pelos services (permite injeção de fakes nos testes).
export interface RetiradaRepository {
  listar(): Promise<RetiradaComDetalhes[]>;
  buscarPorId(id: string): Promise<RetiradaComDetalhes | null>;
  criar(dados: NovaRetirada): Promise<Retirada>;
}

// Colunas embutidas na listagem — mesmo padrão de LiberacaoRepository
// (Sprint 18), sem CPF e sem colunas desnecessárias. Os embeds são
// best-effort: o que o leitor não enxergar (RLS) chega como null.
const COLUNAS_PACIENTE = "id, gestor_sus, nome";
const COLUNAS_LIBERACAO = "id, tipo, quantidade, data_inicio, data_fim";
const COLUNAS_USUARIO = "id, nome";

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

function mapearLiberacao(liberacoes: unknown): LiberacaoResumo | null {
  const alvo = Array.isArray(liberacoes)
    ? (liberacoes[0] as LiberacaoResumo | undefined)
    : (liberacoes as LiberacaoResumo | null | undefined);
  if (!alvo?.id) return null;
  return {
    id: alvo.id,
    tipo: alvo.tipo,
    quantidade: alvo.quantidade,
    data_inicio: alvo.data_inicio,
    data_fim: alvo.data_fim,
  };
}

function mapearUsuario(usuarios: unknown): UsuarioResumo | null {
  const alvo = Array.isArray(usuarios)
    ? (usuarios[0] as UsuarioResumo | undefined)
    : (usuarios as UsuarioResumo | null | undefined);
  if (!alvo?.id) return null;
  return { id: alvo.id, nome: alvo.nome ?? "" };
}

function mapearLinha(linha: Record<string, unknown>): RetiradaComDetalhes {
  const { pacientes, liberacoes, usuarios, ...resto } = linha;
  return {
    ...(resto as Retirada),
    paciente: mapearPaciente(pacientes),
    liberacao: mapearLiberacao(liberacoes),
    recepcionista: mapearUsuario(usuarios),
  };
}

function mapearLista(data: unknown[]): RetiradaComDetalhes[] {
  return (data as Record<string, unknown>[]).map(mapearLinha);
}

export class RetiradaRepositoryPostgres implements RetiradaRepository {
  constructor(private readonly client: SupabaseClient) {}

  private leitura() {
    return this.client
      .from("retiradas")
      .select(
        `*, pacientes(${COLUNAS_PACIENTE}), liberacoes(${COLUNAS_LIBERACAO}), usuarios(${COLUNAS_USUARIO})`
      );
  }

  async listar(): Promise<RetiradaComDetalhes[]> {
    const { data, error } = await this.leitura().order("data_hora", {
      ascending: false,
    });

    if (error) throw mapSupabaseError(error);
    return mapearLista(data ?? []);
  }

  async buscarPorId(id: string): Promise<RetiradaComDetalhes | null> {
    const { data, error } = await this.leitura().eq("id", id).maybeSingle();

    if (error) throw mapSupabaseError(error);
    if (!data) return null;
    return mapearLinha(data as Record<string, unknown>);
  }

  // NÃO envia recepcionista_id nem data_hora (o trigger preenche a partir da
  // sessão e de now() — RN28). O banco é a autoridade.
  async criar(dados: NovaRetirada): Promise<Retirada> {
    const { data, error } = await this.client
      .from("retiradas")
      .insert({
        liberacao_id: dados.liberacaoId,
        paciente_id: dados.pacienteId,
        quantidade: dados.quantidade,
      })
      .select("*")
      .single();

    if (error) throw mapSupabaseError(error);
    return data as Retirada;
  }
}
