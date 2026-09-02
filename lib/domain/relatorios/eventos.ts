// Sprint 44 — P2 Histórico: preparar domínio para ESTADO ATUAL + EVENTOS
// O histórico hoje é principalmente estado atual + soma de retiradas.
// Para a próxima UX, precisamos expor também a linha do tempo de eventos
// (criação, renovação, retirada, alteração de previsão/vigência, cancelamento)
// reutilizando auditoria_logs como fonte da verdade — sem duplicar trilha.

export type TipoEventoHistorico =
  | "liberacao.criada"
  | "liberacao.renovada"
  | "liberacao.alterada"
  | "liberacao.cancelada"
  | "retirada.registrada";

export type EventoHistorico = {
  id: number;
  acao: TipoEventoHistorico | string;
  dataHora: string;
  entidadeTipo: string;
  entidadeId: string;
  usuarioId: string;
  responsavel?: { id: string; nome: string } | null;
  dadosAntes?: Record<string, unknown> | null;
  dadosDepois?: Record<string, unknown> | null;
};

export type EstadoAtualHistorico = {
  paciente: { id: string; gestor_sus: string; nome: string } | null;
  liberacoes: import("./types").ItemHistorico[];
};

export type HistoricoCompleto = {
  estado: EstadoAtualHistorico;
  eventos: EventoHistorico[];
};

// Mapeamento puro de auditoria_logs → EventoHistorico (testável)
export function mapearEventoHistorico(linha: {
  id: number;
  acao: string;
  data_hora: string;
  entidade_tipo: string;
  entidade_id: string;
  usuario_id: string;
  dados_antes?: Record<string, unknown> | null;
  dados_depois?: Record<string, unknown> | null;
  usuarios?: { id: string; nome: string } | null;
}): EventoHistorico {
  return {
    id: linha.id,
    acao: linha.acao,
    dataHora: linha.data_hora,
    entidadeTipo: linha.entidade_tipo,
    entidadeId: linha.entidade_id,
    usuarioId: linha.usuario_id,
    responsavel: linha.usuarios ?? null,
    dadosAntes: linha.dados_antes ?? null,
    dadosDepois: linha.dados_depois ?? null,
  };
}

// Ordenação determinística de eventos por data_hora asc
export function ordenarEventos(eventos: EventoHistorico[]): EventoHistorico[] {
  return [...eventos].sort((a, b) => (a.dataHora < b.dataHora ? -1 : a.dataHora > b.dataHora ? 1 : 0));
}
