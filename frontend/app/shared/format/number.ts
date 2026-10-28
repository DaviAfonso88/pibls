/** Números em pt-BR: vírgula decimal, ponto de milhar. */

// Espaço sem quebra: o número e a unidade nunca ficam em linhas diferentes
const NBSP = String.fromCharCode(0x00a0);

const integer = new Intl.NumberFormat("pt-BR");
const oneDecimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** `1234` → `1.234` */
export function formatInteger(value: number): string {
  return integer.format(value);
}

/**
 * Tamanho de arquivo em unidades de 1.024 (como o sistema operacional mostra): `1843200` → `1,8 MB`, `10485760` → `10 MB`.
 * Usa espaço sem quebra entre o número e a unidade, para "10" e "MB" não ficarem em linhas diferentes.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatInteger(bytes)}${NBSP}B`;
  if (bytes < 1024 * 1024) return `${oneDecimal.format(bytes / 1024)}${NBSP}KB`;
  return `${oneDecimal.format(bytes / (1024 * 1024))}${NBSP}MB`;
}
