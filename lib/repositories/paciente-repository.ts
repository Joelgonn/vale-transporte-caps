import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/domain/app-error";
import type {
  AtualizacaoPaciente,
  NovoPaciente,
  Paciente,
  PacienteSemCpf,
} from "@/lib/domain/pacientes/types";

// Contrato usado pelos services (permite injeção de fakes nos testes).
export interface PacienteRepository {
  listar(busca?: string): Promise<PacienteSemCpf[]>;
  buscarPorId(id: string): Promise<PacienteSemCpf | null>;
  buscarPorGestorSus(gestorSus: string): Promise<PacienteSemCpf | null>;
  buscarCpf(pacienteId: string): Promise<Paciente | null>;
  criar(dados: NovoPaciente): Promise<PacienteSemCpf>;
  atualizar(id: string, dados: AtualizacaoPaciente): Promise<PacienteSemCpf>;
}

const COLUNAS_SEM_CPF =
  "id, gestor_sus, nome, status, origem, data_inicio_acompanhamento, " +
  "data_fim_acompanhamento, unidade_id, created_at, updated_at";

// Remove caracteres de padrão/wildcard e limita o tamanho para uso seguro como
// termo de filtro no PostgREST (ilike). Nunca é interpolado em SQL pelo app.
export function normalizarBusca(busca?: string): string {
  return (busca ?? "").replace(/[%_(),;]/g, "").trim().slice(0, 60);
}

export class PacienteRepositoryPostgres implements PacienteRepository {
  constructor(private readonly client: SupabaseClient) {}

  // Leitura normal sempre via v_pacientes (não expõe CPF).
  // Pesquisa por nome ou gestor_sus (contém, insensível a maiúsculas).
  async listar(busca?: string): Promise<PacienteSemCpf[]> {
    const termo = normalizarBusca(busca);
    let query = this.client.from("v_pacientes").select(COLUNAS_SEM_CPF);

    if (termo) {
      query = query.or(
        `nome.ilike.%${termo}%,gestor_sus.ilike.%${termo}%`
      );
    }

    const { data, error } = await query.order("nome", { ascending: true });

    if (error) throw mapSupabaseError(error);
    return (data ?? []) as unknown as PacienteSemCpf[];
  }

  async buscarPorId(id: string): Promise<PacienteSemCpf | null> {
    const { data, error } = await this.client
      .from("v_pacientes")
      .select(COLUNAS_SEM_CPF)
      .eq("id", id)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    return (data as PacienteSemCpf | null) ?? null;
  }

  async buscarPorGestorSus(gestorSus: string): Promise<PacienteSemCpf | null> {
    const { data, error } = await this.client
      .from("v_pacientes")
      .select(COLUNAS_SEM_CPF)
      .eq("gestor_sus", gestorSus)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    return (data as PacienteSemCpf | null) ?? null;
  }

  // CPF SOMENTE via pacientes_com_cpf() (função SECURITY DEFINER com gate de
  // gestor ativo). Nunca seleciona a coluna cpf diretamente.
  async buscarCpf(pacienteId: string): Promise<Paciente | null> {
    const { data, error } = await this.client
      .rpc("pacientes_com_cpf")
      .eq("id", pacienteId)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    return (data as unknown as Paciente | null) ?? null;
  }

  async criar(dados: NovoPaciente): Promise<PacienteSemCpf> {
    const { data, error } = await this.client
      .from("pacientes")
      .insert({
        gestor_sus: dados.gestor_sus,
        nome: dados.nome,
        // Origem resolvida no servidor (criarPacienteAction) — a RLS
        // (pacientes_insert_regular / _recepcao_esporadico) é a autoridade.
        origem: dados.origem ?? "regular",
        cpf: dados.cpf ?? null,
        data_inicio_acompanhamento: dados.data_inicio_acompanhamento ?? null,
        data_fim_acompanhamento: dados.data_fim_acompanhamento ?? null,
        unidade_id: dados.unidade_id ?? null,
      })
      .select(COLUNAS_SEM_CPF)
      .single();

    if (error) throw mapSupabaseError(error);
    return data as unknown as PacienteSemCpf;
  }

  async atualizar(id: string, dados: AtualizacaoPaciente): Promise<PacienteSemCpf> {
    const { data, error } = await this.client
      .from("pacientes")
      .update(dados)
      .eq("id", id)
      .select(COLUNAS_SEM_CPF)
      .single();

    if (error) throw mapSupabaseError(error);
    return data as unknown as PacienteSemCpf;
  }
}
