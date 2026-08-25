// Rótulos e formatação exibíveis na UI de relatórios — funções PURAS e
// testáveis, sem dependência de banco/Next. Reutilizam os rótulos canônicos do
// domínio (ROTULO_TIPO_LIBERACAO / ROTULO_STATUS_LIBERACAO) — nunca duplicam
// valores persistidos.

import {
  ROTULO_STATUS_LIBERACAO,
  ROTULO_TIPO_LIBERACAO,
  STATUS_LIBERACAO,
  TIPOS_LIBERACAO,
} from "@/lib/domain/enums";
import {
  TIPOS_RELATORIO,
  type TipoRelatorio,
} from "@/lib/domain/relatorios/types";

export const ROTULO_TIPO_RELATORIO: Record<TipoRelatorio, string> = {
  [TIPOS_RELATORIO[0]]: "Resumo",
  [TIPOS_RELATORIO[1]]: "Liberações",
  [TIPOS_RELATORIO[2]]: "Retiradas",
  [TIPOS_RELATORIO[3]]: "Consolidado",
  [TIPOS_RELATORIO[4]]: "Histórico",
};

export function rotuloTipoRelatorio(tipo: string): string {
  return (TIPOS_RELATORIO as readonly string[]).includes(tipo)
    ? ROTULO_TIPO_RELATORIO[tipo as TipoRelatorio]
    : "Relatórios";
}

export function rotuloTipoLiberacao(tipo: string): string {
  return (Object.values(TIPOS_LIBERACAO) as string[]).includes(tipo)
    ? ROTULO_TIPO_LIBERACAO[tipo as keyof typeof ROTULO_TIPO_LIBERACAO]
    : tipo;
}

export function rotuloStatusLiberacao(status: string): string {
  return (Object.values(STATUS_LIBERACAO) as string[]).includes(status)
    ? ROTULO_STATUS_LIBERACAO[status as keyof typeof ROTULO_STATUS_LIBERACAO]
    : status;
}

// Conversão determinística de ISO (data ou data/hora) para dd/mm/aaaa — mesmo
// critério das retiradas: sem depender do fuso local do navegador/servidor.
export function formatarData(iso: string): string {
  const [data] = iso.split("T");
  const [ano, mes, dia] = (data ?? "").split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

export function formatarDataHora(iso: string): string {
  const [data, hora] = iso.split("T");
  const [ano, mes, dia] = (data ?? "").split("-");
  const hhmm = (hora ?? "").slice(0, 5);
  return ano && mes && dia ? `${dia}/${mes}/${ano} · ${hhmm}` : iso;
}

// Descrição curta do período de vigência de uma liberação (RN13/RN21):
// contínua mostra "de a"; avulsa mostra só o dia de início.
export function descreverPeriodo(linha: {
  tipo: string;
  dataInicio: string;
  dataFim: string;
}): string {
  if (linha.tipo === TIPOS_LIBERACAO.AVULSA) {
    return formatarData(linha.dataInicio);
  }
  return `${formatarData(linha.dataInicio)} a ${formatarData(linha.dataFim)}`;
}

// Rótulos de origem para o histórico por paciente.
// Liberação original: "Liberação original". Renovação: data da liberação de origem.
export function rotuloOrigemLiberacao(item: {
  renovacaoDeId: string | null;
  origem: { dataInicio: string } | null;
}): string {
  if (item.renovacaoDeId == null) {
    return "Liberação original";
  }
  if (item.origem?.dataInicio) {
    return `Renovação da liberação de ${formatarData(item.origem.dataInicio)}`;
  }
  return "Renovação";
}

// Descrição curta da origem (formato textual, usado em tooltips/cards).
export function descreverOrigemLiberacao(item: {
  renovacaoDeId: string | null;
  origem: { dataInicio: string } | null;
}): string {
  if (item.renovacaoDeId == null) {
    return "Liberação original";
  }
  if (item.origem?.dataInicio) {
    return formatarData(item.origem.dataInicio);
  }
  return "Renovação sem data";
}
