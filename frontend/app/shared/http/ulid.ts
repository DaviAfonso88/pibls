// ULID (https://github.com/ulid/spec): 48 bits de tempo + 80 bits aleatórios, em 26 caracteres de Crockford base32.
// Identifica cada chamada à API no cabeçalho `X-Request-Id`; o servidor o devolve em `error.traceId` e o grava no log.
// Implementação própria e curta: a stack não inclui uma biblioteca de ULID e o formato é estável.

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

/** Mesmo padrão que o backend aceita em `X-Request-Id` (RequestId::isValid). */
export const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

function encodeTime(timestamp: number): string {
  let remaining = timestamp;
  let encoded = "";
  for (let index = 0; index < TIME_LENGTH; index += 1) {
    encoded = (ENCODING[remaining % 32] ?? "0") + encoded;
    remaining = Math.floor(remaining / 32);
  }
  return encoded;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  crypto.getRandomValues(bytes);
  let encoded = "";
  for (const byte of bytes) {
    encoded += ENCODING[byte % 32] ?? "0";
  }
  return encoded;
}

/** Gera um ULID novo. `now` só existe para os testes. */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}
