import { describe, expect, it } from "vitest";
import { resolvePath } from "../static-routes.mjs";

const files = new Set([
  "index.html",
  "quem-somos.html",
  "__spa-fallback.html",
  "assets/app-abc123.js",
  "favicon.ico",
]);
const exists = (relative: string) => files.has(relative);

describe("resolvePath (imita o .htaccess do docroot)", () => {
  it("a raiz é o index.html", () => {
    expect(resolvePath("/", exists)).toEqual({ kind: "file", path: "index.html" });
  });

  it("arquivo que existe é servido direto", () => {
    expect(resolvePath("/assets/app-abc123.js", exists)).toEqual({
      kind: "file",
      path: "assets/app-abc123.js",
    });
    expect(resolvePath("/favicon.ico", exists)).toEqual({ kind: "file", path: "favicon.ico" });
  });

  it("página pré-renderizada: /quem-somos serve quem-somos.html, com ou sem barra final", () => {
    expect(resolvePath("/quem-somos", exists)).toEqual({ kind: "file", path: "quem-somos.html" });
    expect(resolvePath("/quem-somos/", exists)).toEqual({ kind: "file", path: "quem-somos.html" });
  });

  it("painel e páginas que não existem caem na SPA, com 200", () => {
    expect(resolvePath("/admin/entrar", exists)).toEqual({
      kind: "file",
      path: "__spa-fallback.html",
    });
    expect(resolvePath("/pagina-inexistente", exists)).toEqual({
      kind: "file",
      path: "__spa-fallback.html",
    });
    expect(resolvePath("/data/settings.json", exists)).toEqual({
      kind: "file",
      path: "__spa-fallback.html",
    });
  });

  it("/api e /sanctum são do Laravel: sem PHP aqui, 404", () => {
    expect(resolvePath("/api/health", exists)).toEqual({ kind: "notFound" });
    expect(resolvePath("/sanctum/csrf-cookie", exists)).toEqual({ kind: "notFound" });
  });

  it("nega subida de pasta e arquivo oculto (regra 2 do .htaccess)", () => {
    expect(resolvePath("/../.env", exists)).toEqual({ kind: "forbidden" });
    expect(resolvePath("/assets/%2e%2e/secret", exists)).toEqual({ kind: "forbidden" });
    expect(resolvePath("/.git/config", exists)).toEqual({ kind: "forbidden" });
    expect(resolvePath("/%E0%A4%A", exists)).toEqual({ kind: "forbidden" });
  });
});
