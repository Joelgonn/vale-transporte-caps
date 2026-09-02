// Domínio — CPF canônico
// Normalização: somente dígitos, máximo 11
// Formatação: 000.000.000-00 para exibição

export function normalizeCpf(value: unknown): string {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  // Limita a 11 dígitos (CPF)
  return digits.slice(0, 11);
}

export function formatCpf(value: unknown): string {
  const digits = normalizeCpf(value);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isCpfParcialValido(value: string): boolean {
  const d = normalizeCpf(value);
  return d.length > 0 && d.length <= 11;
}
