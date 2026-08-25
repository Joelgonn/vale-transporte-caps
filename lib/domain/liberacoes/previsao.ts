// Sprint 42.1 — Calculador de previsão de vales (função PURA, sem dependências).
//
// A previsão é um auxílio EXCLUSIVAMENTE de interface para preencher
// `liberacoes.quantidade` (que, conforme RN31, é QUANTIDADE PREVISTA — nunca
// limite de retirada). `valesPorDia` e `diasPorSemana` NUNCA são persistidos:
// são apenas parâmetros do formulário.
//
// Semanas consideradas (convenção aprovada):
//   1 mês = 4 semanas · 3 meses = 12 semanas · 6 meses = 24 semanas.

export const SEMANAS_POR_MES = 4;

export type PrevisaoVales = {
  valesPorDia: number;
  diasPorSemana: number;
  valesPorSemana: number;
  semanas: number;
  previsaoTotal: number;
};

// Converte o período da liberação em semanas (apenas contínuas possuem meses).
export function periodoParaSemanas(periodoMeses: number): number {
  return Math.max(0, Math.floor(periodoMeses)) * SEMANAS_POR_MES;
}

// Calcula a previsão total a partir dos parâmetros auxiliares do formulário.
// Entradas inválidas/negativas são tratadas como 0 — o resultado é sempre um
// inteiro ≥ 0, puramente informativo.
export function calcularPrevisaoVales(
  valesPorDia: number,
  diasPorSemana: number,
  periodoMeses: number
): PrevisaoVales {
  const dia = inteiroNaoNegativo(valesPorDia);
  const dias = inteiroNaoNegativo(diasPorSemana);
  const semanas = periodoParaSemanas(periodoMeses);
  const valesPorSemana = dia * dias;

  return {
    valesPorDia: dia,
    diasPorSemana: dias,
    valesPorSemana,
    semanas,
    previsaoTotal: valesPorSemana * semanas,
  };
}

function inteiroNaoNegativo(valor: number): number {
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0;
}
