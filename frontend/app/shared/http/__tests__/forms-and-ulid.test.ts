import { describe, expect, it, vi } from "vitest";
import { ApiError, isErrorEnvelope, messageForStatus } from "../errors";
import { applyApiErrors } from "../forms";
import { ULID_PATTERN, ulid } from "../ulid";

describe("ulid", () => {
  it("gera 26 caracteres no alfabeto Crockford, aceitos pelo backend", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(ulid()).toMatch(ULID_PATTERN);
    }
  });

  it("ordena pelo tempo e codifica o instante de forma conhecida", () => {
    // Exemplo da especificação do ULID: o instante 1469918176385 ms vira o prefixo 01ARYZ6S41
    expect(ulid(1_469_918_176_385).slice(0, 10)).toBe("01ARYZ6S41");
    expect(ulid(1_000).slice(0, 10) < ulid(2_000).slice(0, 10)).toBe(true);
    expect(ulid(0).slice(0, 10)).toBe("0000000000");
  });

  it("não repete no mesmo milissegundo", () => {
    const ids = new Set(Array.from({ length: 500 }, () => ulid(1_700_000_000_000)));
    expect(ids.size).toBe(500);
  });
});

describe("ApiError", () => {
  it("guarda só o primeiro erro de cada campo", () => {
    const error = new ApiError({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Confira os campos destacados.",
      details: [
        { field: "name", code: "required", message: "Informe seu nome." },
        { field: "name", code: "min", message: "Curto demais." },
        { field: "phone", code: "invalid_phone", message: "Informe um telefone válido com DDD." },
      ],
    });

    expect(error.fieldErrors()).toEqual({
      name: "Informe seu nome.",
      phone: "Informe um telefone válido com DDD.",
    });
    expect(error.isValidation).toBe(true);
    expect(error.isNetwork).toBe(false);
    expect(error.name).toBe("ApiError");
  });

  it("reconhece o envelope de erro e recusa o que não é", () => {
    expect(isErrorEnvelope({ error: { code: "X", message: "y", details: [], traceId: "" } })).toBe(
      true,
    );
    expect(isErrorEnvelope({ error: { code: "X" } })).toBe(false);
    expect(isErrorEnvelope({ data: [] })).toBe(false);
    expect(isErrorEnvelope(null)).toBe(false);
    expect(isErrorEnvelope("erro")).toBe(false);
  });

  it("dá a mensagem amigável de cada status", () => {
    expect(messageForStatus(401, "")).toBe("Sua sessão expirou. Entre novamente.");
    expect(messageForStatus(429, "")).toBe("Muitas tentativas. Tente novamente em alguns minutos.");
    expect(messageForStatus(500, "ABC")).toContain("Código do erro: ABC");
    expect(messageForStatus(418, "")).toBe("Algo deu errado. Tente novamente em instantes.");
  });
});

describe("applyApiErrors", () => {
  const fields = ["name", "phone", "consent"];

  function validation(details: ConstructorParameters<typeof ApiError>[0]["details"]) {
    return new ApiError({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Confira os campos destacados.",
      details,
    });
  }

  it("coloca cada erro 422 no campo certo e foca o primeiro", () => {
    const setError = vi.fn();

    const result = applyApiErrors(
      validation([
        { field: "phone", code: "invalid_phone", message: "Informe um telefone válido com DDD." },
        { field: "name", code: "required", message: "Informe seu nome." },
      ]),
      setError,
      fields,
    );

    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenNthCalledWith(
      1,
      "phone",
      { type: "invalid_phone", message: "Informe um telefone válido com DDD." },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      "name",
      { type: "required", message: "Informe seu nome." },
      { shouldFocus: false },
    );
    expect(result).toEqual({ general: null, firstField: "phone" });
  });

  it("manda para a mensagem geral o erro de um campo que o formulário não tem", () => {
    const setError = vi.fn();

    const result = applyApiErrors(
      validation([{ field: "website", code: "prohibited", message: "Campo inesperado." }]),
      setError,
      fields,
    );

    expect(setError).not.toHaveBeenCalled();
    expect(result).toEqual({ general: "Campo inesperado.", firstField: null });
  });

  it.each([
    [
      "409",
      new ApiError({
        status: 409,
        code: "EVENT_FULL",
        message: "Vagas esgotadas para este evento.",
      }),
      "Vagas esgotadas para este evento.",
    ],
    [
      "429",
      new ApiError({
        status: 429,
        code: "TOO_MANY_REQUESTS",
        message: "Muitas tentativas. Tente novamente em alguns minutos.",
      }),
      "Muitas tentativas. Tente novamente em alguns minutos.",
    ],
    [
      "rede",
      new ApiError({
        status: 0,
        code: "NETWORK_ERROR",
        message: "Não foi possível conectar. Verifique sua internet e tente de novo.",
      }),
      "Não foi possível conectar. Verifique sua internet e tente de novo.",
    ],
  ])("erro %s vira mensagem geral com o texto do servidor", (_name, error, expected) => {
    const setError = vi.fn();

    expect(applyApiErrors(error, setError, fields)).toEqual({
      general: expected,
      firstField: null,
    });
    expect(setError).not.toHaveBeenCalled();
  });

  it("um erro que não é da API vira a mensagem genérica", () => {
    expect(applyApiErrors(new Error("boom"), vi.fn(), fields).general).toBe(
      "Algo deu errado. Tente novamente em instantes.",
    );
  });
});
