// Regras de domínio PURAS (funções) — sem dependência de banco/Next.
// O banco (constraints, triggers, RLS) continua sendo a autoridade final; estas
// funções apenas antecipam validações simples e centralizam regras testáveis.

import { AppError } from "@/lib/domain/app-error";
import {
  ORIGENS_PACIENTE,
  PERFIS,
  PERIODOS_LIBERACAO,
  STATUS_LIBERACAO,
  STATUS_PACIENTE,
  TIPOS_LIBERACAO,
  type OrigemPaciente,
  type PerfilUsuario,
  type Profissao,
  type QuantidadeLiberacao,
  type StatusLiberacao,
  type TipoLiberacao,
  type PeriodoLiberacao,
} from "@/lib/domain/enums";

// Sprint 42.1 — previsão livre: inteiro entre 1 e 999 (RN04 atualizada).
export function isQuantidadeValida(
  quantidade: number
): quantidade is QuantidadeLiberacao {
  return (
    Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= 999
  );
}

export function isPeriodoValido(periodo: number): periodo is PeriodoLiberacao {
  return (PERIODOS_LIBERACAO as readonly number[]).includes(periodo);
}

// RN04 (quantidade 1/2/4/8), RN13 (contínua 1/3/6 meses; avulsa sem período)
// e RN29 (paciente esporádico somente avulsa).
export function validarLiberacao(params: {
  tipo: TipoLiberacao;
  quantidade: number;
  periodoMeses?: number | null;
  origemPaciente?: OrigemPaciente | null;
}): void {
  if (!isQuantidadeValida(params.quantidade)) {
    throw new AppError("VALIDACAO", "Quantidade prevista deve ser um inteiro entre 1 e 999 (RN04).");
  }

  if (
    params.origemPaciente === ORIGENS_PACIENTE.ESPORADICO &&
    params.tipo !== TIPOS_LIBERACAO.AVULSA
  ) {
    throw new AppError(
      "VALIDACAO",
      "Paciente esporádico somente recebe liberação avulsa (RN29)."
    );
  }

  if (params.tipo === TIPOS_LIBERACAO.CONTINUA) {
    if (!isPeriodoValido(params.periodoMeses ?? 0)) {
      throw new AppError(
        "VALIDACAO",
        "Liberação contínua exige período de 1, 3 ou 6 meses (RN13)."
      );
    }
    return;
  }

  if (params.tipo === TIPOS_LIBERACAO.AVULSA) {
    if (params.periodoMeses != null) {
      throw new AppError(
        "VALIDACAO",
        "Liberação avulsa não possui período em meses (RN13)."
      );
    }
    return;
  }

  throw new AppError("VALIDACAO", "Tipo de liberação inválido.");
}

// RN13/RN21: contínua = data_inicio + periodo_meses; avulsa = data_inicio + 1 dia.
// Espelha o cálculo do trigger fn_liberacoes_before (o banco permanece a autoridade).
export function calcularDataFim(
  tipo: TipoLiberacao,
  dataInicio: Date,
  periodoMeses?: number | null
): Date {
  const fim = new Date(dataInicio);
  if (tipo === TIPOS_LIBERACAO.CONTINUA) {
    fim.setMonth(fim.getMonth() + (periodoMeses ?? 0));
    return fim;
  }
  fim.setDate(fim.getDate() + 1);
  return fim;
}

export function validarNovoPaciente(dados: {
  gestor_sus: string;
  nome: string;
  origem?: OrigemPaciente | null;
}): void {
  if (!dados.gestor_sus?.trim()) {
    throw new AppError("VALIDACAO", "Gestor SUS é obrigatório (RN25).");
  }
  if (!dados.nome?.trim()) {
    throw new AppError("VALIDACAO", "Nome do paciente é obrigatório.");
  }
  if (
    dados.origem != null &&
    dados.origem !== ORIGENS_PACIENTE.REGULAR &&
    dados.origem !== ORIGENS_PACIENTE.ESPORADICO
  ) {
    throw new AppError("VALIDACAO", "Origem do paciente inválida.");
  }
}

// Sprint 38 — origem de cadastro permitida por perfil (espelha as policies
// pacientes_insert_regular / pacientes_insert_recepcao_esporadico):
//   * gestor / profissional_autorizador → 'regular';
//   * recepcionista → 'esporadico' (exclusivamente atendimento esporádico).
// Sprint 44 — matriz oficial (fluxo contínuo vs esporádico):
//   * GESTOR        → regular + esporadico (ambos);
//   * AUTORIZADOR   → regular + esporadico (ambos);
//   * RECEPCIONISTA → esporadico dentro do fluxo de liberação esporádica;
//                    regular somente via reutilização (localizar existente),
//                    não como cadastro independente.
// Para compatibilidade, a função legada retorna a origem "principal" do perfil;
// a lista completa por perfil está em origensPermitidasPorPerfil (Sprint 44).
export function origemPermitidaPorPerfil(
  perfil: PerfilUsuario
): OrigemPaciente {
  return perfil === PERFIS.RECEPCIONISTA
    ? ORIGENS_PACIENTE.ESPORADICO
    : ORIGENS_PACIENTE.REGULAR;
}

// Sprint 44 — lista completa de origens que cada perfil pode CRIAR
// (origem pertence ao PACIENTE, não à liberação — RN29/RN30).
export function origensPermitidasPorPerfil(
  perfil: PerfilUsuario
): readonly OrigemPaciente[] {
  if (perfil === PERFIS.GESTOR || perfil === PERFIS.PROFISSIONAL_AUTORIZADOR) {
    return [ORIGENS_PACIENTE.REGULAR, ORIGENS_PACIENTE.ESPORADICO];
  }
  if (perfil === PERFIS.RECEPCIONISTA) {
    return [ORIGENS_PACIENTE.ESPORADICO];
  }
  return [];
}

export function podeCriarPacienteComOrigem(
  perfil: PerfilUsuario,
  origem: OrigemPaciente
): boolean {
  return (origensPermitidasPorPerfil(perfil) as readonly string[]).includes(origem);
}

// Padrão de e-mail aceito pelo produto (validação de cadastro e formulários).
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Sprint 41 — Edição segura de pacientes ──────────────────────────────────
//
// Whitelist de campos por perfil (defesa em profundidade — o payload NUNCA é
// repassado cru ao repository; a autoridade final continua no trigger
// fn_pacientes_before e nas policies RLS):
//   * GESTOR ativo                 → somente `status` (ação administrativa);
//   * PROFISSIONAL_AUTORIZADOR     → dados cadastrais, NUNCA status/origem/
//                                    gestor_sus/cpf (RN25: Gestor SUS é o
//                                    identificador principal; CPF permanece
//                                    imutável operacionalmente por decisão
//                                    institucional — sem fluxo definido);
//   * RECEPCIONISTA                → nenhum campo (não edita pacientes).
// `origem` NÃO existe em nenhuma whitelist: é IMUTÁVEL após o cadastro (RN30),
// garantida no PostgreSQL (migration 20260825000001).
export const CAMPOS_EDICAO_PACIENTE_POR_PERFIL: Record<
  PerfilUsuario,
  readonly string[]
> = {
  [PERFIS.GESTOR]: ["status"],
  [PERFIS.PROFISSIONAL_AUTORIZADOR]: [
    "nome",
    "data_inicio_acompanhamento",
    "data_fim_acompanhamento",
    "unidade_id",
  ],
  [PERFIS.RECEPCIONISTA]: [],
};

// Filtra o payload de atualização deixando SOMENTE os campos permitidos ao
// perfil. Campos desconhecidos são descartados (a origem nunca chega aqui:
// a action rejeita explicitamente qualquer tentativa antes de filtrar).
export function filtrarCamposEdicaoPaciente(
  perfil: PerfilUsuario,
  dados: Record<string, unknown>
): Record<string, unknown> {
  const permitidos = CAMPOS_EDICAO_PACIENTE_POR_PERFIL[perfil] ?? [];
  const filtrado: Record<string, unknown> = {};
  for (const campo of permitidos) {
    if (dados[campo] !== undefined) filtrado[campo] = dados[campo];
  }
  return filtrado;
}

// Validação de domínio do payload JÁ FILTRADO da atualização de paciente.
// Rejeita payload vazio (nada a atualizar), status fora do fluxo do gestor,
// nome vazio e janela de acompanhamento incoerente.
export function validarAtualizacaoPaciente(
  perfil: PerfilUsuario,
  dados: Record<string, unknown>
): void {
  if (Object.keys(dados).length === 0) {
    throw new AppError(
      "VALIDACAO",
      "Nenhum campo permitido para edição pelo seu perfil."
    );
  }

  if ("status" in dados) {
    if (perfil !== PERFIS.GESTOR) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Somente o Gestor pode alterar o status do paciente."
      );
    }
    if (
      dados.status !== STATUS_PACIENTE.ATIVO &&
      dados.status !== STATUS_PACIENTE.INATIVO
    ) {
      throw new AppError("VALIDACAO", "Status do paciente inválido.");
    }
  }

  const nome = typeof dados.nome === "string" ? dados.nome.trim() : undefined;
  if (nome != null && nome.length === 0) {
    throw new AppError("VALIDACAO", "Nome do paciente é obrigatório.");
  }

  // Datas coerentes: quando ambas informadas, o fim não precede o início.
  const inicio = dados.data_inicio_acompanhamento;
  const fim = dados.data_fim_acompanhamento;
  if (
    typeof inicio === "string" &&
    typeof fim === "string" &&
    inicio.length > 0 &&
    fim.length > 0 &&
    fim < inicio
  ) {
    throw new AppError(
      "VALIDACAO",
      "Data de fim do acompanhamento não pode ser anterior à data de início."
    );
  }
}

// Sprint 16 — dados de um novo usuário (Auth + vínculo funcional).
// Revalida no servidor o que a UI também valida: nome, e-mail (obrigatório e
// com formato), perfil válido e RN02 (autorizador exige profissão).
export function validarCriacaoUsuario(dados: {
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  profissao?: Profissao | null;
}): void {
  const nome = dados.nome?.trim() ?? "";
  if (!nome) {
    throw new AppError("VALIDACAO", "Nome do usuário é obrigatório.");
  }
  if (nome.length > 120) {
    throw new AppError("VALIDACAO", "Nome deve ter no máximo 120 caracteres.");
  }

  const email = dados.email?.trim() ?? "";
  if (!email) {
    throw new AppError("VALIDACAO", "E-mail do usuário é obrigatório.");
  }
  if (email.length > 254) {
    throw new AppError("VALIDACAO", "E-mail deve ter no máximo 254 caracteres.");
  }
  if (!EMAIL_RE.test(email)) {
    throw new AppError("VALIDACAO", "Informe um e-mail válido.");
  }

  validarNovoUsuario({ perfil: dados.perfil, profissao: dados.profissao ?? null });
}

// RN02: profissional autorizador exige profissão cadastrada.
export function validarNovoUsuario(dados: {
  perfil: PerfilUsuario;
  profissao?: Profissao | null;
}): void {
  if (dados.perfil === PERFIS.PROFISSIONAL_AUTORIZADOR && !dados.profissao) {
    throw new AppError(
      "VALIDACAO",
      "Profissional autorizador exige profissão (RN02)."
    );
  }
  if (dados.perfil !== PERFIS.PROFISSIONAL_AUTORIZADOR && dados.profissao != null) {
    throw new AppError(
      "VALIDACAO",
      "Profissão é exclusiva do perfil profissional_autorizador."
    );
  }
}

// Sprint 17 — política mínima de senha do produto (documentada em SECURITY.md).
// Mantida deliberadamente simples: apenas tamanho mínimo, sem regras de
// complexidade inventadas (o Supabase Auth continua sendo a autoridade final).
export const SENHA_MINIMA_CARACTERES = 8;

// Sprint 17 — troca obrigatória de senha no primeiro acesso. A validação é pura
// (sem banco/Next); o servidor revalida tudo que a UI valida.
export function validarTrocaDeSenha(dados: {
  novaSenha: string;
  confirmacao: string;
}): void {
  const novaSenha = dados.novaSenha ?? "";
  const confirmacao = dados.confirmacao ?? "";
  if (!novaSenha) {
    throw new AppError("VALIDACAO", "Informe a nova senha.");
  }
  if (novaSenha.length < SENHA_MINIMA_CARACTERES) {
    throw new AppError(
      "VALIDACAO",
      `A senha deve ter pelo menos ${SENHA_MINIMA_CARACTERES} caracteres.`
    );
  }
  if (!confirmacao) {
    throw new AppError("VALIDACAO", "Confirme a nova senha.");
  }
  if (novaSenha !== confirmacao) {
    throw new AppError("VALIDACAO", "As senhas não coincidem.");
  }
}

// RN14: quantidade da retirada deve ser positiva.
export function validarRetirada(dados: { quantidade: number }): void {
  if (!Number.isInteger(dados.quantidade) || dados.quantidade <= 0) {
    throw new AppError("VALIDACAO", "Quantidade da retirada deve ser positiva (RN14).");
  }
}

// Capacidade de autorizar DERIVADA de perfil + profissão + status_ativo (RN02/RN27).
// Não existe campo `pode_autorizar` no modelo.
export function podeAutorizar(
  perfil: PerfilUsuario,
  profissao: Profissao | null,
  statusAtivo: boolean
): boolean {
  return (
    perfil === PERFIS.PROFISSIONAL_AUTORIZADOR && profissao != null && statusAtivo
  );
}

// Permissões de UI para a página de pacientes, derivadas de perfil + status.
// Sprint 44 — matriz oficial:
//   GESTOR        → cria regular + esporadico, localiza/reutiliza, edita status;
//   AUTORIZADOR   → cria regular + esporadico, localiza/reutiliza, edita dados;
//   RECEPCIONISTA → NÃO cria regular independente; cria esporadico dentro do fluxo
//                  operacional (liberação esporádica) + localiza/reutiliza qualquer
//                  paciente existente.
// Espelham o que as policies RLS/triggers do banco de fato permitem (a autoridade
// continua no banco):
//  - leitura: qualquer perfil reconhecido e ativo (v_pacientes / policy select);
//  - INSERT: policies pacientes_insert_* (Sprint 44: todos os perfis ativos podem
//            criar conforme origensPermitidasPorPerfil);
//  - UPDATE de dados: somente profissional_autorizador ativo (trigger bloqueia status);
//  - UPDATE de status: somente gestor ativo (trigger bloqueia demais campos).
export function permissoesPacientes(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): {
  podeAcessar: boolean;
  podeCriarRegular: boolean;
  podeCriarEsporadico: boolean;
  podeEditarDados: boolean;
  podeAlterarStatus: boolean;
} {
  const ativo = perfil != null && statusAtivo === true;
  return {
    podeAcessar: ativo,
    // Sprint 44: gestor e autorizador criam regular; recepcionista NÃO (só reutiliza)
    podeCriarRegular:
      ativo &&
      (perfil === PERFIS.GESTOR ||
        perfil === PERFIS.PROFISSIONAL_AUTORIZADOR),
    // Sprint 44: os três perfis ativos podem criar esporadico (gestor/autorizador
    // diretamente; recepcionista dentro do fluxo operacional)
    podeCriarEsporadico:
      ativo &&
      (perfil === PERFIS.GESTOR ||
        perfil === PERFIS.PROFISSIONAL_AUTORIZADOR ||
        perfil === PERFIS.RECEPCIONISTA),
    podeEditarDados: ativo && perfil === PERFIS.PROFISSIONAL_AUTORIZADOR,
    podeAlterarStatus: ativo && perfil === PERFIS.GESTOR,
  };
}

// Permissões de UI para a página de administração de usuários (Sprint 12).
// Espelham as policies RLS usuarios_select_gestor/usuarios_update_gestor
// (migration 09): somente o Gestor ativo lê públicos.usuarios e altera
// status_ativo. Os demais perfis/inativos/sem-vínculo não acessam a gestão.
export function permissoesUsuarios(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): {
  podeAcessar: boolean;
  podeAlterarStatus: boolean;
} {
  const gestorAtivo = perfil === PERFIS.GESTOR && statusAtivo === true;
  return {
    podeAcessar: gestorAtivo,
    podeAlterarStatus: gestorAtivo,
  };
}

// Permissões de UI para a página de liberações (Sprint 18 + Sprint 47).
// Sprint 47 — corrige Sprint44: recepção NÃO cria autorização contínua.
//  - leitura: qualquer perfil ATIVO (autorizador/gestor veem todas;
//    recepcionista somente status 'ativa' — liberacoes_select_recepcao_ativas);
//  - INSERT "nova liberação": GESTOR e AUTORIZADOR criam contínua e avulsa;
//    RECEPCIONISTA cria SOMENTE avulsa (dentro do fluxo avulso para paciente
//    esporádico) e OPERA contínua existente (registra retirada), não autoriza.
//    Policies: liberacoes_insert_gestor/autorizador (sem renovacao_de_id) e
//    liberacoes_insert_recepcionista_44 (qualquer, mas validação RN29 + tipo
//    bloqueia contínua para recepcionista via action).
//  - INSERT "renovação": somente recepcionista ativa com renovacao_de_id
//    informado (liberacoes_insert_recepcao_renovacao) — mantido;
//  - UPDATE "editar" (Sprint 42): autorizador edita previsão/janela/justificativa;
//    gestor altera status + campos administrativos; recepcionista não edita
//    (policy liberacoes_update_autorizador_gestor + split fino no trigger);
//  - sem delete de liberações (revogado — migration 15).
// Sprint 47 — recepção NÃO pode criar contínua (apenas avulsa no fluxo operacional).
export function permissoesLiberacoes(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): {
  podeAcessar: boolean;
  podeCriar: boolean;
  podeCriarAvulsa: boolean;
  podeCriarContinua: boolean;
  podeRenovar: boolean;
  podeEditar: boolean;
  podeAlterarStatus: boolean;
  visualizaSomenteAtivas: boolean;
} {
  const ativo = perfil != null && statusAtivo === true;
  const podeCriarAvulsa =
    ativo &&
    (perfil === PERFIS.GESTOR ||
      perfil === PERFIS.PROFISSIONAL_AUTORIZADOR ||
      perfil === PERFIS.RECEPCIONISTA);
  const podeCriarContinua =
    ativo && (perfil === PERFIS.GESTOR || perfil === PERFIS.PROFISSIONAL_AUTORIZADOR);
  return {
    podeAcessar: ativo,
    podeCriar: podeCriarAvulsa,
    podeCriarAvulsa,
    podeCriarContinua,
    podeRenovar: ativo && perfil === PERFIS.RECEPCIONISTA,
    podeEditar: ativo && perfil === PERFIS.PROFISSIONAL_AUTORIZADOR,
    podeAlterarStatus: ativo && perfil === PERFIS.GESTOR,
    visualizaSomenteAtivas: perfil === PERFIS.RECEPCIONISTA,
  };
}

// ── Sprint 42 — Edição segura de liberações ──────────────────────────────────
//
// `quantidade` é PREVISÃO administrativa (RN04): NÃO bloqueia retiradas.
// A autorização real é o par (vigência RN13/RN21, status 'ativa').
//
// Whitelist de campos por perfil (a action filtra ANTES do repository; o banco
// é a autoridade final via policy liberacoes_update_autorizador_gestor +
// branch UPDATE do fn_libracoes_before):
//   * GESTOR ativo              → status (cancelamento) + unidade_id;
//   * PROFISSIONAL_AUTORIZADOR  → quantidade (previsão), datas da vigência,
//                                 justificativa, unidade_id — NUNCA status,
//                                 paciente, tipo, período ou autorizador;
//   * RECEPCIONISTA             → nenhum campo (não edita autorização).
// Campos HISTÓRICOS (paciente_id, tipo, periodo_meses,
// profissional_autorizador_id, registrado_por_id, renovacao_de_id) não existem
// em whitelist alguma — imutáveis em todas as camadas.
export const CAMPOS_EDICAO_LIBERACAO_POR_PERFIL: Record<
  PerfilUsuario,
  readonly string[]
> = {
  [PERFIS.GESTOR]: ["status", "unidade_id"],
  [PERFIS.PROFISSIONAL_AUTORIZADOR]: [
    "quantidade",
    "vales_por_dia",
    "data_inicio",
    "data_fim",
    "justificativa",
    "unidade_id",
  ],
  [PERFIS.RECEPCIONISTA]: [],
};

// Campos históricos que a action REJEITA explicitamente (antes mesmo de
// filtrar) — qualquer tentativa de alterá-los é negada, nunca silenciada.
export const CAMPOS_HISTORICOS_LIBERACAO = [
  "pacienteId",
  "paciente_id",
  "tipo",
  "periodoMeses",
  "periodo_meses",
  "profissionalAutorizadorId",
  "profissional_autorizador_id",
  "registradoPorId",
  "registrado_por_id",
  "renovacaoDeId",
  "renovacao_de_id",
] as const;

export function filtrarCamposEdicaoLiberacao(
  perfil: PerfilUsuario,
  dados: Record<string, unknown>
): Record<string, unknown> {
  const permitidos = CAMPOS_EDICAO_LIBERACAO_POR_PERFIL[perfil] ?? [];
  const filtrado: Record<string, unknown> = {};
  for (const campo of permitidos) {
    if (dados[campo] !== undefined) filtrado[campo] = dados[campo];
  }
  return filtrado;
}

export function validarAtualizacaoLiberacao(
  perfil: PerfilUsuario,
  dados: Record<string, unknown>
): void {
  if (Object.keys(dados).length === 0) {
    throw new AppError(
      "VALIDACAO",
      "Nenhum campo permitido para edição pelo seu perfil."
    );
  }

  if ("status" in dados) {
    if (perfil !== PERFIS.GESTOR) {
      throw new AppError(
        "ACESSO_NEGADO",
        "Somente o Gestor pode alterar o status da liberação."
      );
    }
    if (
      !Object.values(STATUS_LIBERACAO).includes(
        dados.status as StatusLiberacao
      )
    ) {
      throw new AppError("VALIDACAO", "Status da liberação inválido.");
    }
  }

  if ("quantidade" in dados && !isQuantidadeValida(dados.quantidade as number)) {
    throw new AppError(
      "VALIDACAO",
      "Quantidade prevista deve ser um inteiro entre 1 e 999 (RN04)."
    );
  }

  // Vigência coerente: quando ambas informadas, o fim sucede o início.
  const inicio = dados.data_inicio;
  const fim = dados.data_fim;
  if (
    typeof inicio === "string" &&
    typeof fim === "string" &&
    inicio.length > 0 &&
    fim.length > 0 &&
    fim <= inicio
  ) {
    throw new AppError(
      "VALIDACAO",
      "Data fim deve ser posterior à data início da liberação (RN13/RN21)."
    );
  }
}

// ── Sprint 44 — P1: vigência não pode excluir retiradas existentes ─────────
//
// Regra: ao editar data_inicio/data_fim, a nova janela deve CONTINUAR contendo
// todas as retiradas já registradas (menor data_hora e maior data_hora).
// Preserva semanticamente o histórico: retirada válida no momento do registro
// não pode virar "fora da validade" por edição retroativa.
export function validarVigenciaComRetiradas(params: {
  novaDataInicio?: string | null;
  novaDataFim?: string | null;
  menorRetirada?: string | null;
  maiorRetirada?: string | null;
}): void {
  const { novaDataInicio, novaDataFim, menorRetirada, maiorRetirada } = params;
  // Se não há retiradas, qualquer janela coerente é válida (já validado acima)
  if (!menorRetirada && !maiorRetirada) return;
  // Se a edição não altera vigência, nada a validar aqui
  if (!novaDataInicio && !novaDataFim) return;

  // Comparação lexicográfica de ISO (YYYY-MM-DD...)
  if (
    typeof novaDataInicio === "string" &&
    novaDataInicio.length > 0 &&
    menorRetirada &&
    novaDataInicio > menorRetirada.slice(0, 10)
  ) {
    throw new AppError(
      "VALIDACAO",
      "A nova data de início não pode excluir retiradas já registradas. A menor retirada é anterior ao novo início."
    );
  }
  if (
    typeof novaDataFim === "string" &&
    novaDataFim.length > 0 &&
    maiorRetirada &&
    novaDataFim < maiorRetirada.slice(0, 10)
  ) {
    throw new AppError(
      "VALIDACAO",
      "A nova data de fim não pode excluir retiradas já registradas. Há retiradas posteriores ao novo fim."
    );
  }
}

// ── Sprint 44 — P1/P2: estouro de previsão (RN31) ──────────────────────────
// RN31: quantidade é PREVISÃO, não bloqueia. Porém, para gestão, é útil
// distinguir "retirada normal" de "retirada em situação de estouro".
// Não existe threshold institucional documentado (nenhum 20% ou +10 fixo);
// portanto NÃO bloqueamos nem exigimos justificativa arbitrária aqui.
// Esta infraestrutura apenas DETECTA e permite ao repositório/UI SINALIZAR.
// Se decisão institucional futura definir threshold, basta parametrizar
// `limite` aqui — sem mudar o fluxo de retirada (sempre append-only).
export type EstadoPrevisao = "dentro" | "estouro";
export function estadoPrevisao(
  quantidadePrevista: number,
  totalRetirado: number
): EstadoPrevisao {
  return totalRetirado > quantidadePrevista ? "estouro" : "dentro";
}
export function isEstouro(
  quantidadePrevista: number,
  totalRetiradoIncluindoNova: number
): boolean {
  return estadoPrevisao(quantidadePrevista, totalRetiradoIncluindoNova) === "estouro";
}

// Permissões de UI para a página de retiradas (Sprint 20), derivadas de perfil
// + status e espelhando as policies RLS reais (migrations 09/13/14 + Sprint 44):
//  - leitura: Sprint 44 — os TRÊS perfis ativos acessam retiradas para operar
//    (autorizador avalia, recepcionista entrega, gestor administra);
//    RLS Sprint 44: retiradas_select ampliada aos três perfis ativos;
//  - INSERT "registrar retirada": Sprint 44 — GESTOR, AUTORIZADOR e RECEPCIONISTA
//    ativos podem registrar retirada (operação na recepção); RLS Sprint 44:
//    retiradas_insert por perfil ativo;
//  - sem update/delete de retiradas (append-only — sem policies).
// O responsável (usuarios) só é legível pelo Gestor ativo (usuarios_select_gestor).
export function permissoesRetiradas(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): {
  podeAcessar: boolean;
  podeRegistrar: boolean;
  visualizaResponsavel: boolean;
} {
  const ativo = perfil != null && statusAtivo === true;
  // Sprint 44: todos os perfis ativos operam retiradas (autorização vs operação)
  return {
    podeAcessar: ativo,
    podeRegistrar: ativo,
    visualizaResponsavel: perfil === PERFIS.GESTOR,
  };
}

// Permissões de UI para a consulta de auditoria (Sprint 21), derivadas de perfil
// + status e espelhando a policy RLS auditoria_select_gestor (migration 10):
// somente o Gestor ATIVO lê public.auditoria_logs — a trilha é de leitura
// restrita e append-only (INSERT/UPDATE/DELETE revogados para authenticated).
export function permissoesAuditoria(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): {
  podeConsultar: boolean;
} {
  return {
    podeConsultar: perfil === PERFIS.GESTOR && statusAtivo === true,
  };
}

// Permissões de UI para a consulta de relatórios (Sprint 37 — Fase 8),
// derivadas de perfil + status. REPORTS.md/SECURITY.md: o acesso a relatórios é
// restrito ao Gestor ATIVO; o acesso do autorizador é decisão institucional
// pendente (não implementado). Os relatórios são somente leitura via RLS
// (policies existentes) — nenhuma policy nova foi criada.
export function permissoesRelatorios(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): {
  podeConsultar: boolean;
} {
  return {
    podeConsultar: perfil === PERFIS.GESTOR && statusAtivo === true,
  };
}

// Estado funcional do usuário autenticado para o Dashboard (identificação apenas;
// a autoridade de bloqueio permanece no banco/regras de cada módulo).
export function estadoUsuario(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): "ativo" | "inativo" | "sem_vinculo" {
  if (perfil == null) return "sem_vinculo";
  return statusAtivo === true ? "ativo" : "inativo";
}

// Capabilities reais do Dashboard por perfil/status — baseadas NAS ROTAS que de
// fato existem (Pacientes, Usuários, Liberações e Retiradas). Espelham as
// permissões de UI já sancionadas (permissoesPacientes/permissoesUsuarios/
// permissoesLiberacoes/permissoesRetiradas) e as policies RLS.
// Sprint 46 — inclui Historico como modulo premium (usa mesma permissão de Relatórios — gestor).
// Sprint 47 — inclui Atendimento (recepção) — operacional, todos os ativos acessam.
export function capacidadeDashboard(
  perfil: PerfilUsuario | null,
  statusAtivo: boolean | null
): {
  ativo: boolean;
  pacientes: boolean;
  usuarios: boolean;
  liberacoes: boolean;
  retiradas: boolean;
  auditoria: boolean;
  relatorios: boolean;
  atendimento: boolean;
} {
  const ativo = perfil != null && statusAtivo === true;
  return {
    ativo,
    // Todos os perfis ativos acessam a lista de pacientes (v_pacientes).
    pacientes: ativo,
    // Gestão de usuários é exclusiva do Gestor ativo.
    usuarios: perfil === PERFIS.GESTOR && statusAtivo === true,
    // Todos os perfis ativos acessam o módulo de liberações
    // (Sprint 44: os três perfis criam liberações; recepcionista vê só ativas — RLS).
    liberacoes: ativo,
    // Sprint 44: todos os perfis ativos acessam e registram retiradas
    retiradas: ativo,
    // Auditoria é exclusiva do Gestor ativo (policy auditoria_select_gestor).
    auditoria: perfil === PERFIS.GESTOR && statusAtivo === true,
    // Relatórios são exclusivos do Gestor ativo (REPORTS.md — decisão
    // institucional pendente para o autorizador, não implementada).
    // Histórico é visão interna de Relatórios (/dashboard/relatorios?tipo=historico) — não módulo independente.
    relatorios: perfil === PERFIS.GESTOR && statusAtivo === true,
    atendimento: ativo,
  };
}
