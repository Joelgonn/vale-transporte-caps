import type { StatusPaciente } from "@/lib/domain/enums";

// Espelha a tabela public.pacientes (migration 20260811000002_pacientes.sql).
export type Paciente = {
  id: string;
  gestor_sus: string;
  nome: string;
  cpf: string | null;
  status: StatusPaciente;
  data_inicio_acompanhamento: string | null;
  data_fim_acompanhamento: string | null;
  unidade_id: string | null;
  created_at: string;
  updated_at: string;
};

// Leitura padrão através de v_pacientes — nunca expõe CPF.
export type PacienteSemCpf = Omit<Paciente, "cpf">;

export type NovoPaciente = {
  gestor_sus: string;
  nome: string;
  cpf?: string | null;
  data_inicio_acompanhamento?: string | null;
  data_fim_acompanhamento?: string | null;
  unidade_id?: string | null;
};

export type AtualizacaoPaciente = {
  nome?: string;
  cpf?: string | null;
  data_inicio_acompanhamento?: string | null;
  data_fim_acompanhamento?: string | null;
  unidade_id?: string | null;
  status?: StatusPaciente;
};
