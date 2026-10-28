import { describe, expect, it } from "vitest";
import { ApiError, NETWORK_ERROR_CODE } from "~/shared/http/errors";
import { STALE_TIME, createQueryClient, shouldRetry } from "../query-client";

const apiError = (status: number, code = "X") => new ApiError({ status, code, message: "erro" });

describe("shouldRetry", () => {
  it("repete falha de rede e erro 5xx, no máximo duas vezes", () => {
    expect(shouldRetry(0, apiError(0, NETWORK_ERROR_CODE))).toBe(true);
    expect(shouldRetry(1, apiError(503))).toBe(true);
    expect(shouldRetry(2, apiError(503))).toBe(false);
  });

  it.each([401, 403, 404, 409, 419, 422, 429])("não repete o erro %s", (status) => {
    expect(shouldRetry(0, apiError(status))).toBe(false);
  });

  it("não repete um erro que não é da API", () => {
    expect(shouldRetry(0, new Error("boom"))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("aplica as regras de cache do plano", () => {
    const options = createQueryClient().getDefaultOptions();

    expect(options.queries?.staleTime).toBe(60_000);
    expect(options.queries?.refetchOnWindowFocus).toBe(true);
    expect(options.mutations?.retry).toBe(false);
  });

  it("deixa detalhe de evento e painel sempre frescos e o auth/me por 5 minutos", () => {
    expect(STALE_TIME.detail).toBe(0);
    expect(STALE_TIME.admin).toBe(0);
    expect(STALE_TIME.me).toBe(5 * 60_000);
    expect(STALE_TIME.snapshot).toBe(60_000);
  });
});
