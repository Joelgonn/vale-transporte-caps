// Tipo de retorno padronizado para Server Actions.
// Erros são normalizados para mensagens de aplicação (nunca SQL cru).
export type AcaoResultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
