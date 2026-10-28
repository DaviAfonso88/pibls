import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../../test/server";
import { api, resetCsrf, setUnauthorizedHandler } from "../client";
import { ApiError, isApiError } from "../errors";
import { ULID_PATTERN } from "../ulid";

/** Handler do `GET /sanctum/csrf-cookie`: grava o cookie no `document`, como o navegador faria com o Set-Cookie. */
function csrfCookie(token = "token-1", calls: string[] = []) {
  return http.get("*/sanctum/csrf-cookie", () => {
    calls.push("csrf");
    document.cookie = `XSRF-TOKEN=${encodeURIComponent(token)}; path=/`;
    return new HttpResponse(null, { status: 204 });
  });
}

beforeEach(() => {
  resetCsrf();
  setUnauthorizedHandler(null);
  document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cabeçalhos", () => {
  it("envia Accept: application/json e um X-Request-Id que é um ULID válido, sem pedir CSRF numa leitura", async () => {
    const calls: string[] = [];
    let received: Headers | undefined;
    server.use(
      csrfCookie("t", calls),
      http.get("*/api/ping", ({ request }) => {
        received = request.headers;
        return HttpResponse.json({ data: "pong" });
      }),
    );

    const result = await api.get<{ data: string }>("/api/ping");

    expect(result).toEqual({ data: "pong" });
    expect(received?.get("accept")).toBe("application/json");
    expect(received?.get("x-request-id")).toMatch(ULID_PATTERN);
    expect(received?.get("x-xsrf-token")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("usa um X-Request-Id novo a cada chamada", async () => {
    const ids: string[] = [];
    server.use(
      http.get("*/api/ping", ({ request }) => {
        ids.push(request.headers.get("x-request-id") ?? "");
        return HttpResponse.json({});
      }),
    );

    await api.get("/api/ping");
    await api.get("/api/ping");

    expect(new Set(ids).size).toBe(2);
  });

  it("serializa a query, ignorando valores nulos e indefinidos e repetindo listas", async () => {
    let url = "";
    server.use(
      http.get("*/api/leads", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ data: [] });
      }),
    );

    await api.get("/api/leads", {
      query: { type: "ORACAO", status: undefined, q: null, page: 2, only: true, ids: [1, 2] },
    });

    const search = new URL(url).searchParams;
    expect(search.get("type")).toBe("ORACAO");
    expect(search.has("status")).toBe(false);
    expect(search.has("q")).toBe(false);
    expect(search.get("page")).toBe("2");
    expect(search.get("only")).toBe("true");
    expect(search.getAll("ids[]")).toEqual(["1", "2"]);
  });
});

describe("CSRF", () => {
  it("pede o cookie antes da primeira escrita e envia X-XSRF-TOKEN decodificado", async () => {
    const calls: string[] = [];
    let received: Headers | undefined;
    server.use(
      csrfCookie("abc/def==", calls),
      http.post("*/api/public/leads", ({ request }) => {
        received = request.headers;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    await api.post("/api/public/leads", { name: "Maria" });

    expect(calls).toEqual(["csrf"]);
    expect(received?.get("x-xsrf-token")).toBe("abc/def==");
  });

  it("pede o cookie uma vez só por sessão, mesmo com várias escritas", async () => {
    const calls: string[] = [];
    server.use(
      csrfCookie("t", calls),
      http.post("*/api/a", () => HttpResponse.json({})),
      http.patch("*/api/b", () => HttpResponse.json({})),
      http.delete("*/api/c", () => new HttpResponse(null, { status: 204 })),
    );

    await api.post("/api/a", {});
    await api.patch("/api/b", {});
    await api.delete("/api/c");

    expect(calls).toEqual(["csrf"]);
  });

  it("escritas simultâneas compartilham o mesmo pedido do cookie", async () => {
    const calls: string[] = [];
    server.use(
      csrfCookie("t", calls),
      http.post("*/api/a", () => HttpResponse.json({})),
    );

    await Promise.all([api.post("/api/a", {}), api.post("/api/a", {}), api.post("/api/a", {})]);

    expect(calls).toEqual(["csrf"]);
  });

  it("em 419 renova o cookie e repete a escrita uma vez", async () => {
    const calls: string[] = [];
    const tokens: Array<string | null> = [];
    let attempts = 0;
    server.use(
      http.get("*/sanctum/csrf-cookie", () => {
        calls.push("csrf");
        document.cookie = `XSRF-TOKEN=token-${calls.length}; path=/`;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post("*/api/public/leads", ({ request }) => {
        attempts += 1;
        tokens.push(request.headers.get("x-xsrf-token"));
        return attempts === 1
          ? HttpResponse.json(
              { error: { code: "CSRF_TOKEN_MISMATCH", message: "x", details: [], traceId: "T" } },
              { status: 419 },
            )
          : HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );

    const result = await api.post("/api/public/leads", { name: "Maria" });

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["csrf", "csrf"]);
    expect(tokens).toEqual(["token-1", "token-2"]);
    expect(attempts).toBe(2);
  });

  it("se o 419 se repete, desiste (não entra em laço) e devolve CSRF_TOKEN_MISMATCH", async () => {
    let attempts = 0;
    server.use(
      csrfCookie(),
      http.post("*/api/public/leads", () => {
        attempts += 1;
        return HttpResponse.json(
          {
            error: {
              code: "CSRF_TOKEN_MISMATCH",
              message: "Recarregue.",
              details: [],
              traceId: "T9",
            },
          },
          { status: 419 },
        );
      }),
    );

    const error = await api.post("/api/public/leads", {}).catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 419, code: "CSRF_TOKEN_MISMATCH", traceId: "T9" });
    expect(attempts).toBe(2);
  });

  it("não repete uma LEITURA em 419", async () => {
    let attempts = 0;
    server.use(
      http.get("*/api/x", () => {
        attempts += 1;
        return new HttpResponse(null, { status: 419 });
      }),
    );

    await expect(api.get("/api/x")).rejects.toMatchObject({ status: 419 });
    expect(attempts).toBe(1);
  });

  it("se o pedido do cookie falha, a escrita não é enviada e o erro sobe; a próxima escrita tenta de novo", async () => {
    let writes = 0;
    let csrfCalls = 0;
    server.use(
      http.get("*/sanctum/csrf-cookie", () => {
        csrfCalls += 1;
        if (csrfCalls === 1) return new HttpResponse(null, { status: 503 });
        document.cookie = "XSRF-TOKEN=ok; path=/";
        return new HttpResponse(null, { status: 204 });
      }),
      http.post("*/api/a", () => {
        writes += 1;
        return HttpResponse.json({});
      }),
    );

    await expect(api.post("/api/a", {})).rejects.toMatchObject({ status: 503 });
    expect(writes).toBe(0);

    await api.post("/api/a", {});
    expect(writes).toBe(1);
    expect(csrfCalls).toBe(2);
  });
});

describe("corpo", () => {
  it("serializa objetos como JSON com Content-Type", async () => {
    let contentType: string | null = null;
    let body: unknown;
    server.use(
      csrfCookie(),
      http.post("*/api/a", async ({ request }) => {
        contentType = request.headers.get("content-type");
        body = await request.json();
        return HttpResponse.json({});
      }),
    );

    await api.post("/api/a", { name: "José", consent: true });

    expect(contentType).toBe("application/json");
    expect(body).toEqual({ name: "José", consent: true });
  });

  // O FormData e o AbortSignal do jsdom não são os do fetch do Node (undici): nestes dois casos o que importa é o que o
  // cliente entrega ao fetch, então o fetch é substituído por um espião em vez de passar pela rede simulada.
  it("entrega o FormData ao fetch como está, sem fixar o Content-Type (o navegador acrescenta o boundary)", async () => {
    server.use(csrfCookie());
    await api.get("/sanctum/csrf-cookie"); // aquece o cookie com o fetch real
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 201 }));
    const form = new FormData();
    form.set("pdf", new File(["%PDF-1.4"], "boletim.pdf", { type: "application/pdf" }));

    await api.post("/api/admin/bulletins", form);

    const init = fetchSpy.mock.calls.at(-1)?.[1];
    expect(init?.body).toBe(form);
    expect(new Headers(init?.headers).has("content-type")).toBe(false);
    expect(new Headers(init?.headers).get("x-xsrf-token")).toBe("token-1");
  });

  it("devolve undefined em 204", async () => {
    server.use(
      csrfCookie(),
      http.delete("*/api/admin/leads/1", () => new HttpResponse(null, { status: 204 })),
    );

    await expect(api.delete("/api/admin/leads/1")).resolves.toBeUndefined();
  });

  it("repassa o AbortSignal ao fetch e deixa o cancelamento passar como AbortError", async () => {
    const abort = Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(abort);
    const controller = new AbortController();

    await expect(api.get("/api/slow", { signal: controller.signal })).rejects.toBe(abort);

    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

describe("erros", () => {
  it("422 vira ApiError com o código, as mensagens e os erros por campo", async () => {
    server.use(
      csrfCookie(),
      http.post("*/api/public/leads", () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Confira os campos destacados.",
              details: [
                {
                  field: "phone",
                  code: "invalid_phone",
                  message: "Informe um telefone válido com DDD.",
                },
                { field: "phone", code: "required", message: "Este campo é obrigatório." },
                {
                  field: "consent",
                  code: "accepted",
                  message: "Para enviar, você precisa concordar com a Política de Privacidade.",
                },
              ],
              traceId: "01JC8Z3K7Q2W9V5T4N6M8B1X0Y",
            },
          },
          { status: 422 },
        ),
      ),
    );

    const error = (await api.post("/api/public/leads", {}).catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Confira os campos destacados.",
      traceId: "01JC8Z3K7Q2W9V5T4N6M8B1X0Y",
    });
    expect(error.isValidation).toBe(true);
    expect(error.fieldErrors()).toEqual({
      phone: "Informe um telefone válido com DDD.", // o primeiro de cada campo
      consent: "Para enviar, você precisa concordar com a Política de Privacidade.",
    });
  });

  it("409 traz o código específico da regra de negócio", async () => {
    server.use(
      csrfCookie(),
      http.post("*/api/public/events/culto/register", () =>
        HttpResponse.json(
          {
            error: {
              code: "EVENT_FULL",
              message: "Vagas esgotadas para este evento.",
              details: [],
              traceId: "T1",
            },
          },
          { status: 409 },
        ),
      ),
    );

    await expect(api.post("/api/public/events/culto/register", {})).rejects.toMatchObject({
      status: 409,
      code: "EVENT_FULL",
      message: "Vagas esgotadas para este evento.",
    });
  });

  it("429 traz o Retry-After em segundos", async () => {
    server.use(
      csrfCookie(),
      http.post("*/api/public/leads", () =>
        HttpResponse.json(
          {
            error: {
              code: "TOO_MANY_REQUESTS",
              message: "Muitas tentativas.",
              details: [],
              traceId: "T2",
            },
          },
          { status: 429, headers: { "Retry-After": "120" } },
        ),
      ),
    );

    await expect(api.post("/api/public/leads", {})).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 120,
    });
  });

  it("500 usa o traceId do envelope e, sem ele, o do cabeçalho X-Request-Id", async () => {
    server.use(
      http.get("*/api/a", () =>
        HttpResponse.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "Código do erro: T3",
              details: [],
              traceId: "T3",
            },
          },
          { status: 500 },
        ),
      ),
      http.get("*/api/b", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x", details: [], traceId: "" } },
          { status: 500, headers: { "X-Request-Id": "HEADER-ID" } },
        ),
      ),
    );

    await expect(api.get("/api/a")).rejects.toMatchObject({ traceId: "T3" });
    await expect(api.get("/api/b")).rejects.toMatchObject({ traceId: "HEADER-ID" });
  });

  it("resposta de erro fora do envelope (HTML do Apache) vira uma mensagem amigável do status", async () => {
    server.use(
      http.get(
        "*/api/a",
        () =>
          new HttpResponse("<html>502 Bad Gateway</html>", {
            status: 502,
            headers: { "Content-Type": "text/html", "X-Request-Id": "ID-502" },
          }),
      ),
      http.get(
        "*/api/b",
        () =>
          new HttpResponse("<html>503</html>", {
            status: 503,
            headers: { "Content-Type": "text/html" },
          }),
      ),
      http.get("*/api/c", () => new HttpResponse("", { status: 403 })),
    );

    await expect(api.get("/api/a")).rejects.toMatchObject({
      status: 502,
      code: "HTTP_ERROR",
      traceId: "ID-502",
      message:
        "Algo deu errado do nosso lado. Tente novamente em instantes. Código do erro: ID-502",
    });
    await expect(api.get("/api/b")).rejects.toMatchObject({
      status: 503,
      message:
        "O site está com instabilidade. Tente novamente em instantes ou fale conosco pelo WhatsApp.",
    });
    await expect(api.get("/api/c")).rejects.toMatchObject({
      status: 403,
      message: "Você não tem permissão para esta ação.",
    });
  });

  it("falha de rede vira NETWORK_ERROR, sem status", async () => {
    server.use(http.get("*/api/a", () => HttpResponse.error()));

    const error = (await api.get("/api/a").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetwork).toBe(true);
    expect(error).toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Não foi possível conectar. Verifique sua internet e tente de novo.",
    });
  });

  it("sucesso com corpo que não é JSON vira erro, não um objeto quebrado", async () => {
    server.use(http.get("*/api/a", () => new HttpResponse("<html>oi</html>", { status: 200 })));

    await expect(api.get("/api/a")).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });
});

describe("401", () => {
  it("chama o tratamento global registrado e ainda lança o erro", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.get("*/api/admin/leads", () =>
        HttpResponse.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Sua sessão expirou. Entre novamente.",
              details: [],
              traceId: "T4",
            },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(api.get("/api/admin/leads")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(ApiError);
  });

  it("não chama o tratamento em outros erros", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(http.get("*/api/a", () => new HttpResponse(null, { status: 403 })));

    await expect(api.get("/api/a")).rejects.toMatchObject({ status: 403 });

    expect(handler).not.toHaveBeenCalled();
  });
});
