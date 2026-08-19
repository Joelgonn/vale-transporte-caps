// Mensagens exibidas na UI (Sprint 23). O domínio (`lib/domain`) permanece a
// autoridade e NÃO é alterado aqui: esta camada apenas remove códigos técnicos
// da apresentação e traduz erros de negócio em mensagens claras para o usuário.

const CODIGO_TECNICO = /\s*\(RN[^)]*\)\s*/g;

// Remove códigos técnicos (ex.: "(RN14)", "(RN13/RN21)") das mensagens vindas
// do domínio sem mudar o seu significado.
export function mensagemUsuario(mensagem: string): string {
  return mensagem.replace(CODIGO_TECNICO, "").replace(/\(\s*\)/g, "").trim();
}

// SALDO_INSUFICIENTE: a mensagem do domínio é correta, mas o usuário precisa de
// orientação acionável (reduzir a quantidade ou escolher outra liberação).
export const MENSAGEM_SALDO_INSUFICIENTE =
  "A quantidade solicitada excede o saldo disponível para esta liberação. Reduza a quantidade ou escolha outra liberação.";

export function mensagemRetirada(mensagem: string): string {
  if (/saldo|excede/i.test(mensagem)) return MENSAGEM_SALDO_INSUFICIENTE;
  return mensagemUsuario(mensagem);
}