// Tipos da consulta de relatórios (Sprint 37 — Fase 8 do ROADMAP).
// Espelham as tabelas public.liberacoes, public.retiradas e public.pacientes.
// Nada aqui inventa campos: a fonte de dados é o banco e o que ele armazena.
// Os relatórios NÃO incluem CPF (o contrato não exige; somente o Gestor lê
// pacientes_com_cpf, e essa coluna não entra nas consultas de relatório).

// Relatórios disponíveis. Ordem exibida na UI (seletor de abas). "Resumo"
// (Sprint 40) é a visão gerencial agregada; os demais são listas detalhadas.
export const TIPOS_RELATORIO = [
  "resumo",
  "liberacoes",
  "retiradas",
  "consolidado",
  "historico",
] as const;
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number];

// Filtros da consulta. Todos são opcionais e aplicados NO SERVIDOR (PostgREST
// eq/gte/lte + range) — nunca filtramos no navegador sobre dados incompletos.
// `status` e `origem` existem somente no histórico por paciente; `paciente`
// seleciona o paciente do histórico (id de v_pacientes).
// Sprint 53 — `situacaoConsolidado` é filtro de visualização do consolidado
// (estouro/sem_retirada/proximo_vencimento/expirada_sem_uso).
// Sprint 54 — `situacaoLiberacoes` e `status` também para liberações.
export type FiltrosRelatorio = {
  tipo: TipoRelatorio;
  de?: string | null; // YYYY-MM-DD (início do período)
  ate?: string | null; // YYYY-MM-DD (fim do período — inclui o dia todo)
  busca?: string | null; // nome / Gestor SUS do paciente
  tipoLiberacao?: string | null; // somente no relatório de liberações (e retiradas Sprint 55)
  paciente?: string | null; // id do paciente (somente histórico)
  status?: string | null; // status_liberacao (histórico e liberações Sprint 54)
  origem?: string | null; // "original" | "renovacao" (somente histórico)
  situacaoConsolidado?: string | null; // Sprint 53 — filtro do consolidado
  situacaoLiberacoes?: string | null; // Sprint 54 — filtro de liberações
  situacaoRetiradas?: string | null; // Sprint 55 — filtro de retiradas (acima_previsao/fora_vigencia)
  pagina: number;
};

export const POR_PAGINA_RELATORIO = 20;

// Linha do relatório de LIBERAÇÕES. `totalRetirado` é somado no repositório a
// partir do embed retiradas(quantidade) — mesma derivação do saldo de retiradas.
// Sprint 54 — inclui origem do paciente e renovacaoDeId para renovação.
export type LinhaLiberacoes = {
  id: string;
  paciente: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null;
  tipo: string;
  quantidade: number;
  periodoMeses: number | null;
  dataInicio: string;
  dataFim: string;
  status: string;
  autorizador: { id: string; nome: string } | null;
  totalRetirado: number;
  renovacaoDeId: string | null;
};

// Linha do relatório de RETIRADAS.
// Sprint 55 — inclui origem do paciente e dados da liberação para situação operacional.
export type LinhaRetiradas = {
  id: string;
  dataHora: string;
  paciente: { id: string; gestor_sus: string; nome: string; origem?: string | null } | null;
  liberacao: { id: string; tipo: string; quantidade: number; data_inicio?: string; data_fim?: string; status?: string } | null;
  quantidade: number;
  recepcionista: { id: string; nome: string } | null;
};

// Linha do relatório CONSOLIDADO (autorizado vs. entregue por liberação).
// `saldo` é derivado no servidor: quantidade autorizada − total retirado.
// Sprint 53 — inclui período/status para alertas (próximo vencimento, expirada sem uso).
export type LinhaConsolidado = {
  liberacaoId: string;
  paciente: { id: string; gestor_sus: string; nome: string } | null;
  tipo: string;
  quantidadeAutorizada: number;
  quantidadeRetirada: number;
  saldo: number;
  dataInicio: string;
  dataFim: string;
  status: string;
  periodoMeses: number | null;
};

// Origem de uma renovação: a liberação anterior da cadeia (via renovacao_de_id).
export type OrigemHistorico = {
  id: string;
  dataInicio: string;
  tipo: string;
  quantidade: number;
};

// Item do HISTÓRICO POR PACIENTE (Sprint 38, ampliado Sprint 46, refinado Sprint 56).
// Representa UMA liberação da cadeia do paciente — original (renovacao_de_id nulo)
// ou renovação (aponta para a anterior). Nenhum campo é inventado: autorizado =
// quantidade; retirado = Σ retiradas; saldo é derivado no servidor. `ultimaRetirada`
// é a maior data_hora entre as retiradas da liberação.
// `createdAt` é o timestamp real de criação do registro (confiável), distinto de dataInicio (vigência).
// Sprint 46 — inclui lista de retiradas para timeline e paciente origem para header.
export type ItemHistorico = {
  id: string;
  dataInicio: string;
  dataFim: string;
  tipo: string;
  quantidade: number;
  periodoMeses: number | null;
  status: string;
  renovacaoDeId: string | null;
  autorizador: { id: string; nome: string } | null;
  registrador: { id: string; nome: string } | null;
  origem: OrigemHistorico | null;
  quantidadeRetirada: number;
  numeroRetiradas: number;
  ultimaRetirada: string | null;
  saldo: number;
  // Sprint 46 — timeline detalhada (opcional para compatibilidade)
  retiradas?: { dataHora: string; quantidade: number; recepcionistaNome?: string | null }[];
  // Sprint 56 — timestamp real de criação (confiável para ordenação)
  createdAt?: string | null;
};

export type TotaisConsolidado = {
  previsto: number;
  retirado: number;
  diferenca: number;
  liberacoes: number;
};

export type TotaisPorTipoConsolidado = {
  continua: TotaisConsolidado;
  avulsa: TotaisConsolidado;
};

export type ContadoresConsolidado = {
  estouros: number;
  semRetirada: number;
  proximoVencimento: number;
  expiradaSemUso: number;
};

export type AgregadoPacienteConsolidado = {
  pacienteId: string;
  nome: string;
  gestorSus: string;
  previsto: number;
  retirado: number;
  diferenca: number;
  liberacoes: number;
};

export type TotaisLiberacoes = {
  total: number;
  ativas: number;
  continuas: number;
  avulsas: number;
  proximasVencimento: number;
  semRetirada: number;
};

export type ContadoresLiberacoes = {
  proximasVencimento: number;
  semRetirada: number;
  expiradaSemUso: number;
  multiplasAtivas: number;
  multiplasAtivasLiberacoes: number;
};

export type TotaisRetiradas = {
  registros: number;
  valesRetirados: number;
  pacientesDistintos: number;
  avulsas: number;
  continuas: number;
};

export type ContadoresRetiradas = {
  acimaPrevisao: number;
  foraVigencia: number;
};

export type ResultadoListaRelatorio =
  | {
      tipo: "liberacoes";
      linhas: LinhaLiberacoes[];
      total: number;
      pagina: number;
      porPagina: number;
      // Sprint 54 — totais e contadores sobre conjunto filtrado
      totais: TotaisLiberacoes;
      contadores: ContadoresLiberacoes;
    }
  | {
      tipo: "retiradas";
      linhas: LinhaRetiradas[];
      total: number;
      pagina: number;
      porPagina: number;
      // Sprint 55 — totais e contadores sobre conjunto filtrado
      totais: TotaisRetiradas;
      contadores: ContadoresRetiradas;
    }
  | {
      tipo: "consolidado";
      linhas: LinhaConsolidado[];
      total: number;
      pagina: number;
      porPagina: number;
      // Sprint 53 — agregações sobre o conjunto filtrado (para totais) e
      // contadores sobre o conjunto base (para alertas).
      totais: TotaisConsolidado;
      porTipo: TotaisPorTipoConsolidado;
      porPaciente: AgregadoPacienteConsolidado[];
      contadores: ContadoresConsolidado;
    }
  | {
      tipo: "historico";
      paciente: { id: string; gestor_sus: string; nome: string; origem?: string | null; created_at?: string | null } | null;
      linhas: ItemHistorico[];
      total: number;
      pagina: number;
      porPagina: number;
    };

// ── Resumo gerencial (Sprint 40) ─────────────────────────────────────────────
// SEMÂNTICA DO PERÍODO (documentada em DOMAIN.md):
//   * AUTORIZADO → liberações cuja data_inicio está dentro do período;
//   * RETIRADO   → retiradas cuja data_hora está dentro do período.
// São conjuntos independentes (uma retirada de liberação antiga conta no
// período em que ocorreu; uma liberação do período conta mesmo que suas
// retiradas sejam futuras). O saldo é DERIVADO — nunca armazenado.
export type LinhaResumoPaciente = {
  pacienteId: string;
  nomePaciente: string;
  gestorSus: string;
  quantidadeAutorizada: number;
  quantidadeRetirada: number;
  saldo: number;
  quantidadeLiberacoes: number;
};

export type ResultadoResumoRelatorio = {
  totalPacientes: number;
  totalLiberacoes: number;
  totalValesAutorizados: number;
  totalValesRetirados: number;
  saldoTotal: number;
  totalLiberacoesContinuas: number;
  totalLiberacoesAvulsas: number;
  linhas: LinhaResumoPaciente[];
};