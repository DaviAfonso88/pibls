import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../../test/server";
import { ApiError } from "../errors";
import { readSnapshot } from "../snapshots";

interface Settings {
  name: string;
}

const schema = {
  parse(value: unknown): Settings {
    if (
      typeof value === "object" &&
      value !== null &&
      "name" in value &&
      typeof value.name === "string"
    ) {
      return { name: value.name };
    }
    throw new Error("fora do contrato");
  },
};

const fileBody = { data: { name: "do arquivo" }, generated_at: "2026-11-08T13:10:00Z" };
const apiBody = { data: { name: "da API" } };
const buildBody = { data: { name: "do build" }, generated_at: "2026-10-01T08:00:00Z" };

const staticOk = http.get("*/data/settings.json", () => HttpResponse.json(fileBody));
const apiOk = http.get("*/api/public/settings", () => HttpResponse.json(apiBody));

describe("readSnapshot", () => {
  it("lê o arquivo estático primeiro, sem tocar na API", async () => {
    const apiCalls = vi.fn();
    server.use(
      staticOk,
      http.get("*/api/public/settings", () => {
        apiCalls();
        return HttpResponse.json(apiBody);
      }),
    );

    const result = await readSnapshot("settings", { schema });

    expect(result).toEqual({
      data: { name: "do arquivo" },
      generatedAt: "2026-11-08T13:10:00Z",
      source: "static",
      stale: false,
    });
    expect(apiCalls).not.toHaveBeenCalled();
  });

  it("revalida o arquivo a cada leitura (no-cache), para não servir cópia velha", async () => {
    server.use(staticOk);
    const spy = vi.spyOn(globalThis, "fetch");

    await readSnapshot("settings", { schema });

    expect(spy.mock.calls[0]?.[1]).toMatchObject({ cache: "no-cache" });
    spy.mockRestore();
  });

  it.each([
    [
      "o arquivo não existe (404)",
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 404 })),
    ],
    [
      "o servidor responde 500",
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 500 })),
    ],
    [
      "o arquivo vem em HTML, como no servidor de desenvolvimento",
      http.get("*/data/settings.json", () =>
        HttpResponse.html("<!doctype html><title>SPA</title>"),
      ),
    ],
    [
      "o arquivo não tem o formato do contrato",
      http.get("*/data/settings.json", () => HttpResponse.json({ oi: 1 })),
    ],
    [
      "o dado do arquivo não passa no esquema",
      http.get("*/data/settings.json", () => HttpResponse.json({ data: { x: 1 } })),
    ],
    ["a rede cai", http.get("*/data/settings.json", () => HttpResponse.error())],
  ])("cai para a API quando %s", async (_caso, handler) => {
    server.use(handler, apiOk);

    const result = await readSnapshot("settings", { schema });

    expect(result).toEqual({
      data: { name: "da API" },
      generatedAt: null,
      source: "api",
      stale: false,
    });
  });

  it("usa a função da API informada quando a rota pública não corresponde ao snapshot (home)", async () => {
    server.use(http.get("*/data/home.json", () => new HttpResponse(null, { status: 404 })));
    const fromApi = vi.fn().mockResolvedValue({ name: "composto" });

    const result = await readSnapshot("home", { schema, fromApi });

    expect(result.source).toBe("api");
    expect(result.data).toEqual({ name: "composto" });
    expect(fromApi).toHaveBeenCalledTimes(1);
  });

  it("FR-011 cai para o snapshot do build, marcado como desatualizado, quando o arquivo e a API falham", async () => {
    server.use(
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 503 })),
      http.get("*/api/public/settings", () => new HttpResponse(null, { status: 503 })),
    );
    const loadBuildSnapshot = vi.fn().mockResolvedValue(buildBody);

    const result = await readSnapshot("settings", { schema, loadBuildSnapshot });

    expect(result).toEqual({
      data: { name: "do build" },
      generatedAt: "2026-10-01T08:00:00Z",
      source: "build",
      stale: true,
    });
    expect(loadBuildSnapshot).toHaveBeenCalledWith("settings");
  });

  it("FR-011 devolve o erro da API quando não há nenhum snapshot de build", async () => {
    server.use(
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 404 })),
      http.get("*/api/public/settings", () =>
        HttpResponse.json(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "O site está com instabilidade.",
              details: [],
              traceId: "T1",
            },
          },
          { status: 503 },
        ),
      ),
    );

    const error = await readSnapshot("settings", {
      schema,
      loadBuildSnapshot: () => Promise.resolve(null),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE", traceId: "T1" });
  });

  it("não usa o snapshot do build se ele estiver fora do contrato", async () => {
    server.use(
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 404 })),
      http.get("*/api/public/settings", () => HttpResponse.error()),
    );

    const error = await readSnapshot("settings", {
      schema,
      loadBuildSnapshot: () => Promise.resolve({ data: { x: 1 } }),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("sem arquivo, sem rota equivalente e sem snapshot, falha com a mensagem genérica", async () => {
    server.use(http.get("*/data/home.json", () => new HttpResponse(null, { status: 404 })));

    const error = await readSnapshot("home", {
      schema,
      loadBuildSnapshot: () => Promise.resolve(undefined),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Algo deu errado. Tente novamente em instantes." });
  });

  it("o snapshot do build padrão devolve nulo quando a pasta está vazia", async () => {
    server.use(
      http.get("*/data/ministries.json", () => new HttpResponse(null, { status: 404 })),
      http.get("*/api/public/ministries", () => new HttpResponse(null, { status: 500 })),
    );

    await expect(readSnapshot("ministries", { schema })).rejects.toBeInstanceOf(ApiError);
  });

  it("cancelar a leitura não cai para a API nem para o build", async () => {
    // O AbortSignal do jsdom não é o do undici (fetch do Node): o fetch é simulado, como nos testes do cliente
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const controller = new AbortController();
    const loadBuildSnapshot = vi.fn();

    const pending = readSnapshot("settings", {
      schema,
      signal: controller.signal,
      loadBuildSnapshot,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    // Só o arquivo estático foi pedido: nada de API nem de build
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loadBuildSnapshot).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
