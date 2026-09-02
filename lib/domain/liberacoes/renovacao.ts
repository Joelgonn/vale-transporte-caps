// Sprint 44 P2 — Formalização das regras de renovação
// Documenta o comportamento atual e as decisões pendentes, sem impor
// constraint destrutiva (UNIQUE) antes de verificar dados existentes.

export type StatusLiberacao = "ativa" | "expirada" | "cancelada";

export type RegraRenovacao = {
  podeRenovarAtiva: true; // permitido: renovação antecipada para continuidade
  podeRenovarExpirada: true; // permitido: reativação após vencimento
  podeRenovarCancelada: false; // proibido: cancelada é estado administrativo final
  permiteMultiplasRenovacoesMesmaOrigem: "pendente"; // UNIQUE(renovacao_de_id) pendente — verificar duplicidades antes
  continuidadeDatas: "recomendado_gap_minimo"; // continuidade recomendada (nova data_inicio >= origem data_fim), mas não bloqueante — pode haver sobreposição/gap operacional
  autorizadorInativo: "bloquear"; // se autorizador original inativo (RN27), renovação deve ser bloqueada e exigir nova autorização
};

// Validação não-destrutiva para uso em service/action quando decisão for aplicada
export function podeRenovarStatus(statusOrigem: StatusLiberacao): boolean {
  if (statusOrigem === "cancelada") return false;
  return statusOrigem === "ativa" || statusOrigem === "expirada";
}

export const RENOVACAO_REGRAS: RegraRenovacao = {
  podeRenovarAtiva: true,
  podeRenovarExpirada: true,
  podeRenovarCancelada: false,
  permiteMultiplasRenovacoesMesmaOrigem: "pendente",
  continuidadeDatas: "recomendado_gap_minimo",
  autorizadorInativo: "bloquear",
};

export const RENOVACAO_DECISOES_PENDENTES = [
  "UNIQUE(renovacao_de_id) — verificar duplicidades existentes antes de aplicar",
  "Gaps/sobreposições de vigência — definir tolerância institucional",
  "Procedimento quando autorizador original inativo — exigir novo autorizador ativo",
] as const;
