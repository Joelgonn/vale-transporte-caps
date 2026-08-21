// Rótulos e formatação exibíveis da auditoria (Sprint 21) — funções PURAS.
// Os valores técnicos (acao, entidade_tipo, chaves de dados_antes/depois) vêm
// do banco; aqui só damos apresentação amigável. Nada de valores novos é
// inventado: eventos/entidades/campos desconhecidos caem em fallback técnico.

import {
  ROTULO_ORIGEM_PACIENTE,
  ROTULO_PERFIL,
  ROTULO_PROFISSAO,
  ROTULO_STATUS_LIBERACAO,
  ROTULO_TIPO_LIBERACAO,
} from "@/lib/domain/enums";

// Identificadores canônicos gerados pela fn_auditoria (migration 07).
export const ACOES_AUDITORIA = [
  "paciente.criado",
  "paciente.alterado",
  "paciente.status_alterado",
  "paciente.removido",
  "usuario.criado",
  "usuario.alterado",
  "usuario.perfil_alterado",
  "usuario.status_alterado",
  "usuario.removido",
  "liberacao.criada",
  "liberacao.renovada",
  "liberacao.alterada",
  "liberacao.cancelada",
  "liberacao.removida",
  "retirada.registrada",
  "retirada.alterada",
  "retirada.cancelada",
] as const;

export const ROTULO_ACAO_AUDITORIA: Record<string, string> = {
  "paciente.criado": "Paciente criado",
  "paciente.alterado": "Paciente alterado",
  "paciente.status_alterado": "Status do paciente alterado",
  "paciente.removido": "Paciente removido",
  "usuario.criado": "Usuário criado",
  "usuario.alterado": "Usuário alterado",
  "usuario.perfil_alterado": "Perfil de usuário alterado",
  "usuario.status_alterado": "Status de usuário alterado",
  "usuario.removido": "Usuário removido",
  "liberacao.criada": "Liberação criada",
  "liberacao.renovada": "Liberação renovada",
  "liberacao.alterada": "Liberação alterada",
  "liberacao.cancelada": "Liberação cancelada",
  "liberacao.removida": "Liberação removida",
  "retirada.registrada": "Retirada registrada",
  "retirada.alterada": "Retirada alterada",
  "retirada.cancelada": "Retirada cancelada",
};

export const ENTIDADES_AUDITORIA = [
  "pacientes",
  "usuarios",
  "liberacoes",
  "retiradas",
] as const;

export const ROTULO_ENTIDADE_AUDITORIA: Record<string, string> = {
  pacientes: "Paciente",
  usuarios: "Usuário",
  liberacoes: "Liberação",
  retiradas: "Retirada",
};

export function rotuloAcaoAuditoria(acao: string): string {
  return ROTULO_ACAO_AUDITORIA[acao] ?? acao;
}

export function rotuloEntidadeAuditoria(entidadeTipo: string): string {
  return ROTULO_ENTIDADE_AUDITORIA[entidadeTipo] ?? entidadeTipo;
}

// Defesa em profundidade: nunca exibimos CPF (deliberadamente fora de
// pacientes_audit) nem campos internos do Auth mesmo que um dia apareçam.
const CAMPOS_EXCLUIDOS = new Set(["cpf", "auth_user_id"]);

// Rótulo amigável por campo — mantém a ordem canônica das funções
// *_audit (migration 07) para apresentação estável dos pares Antes/Depois.
const CAMPOS_PACIENTE: Record<string, string> = {
  gestor_sus: "Gestor SUS",
  nome: "Nome",
  status: "Status",
  origem: "Origem",
  data_inicio_acompanhamento: "Início do acompanhamento",
  data_fim_acompanhamento: "Fim do acompanhamento",
  unidade_id: "Unidade",
};

const CAMPOS_USUARIO: Record<string, string> = {
  nome: "Nome",
  email: "E-mail",
  perfil: "Perfil",
  profissao: "Profissão",
  status_ativo: "Situação",
  unidade_id: "Unidade",
};

const CAMPOS_LIBERACAO: Record<string, string> = {
  paciente_id: "Paciente (ID)",
  tipo: "Tipo",
  periodo_meses: "Período (meses)",
  quantidade: "Quantidade",
  data_inicio: "Início da vigência",
  data_fim: "Fim da vigência",
  profissional_autorizador_id: "Profissional autorizador (ID)",
  registrado_por_id: "Registrado por (ID)",
  renovacao_de_id: "Renovação de (ID)",
  status: "Status",
  justificativa: "Justificativa",
  unidade_id: "Unidade",
};

const CAMPOS_RETIRADA: Record<string, string> = {
  liberacao_id: "Liberação (ID)",
  paciente_id: "Paciente (ID)",
  recepcionista_id: "Recepcionista (ID)",
  quantidade: "Quantidade",
  data_hora: "Data/hora",
  unidade_id: "Unidade",
};

const CAMPOS_POR_ENTIDADE: Record<string, Record<string, string>> = {
  pacientes: CAMPOS_PACIENTE,
  usuarios: CAMPOS_USUARIO,
  liberacoes: CAMPOS_LIBERACAO,
  retiradas: CAMPOS_RETIRADA,
};

// Humaniza snake_case desconhecido ("data_fim" → "Data fim") sem inventar nome.
function rotuloCampoDesconhecido(campo: string): string {
  const humanizado = campo.replace(/_/g, " ");
  return humanizado.charAt(0).toUpperCase() + humanizado.slice(1);
}

export function rotuloCampoAuditoria(entidadeTipo: string, campo: string): string {
  return CAMPOS_POR_ENTIDADE[entidadeTipo]?.[campo] ?? rotuloCampoDesconhecido(campo);
}

// Formatação determinística de data (sem fuso): "2026-08-13T09:31:00Z" →
// "13/08/2026" ou "13/08/2026 · 09:31".
function formatarData(iso: string, comHora: boolean): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  const data = `${dia}/${mes}/${ano}`;
  if (!comHora) return data;
  const hora = iso.slice(11, 16);
  return hora ? `${data} · ${hora}` : data;
}

export function formatarValorCampoAuditoria(
  entidadeTipo: string,
  campo: string,
  valor: unknown
): string {
  if (valor === null || valor === undefined) return "—";

  if (campo === "perfil" && typeof valor === "string" && valor in ROTULO_PERFIL) {
    return ROTULO_PERFIL[valor as keyof typeof ROTULO_PERFIL];
  }
  if (
    campo === "profissao" &&
    typeof valor === "string" &&
    valor in ROTULO_PROFISSAO
  ) {
    return ROTULO_PROFISSAO[valor as keyof typeof ROTULO_PROFISSAO];
  }
  if (campo === "tipo" && typeof valor === "string" && valor in ROTULO_TIPO_LIBERACAO) {
    return ROTULO_TIPO_LIBERACAO[valor as keyof typeof ROTULO_TIPO_LIBERACAO];
  }
  if (
    entidadeTipo === "liberacoes" &&
    campo === "status" &&
    typeof valor === "string" &&
    valor in ROTULO_STATUS_LIBERACAO
  ) {
    return ROTULO_STATUS_LIBERACAO[valor as keyof typeof ROTULO_STATUS_LIBERACAO];
  }
  if (
    entidadeTipo === "pacientes" &&
    campo === "status" &&
    typeof valor === "string"
  ) {
    return valor.charAt(0).toUpperCase() + valor.slice(1);
  }
  if (
    campo === "origem" &&
    typeof valor === "string" &&
    valor in ROTULO_ORIGEM_PACIENTE
  ) {
    return (
      ROTULO_ORIGEM_PACIENTE[valor as keyof typeof ROTULO_ORIGEM_PACIENTE]
    );
  }
  if (campo === "status_ativo" && typeof valor === "boolean") {
    return valor ? "Sim" : "Não";
  }
  if (
    typeof valor === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(valor) &&
    campo.startsWith("data_")
  ) {
    return formatarData(valor, campo === "data_hora");
  }
  if (typeof valor === "string" || typeof valor === "number") {
    return String(valor);
  }
  return JSON.stringify(valor) ?? "—";
}

// Pares Campo/Antes/Depois de um evento — apresentação legível dos jsonb.
// Retorna null quando não há nada apresentável (evento sem dados).
export type ParAntesDepois = {
  campo: string;
  rotulo: string;
  antes: string | null;
  depois: string | null;
};

export function paresAntesDepois(
  entidadeTipo: string,
  dadosAntes: Record<string, unknown> | null,
  dadosDepois: Record<string, unknown> | null
): ParAntesDepois[] {
  if (!dadosAntes && !dadosDepois) return [];

  const campos = new Set<string>();
  for (const chave of Object.keys(dadosAntes ?? {})) campos.add(chave);
  for (const chave of Object.keys(dadosDepois ?? {})) campos.add(chave);

  return Array.from(campos)
    .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
    .map((campo) => ({
      campo,
      rotulo: rotuloCampoAuditoria(entidadeTipo, campo),
      antes:
        dadosAntes && campo in dadosAntes
          ? formatarValorCampoAuditoria(entidadeTipo, campo, dadosAntes[campo])
          : null,
      depois:
        dadosDepois && campo in dadosDepois
          ? formatarValorCampoAuditoria(entidadeTipo, campo, dadosDepois[campo])
          : null,
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}
