// Sprint 44 — Glossário oficial dos relatórios.
// Centraliza a semântica de Previsto/Retirado/Diferença por tipo de relatório
// para que DOMAIN.md, DATABASE.md e a UI usem a mesma terminologia.

export const GLOSSARIO_RESUMO = {
  previsto:
    "Quantidade prevista autorizada por liberações cujo início (data_inicio) pertence ao período selecionado.",
  retirado:
    "Quantidade retirada cuja data/hora (data_hora) pertence ao período — conjunto independente do previsto. Uma retirada contra liberação anterior ao período conta no período em que ocorreu.",
  diferenca:
    "Previsto − Retirado no período (derivado, nunca armazenado). Negativa indica consumo acima da previsão do período (estouro operacional, não bloqueio — RN31).",
} as const;

export const GLOSSARIO_CONSOLIDADO = {
  previsto: "Previsão daquela liberação (liberacoes.quantidade).",
  retirado: "Total acumulado retirado daquela liberação (Σ retiradas).",
  diferenca: "Previsto − Retirado acumulado (derivado por liberação). Negativa indica estouro.",
} as const;

export const GLOSSARIO_HISTORICO = {
  previsto: "Previsão daquela liberação (valor atual; se editada, reflete última edição — ver eventos).",
  retirado: "Total acumulado retirado daquela liberação.",
  diferenca: "Previsto − Retirado acumulado.",
} as const;

export const GLOSSARIO_LIBERACOES = {
  previsto: "Previsão daquela liberação.",
  retirado: "Total retirado daquela liberação (Σ retiradas).",
} as const;

export const GLOSSARIO_RETIRADAS = {
  quantidade: "Quantidade daquela retirada individual (retiradas.quantidade).",
} as const;

// Nota de vigência da convenção de previsão (Sprint 44 P2).
export const CONVENCAO_PREVISAO = "Para fins de previsão administrativa do CAPS, 1 mês = 4 semanas (SEMANAS_POR_MES=4). Não persistimos valesPorDia/diasPorSemana.";
