// Mapeamento puro entre as linhas brutas do PostgREST (embed) e as linhas de
// relatório do domínio. Funções PURAS e testáveis em isolamento — o repositório
// apenas as chama; nenhuma regra de negócio vive no componente.

import type {
  LinhaConsolidado,
  LinhaLiberacoes,
  LinhaRetiradas,
} from "@/lib/domain/relatorios/types";

// PostgREST retorna o embed to-one como objeto (ou array vazio em versões
// antigas); o to-many como array. Normaliza ambos para o tipo do domínio.
export function mapearEmbutido<T>(valor: unknown): T | null {
  const alvo = Array.isArray(valor) ? (valor[0] as T | undefined) : (valor as T | null);
  return alvo ?? null;
}

// Soma de quantidades do embed retiradas(quantidade) — base do total retirado
// e do saldo do consolidado. Retiradas nunca têm quantidade negativa (RN14).
export function somarQuantidades(retiradas: unknown): number {
  const linhas = Array.isArray(retiradas) ? retiradas : [];
  return linhas.reduce<number>((soma, linha) => {
    const quantidade = (linha as { quantidade?: unknown })?.quantidade;
    return soma + (typeof quantidade === "number" && quantidade > 0 ? quantidade : 0);
  }, 0);
}

export type LinhaLiberacaoBruta = {
  id: string;
  paciente_id: string;
  tipo: string;
  quantidade: number;
  periodo_meses: number | null;
  data_inicio: string;
  data_fim: string;
  status: string;
  profissional_autorizador_id: string;
  renovacao_de_id?: string | null;
  pacientes?: unknown;
  autorizador?: unknown;
  retiradas?: unknown;
};

export function mapearLinhaLiberacoes(linha: LinhaLiberacaoBruta): LinhaLiberacoes {
  const paciente = mapearEmbutido<{ id: string; gestor_sus: string; nome: string; origem?: string | null }>(
    linha.pacientes
  );
  const autorizador = mapearEmbutido<{ id: string; nome: string }>(linha.autorizador);
  return {
    id: linha.id,
    paciente: paciente?.id ? { ...paciente } : null,
    tipo: linha.tipo,
    quantidade: linha.quantidade,
    periodoMeses: linha.periodo_meses,
    dataInicio: linha.data_inicio,
    dataFim: linha.data_fim,
    status: linha.status,
    autorizador: autorizador?.id ? { ...autorizador } : null,
    totalRetirado: somarQuantidades(linha.retiradas),
    renovacaoDeId: (linha as { renovacao_de_id?: string | null }).renovacao_de_id ?? null,
  };
}

export type LinhaRetiradaBruta = {
  id: string;
  data_hora: string;
  paciente_id: string;
  liberacao_id: string;
  recepcionista_id: string;
  quantidade: number;
  pacientes?: unknown;
  liberacoes?: unknown;
  recepcionista?: unknown;
};

export function mapearLinhaRetiradas(linha: LinhaRetiradaBruta): LinhaRetiradas {
  const paciente = mapearEmbutido<{ id: string; gestor_sus: string; nome: string; origem?: string | null }>(
    linha.pacientes
  );
  const liberacao = mapearEmbutido<{
    id: string;
    tipo: string;
    quantidade: number;
    data_inicio?: string;
    data_fim?: string;
    status?: string;
  }>(linha.liberacoes);
  const recepcionista = mapearEmbutido<{ id: string; nome: string }>(linha.recepcionista);
  return {
    id: linha.id,
    dataHora: linha.data_hora,
    paciente: paciente?.id ? { ...paciente } : null,
    liberacao: liberacao?.id ? { ...liberacao } : null,
    quantidade: linha.quantidade,
    recepcionista: recepcionista?.id ? { ...recepcionista } : null,
  };
}

export type LinhaConsolidadoBruta = {
  id: string;
  paciente_id: string;
  tipo: string;
  quantidade: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  periodo_meses: number | null;
  pacientes?: unknown;
  retiradas?: unknown;
};

export function mapearLinhaConsolidado(linha: LinhaConsolidadoBruta): LinhaConsolidado {
  const paciente = mapearEmbutido<{ id: string; gestor_sus: string; nome: string }>(
    linha.pacientes
  );
  const retirada = somarQuantidades(linha.retiradas);
  return {
    liberacaoId: linha.id,
    paciente: paciente?.id ? { ...paciente } : null,
    tipo: linha.tipo,
    quantidadeAutorizada: linha.quantidade,
    quantidadeRetirada: retirada,
    saldo: linha.quantidade - retirada,
    dataInicio: (linha as unknown as { data_inicio: string }).data_inicio ?? "",
    dataFim: (linha as unknown as { data_fim: string }).data_fim ?? "",
    status: (linha as unknown as { status: string }).status ?? "",
    periodoMeses: (linha as unknown as { periodo_meses: number | null }).periodo_meses ?? null,
  };
}
