// Espelha a tabela public.retiradas (migration 20260811000005_retiradas.sql).
export type Retirada = {
  id: string;
  liberacao_id: string;
  paciente_id: string;
  recepcionista_id: string;
  quantidade: number;
  data_hora: string;
  unidade_id: string | null;
};

// Dados mínimos para registrar uma retirada. O frontend NÃO define
// recepcionista_id nem data_hora (sessão/trigger controlam — RN28).
export type NovaRetirada = {
  liberacaoId: string;
  pacienteId: string;
  quantidade: number;
};

// Resumos das FKs embutidas na leitura (mesmo padrão de LiberacaoComPaciente,
// sem CPF e sem campos não necessários à listagem). Reutiliza PacienteResumo
// de liberações — o paciente é o mesmo conceito dos módulos de liberações/pacientes.
import type { PacienteResumo } from "@/lib/domain/liberacoes/types";

export type { PacienteResumo };

// Liberação resumida da retirada (tipo/quantidade/período). Não há coluna de
// "situação" em retiradas — o status pertence à liberação e é refletido aqui
// conforme a RLS do leitor (a recepção só enxerga liberações ativas).
export type LiberacaoResumo = {
  id: string;
  tipo: "continua" | "avulsa";
  quantidade: number;
  data_inicio: string;
  data_fim: string;
};

// Quem realizou a retirada. public.usuarios só é legível pelo Gestor ativo
// (usuarios_select_gestor) — para a recepção o embed retorna null por RLS.
export type UsuarioResumo = {
  id: string;
  nome: string;
};

// Retirada enriquecida com as FKs para a UI. Cada embed é best-effort: se o
// leitor não tiver visão (ex.: recepção sobre liberação não ativa ou usuários),
// o valor é null e a UI renderiza o que estiver disponível.
export type RetiradaComDetalhes = Retirada & {
  paciente: PacienteResumo | null;
  liberacao: LiberacaoResumo | null;
  recepcionista: UsuarioResumo | null;
};
