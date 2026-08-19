import { validarNovoPaciente } from "@/lib/domain/regras";
import type {
  AtualizacaoPaciente,
  NovoPaciente,
  PacienteSemCpf,
} from "@/lib/domain/pacientes/types";
import {
  PacienteRepositoryPostgres,
  type PacienteRepository,
} from "@/lib/repositories/paciente-repository";

// Casos de uso de pacientes. O banco (RLS + triggers) permanece a autoridade;
// aqui validamos apenas o que faz sentido antes de enviar ao banco.
export class PacienteService {
  constructor(private readonly repo: PacienteRepository) {}

  // Fábrica padrão com o cliente de servidor (cookies de sessão).
  static async create(): Promise<PacienteService> {
    const { createClient } = await import("@/lib/supabase/server");
    return new PacienteService(new PacienteRepositoryPostgres(await createClient()));
  }

  async listarPacientes(busca?: string): Promise<PacienteSemCpf[]> {
    return this.repo.listar(busca);
  }

  async buscarPaciente(id: string): Promise<PacienteSemCpf | null> {
    return this.repo.buscarPorId(id);
  }

  async buscarPacientePorGestorSus(gestorSus: string): Promise<PacienteSemCpf | null> {
    return this.repo.buscarPorGestorSus(gestorSus);
  }

  // CPF apenas via pacientes_com_cpf() (gate interno de gestor ativo).
  async buscarCpf(pacienteId: string): Promise<{ cpf: string | null } | null> {
    const resultado = await this.repo.buscarCpf(pacienteId);
    return resultado ? { cpf: resultado.cpf } : null;
  }

  async criarPaciente(dados: NovoPaciente): Promise<PacienteSemCpf> {
    validarNovoPaciente(dados);
    return this.repo.criar(dados);
  }

  async atualizarPaciente(
    id: string,
    dados: AtualizacaoPaciente
  ): Promise<PacienteSemCpf> {
    return this.repo.atualizar(id, dados);
  }
}
