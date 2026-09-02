// Mapeamento puro do HISTÓRICO POR PACIENTE (Sprint 38). Traduz as linhas
// brutas do PostgREST (liberacoes + embeds de autorizador/registrador/
// retiradas/origem) em ItemHistorico. Funções PURAS e testáveis — o
// repositório apenas as chama; nenhuma regra de negócio vive no componente.

import type { ItemHistorico } from "@/lib/domain/relatorios/types";
import {
  mapearEmbutido,
  somarQuantidades,
} from "@/lib/domain/relatorios/mapeamento";

// Linha bruta retornada pelo PostgREST para o histórico. `origem` é o embed
// to-one via FK self-referencial liberacoes_renovacao_de_id_fkey (a liberação
// anterior da cadeia); `retiradas` é o to-many (data_hora, quantidade).
export type LinhaHistoricoBruta = {
  id: string;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  quantidade: number;
  periodo_meses: number | null;
  status: string;
  renovacao_de_id: string | null;
  autorizador?: unknown;
  registrador?: unknown;
  retiradas?: unknown;
  origem?: unknown;
};

// Maior data_hora entre as retiradas da liberação (última retirada). Comparação
// lexicográfica de ISO é determinística e independente de fuso.
function ultimaRetiradaDe(retiradas: unknown): string | null {
  const linhas = Array.isArray(retiradas) ? retiradas : [];
  let ultima: string | null = null;
  for (const linha of linhas) {
    const dataHora = (linha as { data_hora?: unknown })?.data_hora;
    if (typeof dataHora !== "string" || !dataHora) continue;
    if (!ultima || dataHora > ultima) ultima = dataHora;
  }
  return ultima;
}

function mapearRetiradas(retiradas: unknown): { dataHora: string; quantidade: number }[] {
  if (!Array.isArray(retiradas)) return [];
  const lista: { dataHora: string; quantidade: number }[] = [];
  for (const r of retiradas) {
    const dataHora = (r as { data_hora?: unknown })?.data_hora;
    const quantidade = (r as { quantidade?: unknown })?.quantidade;
    if (typeof dataHora === "string" && typeof quantidade === "number") {
      lista.push({ dataHora, quantidade });
    }
  }
  // ordena cronologicamente
  lista.sort((a, b) => (a.dataHora < b.dataHora ? -1 : a.dataHora > b.dataHora ? 1 : 0));
  return lista;
}

export function mapearItemHistorico(linha: LinhaHistoricoBruta): ItemHistorico {
  const autorizador = mapearEmbutido<{ id: string; nome: string }>(linha.autorizador);
  const registrador = mapearEmbutido<{ id: string; nome: string }>(linha.registrador);
  const origemRaw = mapearEmbutido<{ id: string; data_inicio: string; tipo: string; quantidade: number }>(
    linha.origem
  );
  const origem = origemRaw?.id ? { id: origemRaw.id, dataInicio: origemRaw.data_inicio, tipo: origemRaw.tipo, quantidade: origemRaw.quantidade } : null;
  const quantidadeRetirada = somarQuantidades(linha.retiradas);
  const numeroRetiradas = Array.isArray(linha.retiradas) ? linha.retiradas.length : 0;

  return {
    id: linha.id,
    dataInicio: linha.data_inicio,
    dataFim: linha.data_fim,
    tipo: linha.tipo,
    quantidade: linha.quantidade,
    periodoMeses: linha.periodo_meses,
    status: linha.status,
    renovacaoDeId: linha.renovacao_de_id ?? null,
    autorizador: autorizador?.id ? { ...autorizador } : null,
    registrador: registrador?.id ? { ...registrador } : null,
    origem,
    quantidadeRetirada,
    numeroRetiradas,
    ultimaRetirada: ultimaRetiradaDe(linha.retiradas),
    saldo: linha.quantidade - quantidadeRetirada,
    retiradas: mapearRetiradas(linha.retiradas),
  };
}

// Predicados da cadeia. renovacao_de_id é a fonte de verdade: uma renovação é
// uma NOVA liberação que aponta para a anterior (RN23); original é a raiz.
export function ehRenovacao(item: Pick<ItemHistorico, "renovacaoDeId">): boolean {
  return item.renovacaoDeId != null;
}

export function ehOriginal(item: Pick<ItemHistorico, "renovacaoDeId">): boolean {
  return item.renovacaoDeId == null;
}

export type { ItemHistorico } from "@/lib/domain/relatorios/types";
export { somarQuantidades };
