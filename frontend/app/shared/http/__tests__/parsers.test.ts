import { describe, expect, it } from "vitest";
import {
  array,
  boolean,
  nullish,
  number,
  object,
  oneOf,
  schema,
  string,
  withDefault,
} from "../parsers";

describe("parsers", () => {
  it("aceitam o tipo certo e recusam o resto, dizendo onde", () => {
    expect(string("a")).toBe("a");
    expect(number(3)).toBe(3);
    expect(boolean(false)).toBe(false);
    expect(() => string(1, "name")).toThrow("name: esperado texto");
    expect(() => number("3")).toThrow("esperado número");
    expect(() => number(Number.NaN)).toThrow("esperado número");
    expect(() => boolean("true")).toThrow("verdadeiro ou falso");
  });

  it("nullish deixa passar null e ausente, mas valida o resto", () => {
    const parser = nullish(string);

    expect(parser(null)).toBeNull();
    expect(parser(undefined)).toBeUndefined();
    expect(parser("x")).toBe("x");
    expect(() => parser(1)).toThrow();
  });

  it("withDefault troca null e ausente pelo valor padrão", () => {
    const parser = withDefault(array(string), []);

    expect(parser(undefined)).toEqual([]);
    expect(parser(null)).toEqual([]);
    expect(parser(["a"])).toEqual(["a"]);
    expect(() => parser("a")).toThrow("esperado lista");
  });

  it("array valida cada item e aponta o índice", () => {
    expect(() => array(number)([1, "dois"], "ids")).toThrow("ids[1]: esperado número");
  });

  it("oneOf só aceita um dos valores", () => {
    const parser = oneOf(["MINISTERIO", "GRUPO"]);

    expect(parser("GRUPO")).toBe("GRUPO");
    expect(() => parser("OUTRO", "category")).toThrow("category: esperado MINISTERIO | GRUPO");
    expect(() => parser(1)).toThrow();
  });

  it("object valida os campos, ignora os extras e aponta o caminho de um erro", () => {
    const parser = object({
      id: number,
      owner: object({ name: string }),
      tags: withDefault(array(string), []),
    });

    expect(parser({ id: 1, owner: { name: "Ana", cpf: "x" }, extra: true })).toEqual({
      id: 1,
      owner: { name: "Ana" },
      tags: [],
    });
    expect(() => parser({ id: 1, owner: { name: 5 } })).toThrow("owner.name: esperado texto");
    expect(() => parser(null)).toThrow("esperado objeto");
    expect(() => parser([])).toThrow("esperado objeto");
  });

  it("schema entrega o formato { parse } que o readSnapshot espera", () => {
    expect(schema(object({ a: number })).parse({ a: 1 })).toEqual({ a: 1 });
  });
});
