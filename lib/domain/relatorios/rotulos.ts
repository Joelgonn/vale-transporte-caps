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

// ── Dia/hora LOCAL para timestamps de evento (Sprint 77 Histórico, Sprint 78
// Retiradas + Auditoria) ──────────────────────────────────────────────────
// Timestamps persistidos são UTC; exibir/agrupar por `slice(0, 10)` força o dia
// UTC e um evento próximo da meia-noite cai no dia errado para o usuário.
// Estas funções interpretam o timestamp no fuso da interface (padrão: fuso
// local do ambiente; testes passam `timeZone` explícito) — SOMENTE
// representação visual, sem tocar em data_hora/created_at/banco.
// Escopo: timestamps de EVENTO (retirada.data_hora, auditoria.data_hora,
// timeline do Histórico). Datas de NEGÓCIO (data_inicio/data_fim) mantêm
// formatarData/formatarDataHora (UTC-slice determinístico).

// Chave de agrupamento `AAAA-MM-DD` no fuso indicado (determinística via Intl).
export function obterChaveDiaLocal(iso: string, timeZone?: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso.slice(0, 10);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instante);
  } catch {
    return iso.slice(0, 10);
  }
}

// `dd/mm/aaaa · hh:mm` no fuso indicado (mesmo fuso do agrupamento, para
// cabeçalho do grupo e horário do evento nunca divergirem).
export function formatarDataHoraLocal(iso: string, timeZone?: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(instante);
    const ler = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
    return `${ler("day")}/${ler("month")}/${ler("year")} · ${ler("hour")}:${ler("minute")}`;
  } catch {
    return iso;
  }
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
