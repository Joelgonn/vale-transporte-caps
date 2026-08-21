import type { OrigemPaciente, StatusPaciente } from "@/lib/domain/enums";

// Espelha a tabela public.pacientes (migrations 20260811000002_pacientes.sql e
// 20260821000001_pacientes_origem.sql).
export type Paciente = {
  id: string;
  gestor_sus: string;
  nome: string;
  cpf: string | null;
  status: StatusPaciente;
  origem: OrigemPaciente;
  data_inicio_acompanhamento: string | null;
  data_fim_acompanhamento: string | null;
  unidade_id: string | null;
  created_at: string;
  updated_at: string;
};

// Leitura padrão através de v_pacientes — nunca expõe CPF.
export type PacienteSemCpf = Omit<Paciente, "cpf">;

// Criação de paciente. A ORIGEM é resolvida no SERVIDOR a partir do perfil da
// sessão (criarPacienteAction) — o cliente não escolhe livremente:
//   * gestor / profissional_autorizador → 'regular';
//   * recepcionista → 'esporadico'.
export type NovoPaciente = {
  gestor_sus: string;
  nome: string;
  origem?: OrigemPaciente;
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
