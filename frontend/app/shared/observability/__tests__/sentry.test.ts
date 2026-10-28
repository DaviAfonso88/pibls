import type { Breadcrumb, ErrorEvent } from "@sentry/react";
import { describe, expect, it } from "vitest";
import {
  initSentry,
  reportError,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
  scrubUrl,
} from "../sentry";

describe("scrubText", () => {
  it("troca e-mail, telefone, CPF e CNPJ por [redigido]", () => {
    expect(scrubText("Falha para maria.souza@example.com ao enviar")).toBe(
      "Falha para [redigido] ao enviar",
    );
    expect(scrubText("Telefone (31) 99999-8888 inválido")).toBe("Telefone [redigido] inválido");
    expect(scrubText("Tel +55 31 99999-8888")).toBe("Tel [redigido]");
    expect(scrubText("CPF 123.456.789-09")).toBe("CPF [redigido]");
    expect(scrubText("CNPJ 20.969.119/0001-84")).toBe("CNPJ [redigido]");
  });

  it("deixa em paz números curtos e identificadores", () => {
    expect(scrubText("Erro 500 na edição 1234, evento 15")).toBe(
      "Erro 500 na edição 1234, evento 15",
    );
    expect(scrubText("01ARYZ6S41TSV4RRFFQ69G5FAV")).toBe("01ARYZ6S41TSV4RRFFQ69G5FAV");
  });
});

describe("scrubUrl", () => {
  it("tira a query string e o hash", () => {
    expect(scrubUrl("https://pibls.com/contato?nome=Maria&tel=31999998888#topo")).toBe(
      "https://pibls.com/contato",
    );
    expect(scrubUrl("/sou-visitante?grupo=7")).toBe("/sou-visitante");
  });

  it("não deixa um telefone no caminho", () => {
    expect(scrubUrl("https://pibls.com/api/x/31999998888")).toBe(
      "https://pibls.com/api/x/[redigido]",
    );
  });
});

describe("scrubBreadcrumb", () => {
  it("descarta cliques, digitação e console", () => {
    for (const category of ["ui.click", "ui.input", "console"]) {
      expect(scrubBreadcrumb({ category, message: "button#enviar" })).toBeNull();
    }
  });

  it("mantém só o que serve de rastro numa chamada à API, sem query string", () => {
    const breadcrumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: "/api/public/leads?email=a@b.co",
        method: "POST",
        status_code: 422,
        request_body: "x",
        headers: {},
      },
    };

    expect(scrubBreadcrumb(breadcrumb)).toEqual({
      category: "fetch",
      message: undefined,
      data: { url: "/api/public/leads", method: "POST", status_code: 422 },
    });
  });
});

describe("scrubEvent", () => {
  it("remove usuário, cabeçalhos, cookies, corpo e dados extras", () => {
    const event = {
      type: undefined,
      user: { email: "maria@example.com", ip_address: "1.2.3.4" },
      extra: { form: { name: "Maria" } },
      server_name: "maquina",
      request: {
        url: "https://pibls.com/contato?tel=31999998888",
        headers: { Cookie: "XSRF-TOKEN=abc" },
        cookies: { a: "b" },
        data: { name: "Maria" },
        query_string: "tel=31999998888",
      },
      message: "Falha com maria@example.com",
      exception: { values: [{ type: "Error", value: "Telefone (31) 99999-8888 recusado" }] },
      breadcrumbs: [
        { category: "ui.click", message: "a" },
        { category: "navigation", data: { from: "/a?x=1", to: "/b?y=2" } },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.server_name).toBeUndefined();
    expect(scrubbed.request).toEqual({ url: "https://pibls.com/contato" });
    expect(scrubbed.message).toBe("Falha com [redigido]");
    expect(scrubbed.exception?.values?.[0]?.value).toBe("Telefone [redigido] recusado");
    expect(scrubbed.breadcrumbs).toEqual([
      { category: "navigation", message: undefined, data: { from: "/a", to: "/b" } },
    ]);
  });
});

describe("initSentry e reportError", () => {
  it("sem DSN não carrega nem liga nada, e relatar um erro não faz nada nem lança", () => {
    initSentry();

    expect(() => reportError(new Error("boom"))).not.toThrow();
  });
});
