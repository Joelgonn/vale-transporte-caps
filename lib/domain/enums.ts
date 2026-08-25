// Enums do domínio — espelham os tipos do banco (migrations 20260811000001_enums.sql).
// Única fonte de verdade para os valores dos enums na camada de aplicação.

export const PERFIS = {
  PROFISSIONAL_AUTORIZADOR: "profissional_autorizador",
  RECEPCIONISTA: "recepcionista",
  GESTOR: "gestor",
} as const;

export type PerfilUsuario = (typeof PERFIS)[keyof typeof PERFIS];

export const PROFISSOES = {
  ASSISTENTE_SOCIAL: "assistente_social",
  PSICOLOGO: "psicologo",
  TERAPEUTA_OCUPACIONAL: "terapeuta_ocupacional",
} as const;

export type Profissao = (typeof PROFISSOES)[keyof typeof PROFISSOES];

// Rótulos exibíveis na UI (sem duplicar valores canônicos). Os enums acima
// continuam sendo a única fonte dos valores persistidos no banco.
export const ROTULO_PERFIL: Record<PerfilUsuario, string> = {
  [PERFIS.PROFISSIONAL_AUTORIZADOR]: "Profissional autorizador",
  [PERFIS.RECEPCIONISTA]: "Recepcionista",
  [PERFIS.GESTOR]: "Gestor",
};

export const ROTULO_PROFISSAO: Record<Profissao, string> = {
  [PROFISSOES.ASSISTENTE_SOCIAL]: "Assistente social",
  [PROFISSOES.PSICOLOGO]: "Psicólogo(a)",
  [PROFISSOES.TERAPEUTA_OCUPACIONAL]: "Terapeuta ocupacional",
};

export const STATUS_PACIENTE = {
  ATIVO: "ativo",
  INATIVO: "inativo",
} as const;

export type StatusPaciente = (typeof STATUS_PACIENTE)[keyof typeof STATUS_PACIENTE];

// Sprint 38 — origem do paciente (enum origem_paciente, migration
// 20260821000001). 'regular' = acompanhamento contínuo no CAPS;
// 'esporadico' = atendimento pontual criado pela recepção, que só pode
// receber liberação avulsa (RN29).
export const ORIGENS_PACIENTE = {
  REGULAR: "regular",
  ESPORADICO: "esporadico",
} as const;

export type OrigemPaciente =
  (typeof ORIGENS_PACIENTE)[keyof typeof ORIGENS_PACIENTE];

export const ROTULO_ORIGEM_PACIENTE: Record<OrigemPaciente, string> = {
  [ORIGENS_PACIENTE.REGULAR]: "Regular",
  [ORIGENS_PACIENTE.ESPORADICO]: "Esporádico",
};

export const TIPOS_LIBERACAO = {
  CONTINUA: "continua",
  AVULSA: "avulsa",
} as const;

export type TipoLiberacao = (typeof TIPOS_LIBERACAO)[keyof typeof TIPOS_LIBERACAO];

export const STATUS_LIBERACAO = {
  ATIVA: "ativa",
  EXPIRADA: "expirada",
  CANCELADA: "cancelada",
} as const;

export type StatusLiberacao = (typeof STATUS_LIBERACAO)[keyof typeof STATUS_LIBERACAO];

// Sprint 42.1 — a previsão deixou de ser um seletor fechado {1,2,4,8}: com
// RN31 (previsão não bloqueia), o usuário pode estimar livremente (ex.: 96).
// Mantido apenas como referência histórica da escala original do MVP.
export const QUANTIDADES_LIBERACAO = [1, 2, 4, 8] as const;
export type QuantidadeLiberacao = number;

export const PERIODOS_LIBERACAO = [1, 3, 6] as const;
export type PeriodoLiberacao = (typeof PERIODOS_LIBERACAO)[number];

// Rótulos exibíveis na UI para tipo e status de liberação (sem duplicar os
// valores canônicos). Espelham o padrão de ROTULO_PERFIL/ROTULO_PROFISSAO.
export const ROTULO_TIPO_LIBERACAO: Record<TipoLiberacao, string> = {
  [TIPOS_LIBERACAO.CONTINUA]: "Contínua",
  [TIPOS_LIBERACAO.AVULSA]: "Avulsa",
};

export const ROTULO_STATUS_LIBERACAO: Record<StatusLiberacao, string> = {
  [STATUS_LIBERACAO.ATIVA]: "Ativa",
  [STATUS_LIBERACAO.EXPIRADA]: "Expirada",
  [STATUS_LIBERACAO.CANCELADA]: "Cancelada",
};
