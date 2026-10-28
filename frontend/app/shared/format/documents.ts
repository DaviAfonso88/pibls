/**
 * Telefone, CEP e CNPJ: máscaras de digitação, exibição e validação, com as mesmas regras do backend
 * (`PhoneNumber`, `PostalAddress`, `Cnpj`). O servidor é a validação final.
 */

/** Só os dígitos de um texto. */
export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

// ---------------------------------------------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------------------------------------------

/**
 * Dígitos nacionais (DDD + número) de um telefone brasileiro, ou `null` se não for válido: 10 ou 11 dígitos depois
 * de tirar a máscara e o `+55`, com DDD de 11 a 99 (BR-004).
 */
export function nationalPhoneDigits(value: string): string | null {
  let digits = digitsOnly(value);
  // 12 ou 13 dígitos só cabem com o DDI: nenhum número nacional (DDD + 8 ou 9 dígitos) passa de 11
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  return ddd >= 11 && ddd <= 99 ? digits : null;
}

export function isValidPhone(value: string): boolean {
  return nationalPhoneDigits(value) !== null;
}

/** `+5531999998888` ou `31999998888` → `+5531999998888` (o formato gravado no banco); `null` se inválido. */
export function toE164(value: string): string | null {
  const digits = nationalPhoneDigits(value);
  return digits === null ? null : `+55${digits}`;
}

/** `+5531999998888` → `(31) 99999-8888`; `3136881234` → `(31) 3688-1234`. Se não for um telefone, devolve o texto como veio. */
export function formatPhone(value: string): string {
  const digits = nationalPhoneDigits(value);
  if (digits === null) return value;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const split = number.length - 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}

/**
 * Máscara de digitação: `31` → `(31`, `319999` → `(31) 9999`, `3199998888` → `(31) 9999-8888`,
 * `31999998888` → `(31) 99999-8888`. Aceita colar com `+55`. O traço sobe uma casa quando o 11º dígito chega, porque
 * até lá não dá para saber se o número é fixo ou celular.
 */
export function maskPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;

  // 10 dígitos: 4+4; 11 dígitos: 5+4
  const split = digits.length === 11 ? 5 : 4;
  return rest.length <= split
    ? `(${ddd}) ${rest}`
    : `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// CEP
// ---------------------------------------------------------------------------------------------------------------

export function isValidCep(value: string): boolean {
  return digitsOnly(value).length === 8;
}

/** `33400000` → `33400-000`. Se não tiver 8 dígitos, devolve como veio. */
export function formatCep(value: string): string {
  const digits = digitsOnly(value);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
}

/** Máscara de digitação: `33400` → `33400`, `334000` → `33400-0`. */
export function maskCep(value: string): string {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

// ---------------------------------------------------------------------------------------------------------------
// CNPJ
// ---------------------------------------------------------------------------------------------------------------

function cnpjCheckDigit(base: string, weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** 14 dígitos com os dígitos verificadores certos (BR-061); recusa sequências repetidas como 00000000000000. */
export function isValidCnpj(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const first = cnpjCheckDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = cnpjCheckDigit(
    digits.slice(0, 12) + String(first),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return digits[12] === String(first) && digits[13] === String(second);
}

/** `20969119000184` → `20.969.119/0001-84`. Se não tiver 14 dígitos, devolve como veio. */
export function formatCnpj(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length !== 14) return value;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Máscara de digitação do CNPJ. */
export function maskCnpj(value: string): string {
  const digits = digitsOnly(value).slice(0, 14);
  const groups: Array<[number, number, string]> = [
    [0, 2, ""],
    [2, 5, "."],
    [5, 8, "."],
    [8, 12, "/"],
    [12, 14, "-"],
  ];
  return groups
    .filter(([start]) => digits.length > start)
    .map(([start, end, separator]) => separator + digits.slice(start, end))
    .join("");
}
