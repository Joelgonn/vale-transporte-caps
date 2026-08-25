import type {
  PeriodoLiberacao,
  QuantidadeLiberacao,
  StatusLiberacao,
  TipoLiberacao,
} from "@/lib/domain/enums";

// Espelha a tabela public.liberacoes (migration 20260811000004_liberacoes.sql).
export type Liberacao = {
  id: string;
  paciente_id: string;
  tipo: TipoLiberacao;
  quantidade: QuantidadeLiberacao;
  periodo_meses: PeriodoLiberacao | null;
  data_inicio: string;
  data_fim: string;
  profissional_autorizador_id: string;
  registrado_por_id: string;
  renovacao_de_id: string | null;
  status: StatusLiberacao;
  justificativa: string | null;
  unidade_id: string | null;
  created_at: string;
  updated_at: string;
};

// Resumo do paciente exposto na listagem de liberações (via FK embutida).
// Nunca contém CPF — a regra de proteção do CPF permanece no banco.
export type PacienteResumo = {
  id: string;
  gestor_sus: string;
  nome: string;
};

// Liberação enriquecida com o paciente (nome/Gestor SUS) para a UI.
export type LiberacaoComPaciente = Liberacao & {
  paciente: PacienteResumo | null;
};

// Dados mínimos para criar uma liberação. O frontend NÃO define
// registrado_por_id (sessão/trigger controlam) nem data_fim (trigger calcula).
//
// Para o fluxo do profissional autorizador, profissionalAutorizadorId é
// INFORMADO pela sessão (server-side, via public.usuario_atual_id()) — o
// cliente não envia. No fluxo de renovação da recepção, o valor é repassado
// da liberação original juntamente com renovacaoDeId.
export type NovaLiberacao = {
  pacienteId: string;
  profissionalAutorizadorId?: string;
  tipo: TipoLiberacao;
  quantidade: QuantidadeLiberacao;
  periodoMeses?: PeriodoLiberacao | null;
  renovacaoDeId?: string | null;
};

// Renovação: o cliente envia APENAS o id da liberação original (renovacao_de_id).
// O servidor (criarLiberacaoAction) localiza a original e preserva o autorizador
// original e os parâmetros — o cliente nunca informa profissional_autorizador_id.
export type RenovacaoLiberacao = {
  renovacaoDeId: string;
};

// Entrada pública de criarLiberacaoAction: nova liberação OU renovação.
export type CriarLiberacaoDados = NovaLiberacao | RenovacaoLiberacao;

// Sprint 42 — atualização de liberação. O payload do cliente NUNCA chega cru
// ao repository: a action aplica CAMPOS_EDICAO_LIBERACAO_POR_PERFIL (whitelist
// por perfil) e validarAtualizacaoLiberacao; o banco (trigger
// fn_libracoes_before + policy liberacoes_update_autorizador_gestor) é a
// autoridade final. Campos históricos (paciente, tipo, período, autorizador,
// renovação) são imutáveis em TODAS as camadas.
// `quantidade` é PREVISÃO administrativa (RN04) — não bloqueia retiradas.
export type AtualizacaoLiberacao = {
  quantidade?: QuantidadeLiberacao;
  data_inicio?: string;
  data_fim?: string;
  justificativa?: string | null;
  unidade_id?: string | null;
  status?: StatusLiberacao;
};
