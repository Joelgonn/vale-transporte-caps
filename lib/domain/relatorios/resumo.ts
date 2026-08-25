// Agregação pura do RESUMO gerencial de vales (Sprint 40). Função PURA e
// testável em isolamento — o repositório busca as linhas brutas e aqui apenas
// as somamos. Nenhum campo é inventado: autorizado vem de liberacoes.quantidade
// e retirado de Σ retiradas.quantidade; o saldo é SEMPRE derivado
// (autorizado − retirado), nunca armazenado.
//
// Semântica do período (aplicada pelo repositório, documentada em DOMAIN.md):
//   * liberações entram quando data_inicio está no período;
//   * retiradas entram quando data_hora está no período — INDEPENDENTE da
//     liberação de origem estar ou não no mesmo período.

import { TIPOS_LIBERACAO } from "@/lib/domain/enums";
import type {
  LinhaResumoPaciente,
  ResultadoResumoRelatorio,
} from "@/lib/domain/relatorios/types";

export type LiberacaoResumoBruta = {
  paciente_id: string;
  tipo: string;
  quantidade: number;
  pacientes?: unknown;
};

export type RetiradaResumoBruta = {
  paciente_id: string;
  quantidade: number;
  pacientes?: unknown;
};

type AcumuloPaciente = {
  nomePaciente: string;
  gestorSus: string;
  quantidadeAutorizada: number;
  quantidadeRetirada: number;
  quantidadeLiberacoes: number;
};

function nomeDoPaciente(embed: unknown): string {
  const paciente = Array.isArray(embed) ? embed[0] : embed;
  return (paciente as { nome?: string } | null | undefined)?.nome ?? "—";
}

function susDoPaciente(embed: unknown): string {
  const paciente = Array.isArray(embed) ? embed[0] : embed;
  return (paciente as { gestor_sus?: string } | null | undefined)?.gestor_sus ?? "—";
}

// Cria ou recupera o acumulador do paciente. Se o acumulador já existir com
// nome desconhecido ("—") e a linha atual trouxer identificação, atualiza —
// assim a ordem entre as consultas (liberações × retiradas) é irrelevante e
// nenhum paciente fica sem nome/Gestor SUS.
function acumulador(
  porPaciente: Map<string, AcumuloPaciente>,
  pacienteId: string,
  nomePaciente: string,
  gestorSus: string
): AcumuloPaciente {
  let atual = porPaciente.get(pacienteId);
  if (!atual) {
    atual = {
      nomePaciente,
      gestorSus,
      quantidadeAutorizada: 0,
      quantidadeRetirada: 0,
      quantidadeLiberacoes: 0,
    };
    porPaciente.set(pacienteId, atual);
  } else if (atual.nomePaciente === "—" && nomePaciente !== "—") {
    atual.nomePaciente = nomePaciente;
    atual.gestorSus = gestorSus;
  }
  return atual;
}

export function agregarResumo(
  liberacoes: LiberacaoResumoBruta[],
  retiradas: RetiradaResumoBruta[]
): ResultadoResumoRelatorio {
  const porPaciente = new Map<string, AcumuloPaciente>();

  let totalLiberacoes = 0;
  let totalValesAutorizados = 0;
  let totalLiberacoesContinuas = 0;
  let totalLiberacoesAvulsas = 0;

  for (const liberacao of liberacoes) {
    const quantidade =
      typeof liberacao.quantidade === "number" && liberacao.quantidade > 0
        ? liberacao.quantidade
        : 0;
    totalLiberacoes += 1;
    totalValesAutorizados += quantidade;
    if (liberacao.tipo === TIPOS_LIBERACAO.CONTINUA) totalLiberacoesContinuas += 1;
    if (liberacao.tipo === TIPOS_LIBERACAO.AVULSA) totalLiberacoesAvulsas += 1;

    acumulador(
      porPaciente,
      liberacao.paciente_id,
      nomeDoPaciente(liberacao.pacientes),
      susDoPaciente(liberacao.pacientes)
    ).quantidadeAutorizada += quantidade;
    porPaciente.get(liberacao.paciente_id)!.quantidadeLiberacoes += 1;
  }

  let totalValesRetirados = 0;
  for (const retirada of retiradas) {
    const quantidade =
      typeof retirada.quantidade === "number" && retirada.quantidade > 0
        ? retirada.quantidade
        : 0;
    totalValesRetirados += quantidade;
    // Retirada pode referenciar paciente sem liberação no período (a liberação
    // original é anterior ao período) — entra na tabela como linha só-retirada,
    // identificada pelo embed pacientes(id, gestor_sus, nome) da própria query.
    acumulador(
      porPaciente,
      retirada.paciente_id,
      nomeDoPaciente(retirada.pacientes),
      susDoPaciente(retirada.pacientes)
    ).quantidadeRetirada += quantidade;
  }

  const linhas: LinhaResumoPaciente[] = [...porPaciente.entries()]
    .map(([pacienteId, acumulo]) => ({
      pacienteId,
      nomePaciente: acumulo.nomePaciente,
      gestorSus: acumulo.gestorSus,
      quantidadeAutorizada: acumulo.quantidadeAutorizada,
      quantidadeRetirada: acumulo.quantidadeRetirada,
      saldo: acumulo.quantidadeAutorizada - acumulo.quantidadeRetirada,
      quantidadeLiberacoes: acumulo.quantidadeLiberacoes,
    }))
    // Ordenação padrão da sprint: maior quantidade autorizada primeiro
    // (empate: ordem alfabética por nome para determinismo).
    .sort((a, b) =>
      b.quantidadeAutorizada - a.quantidadeAutorizada ||
      a.nomePaciente.localeCompare(b.nomePaciente, "pt-BR")
    );

  return {
    totalPacientes: linhas.length,
    totalLiberacoes,
    totalValesAutorizados,
    totalValesRetirados,
    saldoTotal: totalValesAutorizados - totalValesRetirados,
    totalLiberacoesContinuas,
    totalLiberacoesAvulsas,
    linhas,
  };
}
