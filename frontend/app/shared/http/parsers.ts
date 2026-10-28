/**
 * Validadores mínimos para o que vem dos snapshots e da API pública (`unknown` → tipo conhecido).
 *
 * Por que não o Zod aqui: este código vai em TODA página pública, e o `zod/mini` pesa ~5 KB gzip no JS inicial (orçamento
 * de 160 KB, ADR-023). O Zod continua sendo a escolha para formulários (React Hook Form + resolvers), que carregam o
 * pacote só nas suas rotas. Estes validadores entregam o mesmo contrato do `readSnapshot`: um objeto com `parse`, que
 * lança se o dado não tiver a forma esperada (e aí a leitura cai para a próxima fonte).
 */

export type Parser<T> = (value: unknown, path?: string) => T;

class ParseError extends Error {
  constructor(path: string, expected: string) {
    super(`${path || "valor"}: esperado ${expected}`);
    this.name = "ParseError";
  }
}

export const string: Parser<string> = (value, path = "") => {
  if (typeof value !== "string") throw new ParseError(path, "texto");
  return value;
};

export const number: Parser<number> = (value, path = "") => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ParseError(path, "número");
  return value;
};

export const boolean: Parser<boolean> = (value, path = "") => {
  if (typeof value !== "boolean") throw new ParseError(path, "verdadeiro ou falso");
  return value;
};

/** `null` e ausente passam; qualquer outro valor precisa passar no `parser`. */
export function nullish<T>(parser: Parser<T>): Parser<T | null | undefined> {
  return (value, path) => (value === null || value === undefined ? value : parser(value, path));
}

/** Ausente (`undefined`) ou `null` vira `fallback`; o resto passa pelo `parser`. */
export function withDefault<T>(parser: Parser<T>, fallback: T): Parser<T> {
  return (value, path) => (value === null || value === undefined ? fallback : parser(value, path));
}

export function array<T>(item: Parser<T>): Parser<T[]> {
  return (value, path = "") => {
    if (!Array.isArray(value)) throw new ParseError(path, "lista");
    return value.map((entry: unknown, index) => item(entry, `${path}[${index}]`));
  };
}

export function oneOf<const T extends string>(options: readonly T[]): Parser<T> {
  return (value, path = "") => {
    const found = options.find((option) => option === value);
    if (found === undefined) throw new ParseError(path, options.join(" | "));
    return found;
  };
}

type Shape = Record<string, Parser<unknown>>;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** O objeto que o `shape` descreve: campo que aceita `undefined` (`nullish`) vira opcional. */
export type Infer<S extends Shape> = Simplify<
  { [K in keyof S as undefined extends ReturnType<S[K]> ? never : K]: ReturnType<S[K]> } & {
    [K in keyof S as undefined extends ReturnType<S[K]> ? K : never]?: ReturnType<S[K]>;
  }
>;

/** Objeto com os campos do `shape`; campos a mais são ignorados (o servidor pode acrescentar sem quebrar a SPA). */
export function object<S extends Shape>(shape: S): Parser<Infer<S>> {
  return (value, path = "") => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ParseError(path, "objeto");
    }
    // Os casts abaixo são o preço de tipar o resultado pelo `shape`: cada campo acabou de passar pelo seu parser
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      result[key] = (shape[key] as Parser<unknown>)(source[key], path ? `${path}.${key}` : key);
    }
    return result as Infer<S>;
  };
}

/** Formato que o `readSnapshot` espera de um esquema. */
export function schema<T>(parser: Parser<T>): { parse(value: unknown): T } {
  return { parse: (value) => parser(value) };
}
