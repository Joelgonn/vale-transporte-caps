// Camada centralizada de erros de domínio/aplicação.
// Converte erros do Supabase/PostgREST em códigos de domínio estáveis e em
// mensagens amigáveis. Mensagens SQL cruas nunca devem ser exibidas na UI.

export type AppErrorCode =
  | "VALIDACAO"
  | "PACIENTE_INATIVO"
  | "AUTORIZADOR_INVALIDO"
  | "LIBERACAO_INATIVA"
  | "RETIRADA_FORA_DA_VALIDADE"
  | "SALDO_INSUFICIENTE"
  | "ACESSO_NEGADO"
  | "NAO_ENCONTRADO"
  | "ERRO_INTERNO";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export type ErroSupabase = { message?: string; code?: string } | null;

// Mapeia o erro devolvido pelo Supabase/PostgREST para um AppError de domínio.
// As mensagens reconhecidas são as lançadas pelos triggers do banco (Sprint 09).
export function mapSupabaseError(error: ErroSupabase): AppError | null {
  if (!error) return null;

  const message = error.message ?? "";
  const code = error.code ?? "";

  if (
    code === "42501" ||
    /permission denied|row-level security|violates row-level security/i.test(message)
  ) {
    return new AppError(
      "ACESSO_NEGADO",
      "Você não tem permissão para executar esta operação."
    );
  }
  if (/não vinculado a um registro funcional/i.test(message)) {
    return new AppError(
      "ACESSO_NEGADO",
      "Usuário autenticado não vinculado a um registro funcional."
    );
  }
  if (/Perfil sem permissão/i.test(message)) {
    return new AppError("ACESSO_NEGADO", "Perfil sem permissão para esta operação.");
  }
  if (/Paciente sem direito ativo/i.test(message)) {
    return new AppError("PACIENTE_INATIVO", "Paciente sem direito ativo (RN01).");
  }
  if (/Profissional autorizador inv.lido ou inativo/i.test(message)) {
    return new AppError(
      "AUTORIZADOR_INVALIDO",
      "Profissional autorizador inválido ou inativo (RN02/RN27)."
    );
  }
  if (/Liberação não está ativa/i.test(message)) {
    return new AppError(
      "LIBERACAO_INATIVA",
      "Liberação não está ativa para retirada."
    );
  }
  if (/Retirada fora do período de validade/i.test(message)) {
    return new AppError(
      "RETIRADA_FORA_DA_VALIDADE",
      "Retirada fora do período de validade da liberação (RN13/RN21)."
    );
  }
  if (/Renova..o deve referenciar/i.test(message)) {
    return new AppError(
      "VALIDACAO",
      "Renovação deve referenciar a liberação anterior do mesmo paciente (RN23)."
    );
  }
  if (/Quantidade excede/i.test(message)) {
    return new AppError(
      "SALDO_INSUFICIENTE",
      "Quantidade excede o saldo disponível da liberação (RN14)."
    );
  }
  if (/Período de validade inválido/i.test(message)) {
    return new AppError(
      "VALIDACAO",
      "Período de validade inválido para o tipo de liberação (RN13/RN21)."
    );
  }
  if (/not found|não encontrad|not present/i.test(message)) {
    return new AppError("NAO_ENCONTRADO", message);
  }
  // Unique violation — ex.: pacientes.gestor_sus ou pacientes.cpf já cadastrados.
  if (code === "23505") {
    return new AppError(
      "VALIDACAO",
      "Já existe um paciente com este Gestor SUS (ou CPF)."
    );
  }
  // Foreign key violation — ex.: liberação com paciente inexistente. A mensagem
  // crua do Postgres cita nomes de tabelas/constraints; aqui vira mensagem segura.
  if (code === "23503") {
    return new AppError("VALIDACAO", "Registro relacionado não encontrado.");
  }
  // Check constraint violation — ex.: status fora de ('ativo','inativo').
  if (code === "23514") {
    return new AppError("VALIDACAO", "Valor inválido para o registro.");
  }
  if (code === "P0001") {
    return new AppError("VALIDACAO", message);
  }
  return new AppError("ERRO_INTERNO", message);
}

// Normaliza qualquer erro (AppError ou não) em uma mensagem exibível.
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof AppError) return erro.message;
  const err = erro as { message?: string } | null;
  return err?.message ?? "Ocorreu um erro inesperado.";
}
