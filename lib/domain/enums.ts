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

export const QUANTIDADES_LIBERACAO = [1, 2, 4, 8] as const;
export type QuantidadeLiberacao = (typeof QUANTIDADES_LIBERACAO)[number];

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
