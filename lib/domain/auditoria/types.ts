// Tipos da consulta de auditoria (Sprint 21). Espelham a tabela
// public.auditoria_logs (migration 06) e os identificadores canônicos gerados
// pela trigger fn_auditoria (migration 07/20). Nada aqui inventa campos: a
// fonte de dados é o banco e o que ele armazena.

// Um registro da trilha de auditoria, com o responsável embutido (usuarios)
// para exibição — gestor ativo é o único perfil com RLS de leitura.
export type EventoAuditoria = {
  id: number;
  acao: string;
  entidadeTipo: string;
  entidadeId: string;
  usuarioId: string;
  dadosAntes: Record<string, unknown> | null;
  dadosDepois: Record<string, unknown> | null;
  dataHora: string;
  responsavel: { id: string; nome: string } | null;
};

// Filtros da consulta. Todos são opcionais e aplicados NO SERVIDOR (PostgREST
// eq/gte/lte) — nunca filtramos no navegador sobre dados incompletos.
export type FiltrosAuditoria = {
  acao?: string | null;
  entidadeTipo?: string | null;
  dataDe?: string | null;
  dataAte?: string | null;
  usuarioId?: string | null;
  pagina: number;
};

export const POR_PAGINA_AUDITORIA = 20;

export type ResultadoListaAuditoria = {
  eventos: EventoAuditoria[];
  total: number;
  pagina: number;
  porPagina: number;
};
