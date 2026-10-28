import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toLocalHtaccess } from "../local-htaccess.mjs";

// O Vite reescreve `new URL("literal", import.meta.url)`; o caminho sai de fileURLToPath
const here = dirname(fileURLToPath(import.meta.url));
const production = readFileSync(
  resolve(here, "../../../deploy/htaccess/public_html.htaccess"),
  "utf8",
);

describe("toLocalHtaccess", () => {
  const local = toLocalHtaccess(production);

  it("tira só o que presume HTTPS", () => {
    expect(production).toContain("RewriteCond %{HTTPS} !=on");
    expect(local).not.toContain("%{HTTPS}");
    expect(local).not.toContain("X-Forwarded-Proto");
    expect(local).not.toContain("upgrade-insecure-requests");
    expect(local).not.toContain("Strict-Transport-Security");
  });

  it("mantém o roteamento e os cabeçalhos de produção", () => {
    expect(local).toContain("DirectoryIndex index.html");
    expect(local).toContain("RewriteRule ^ __spa-fallback.html [L]");
    expect(local).toContain("RewriteRule ^(api|sanctum)/ index.php [L]");
    expect(local).toContain("Content-Security-Policy");
    expect(local).toContain("default-src 'self'");
    expect(local).toContain("X-Frame-Options");
    expect(local).toContain("# BEGIN pibls");
    expect(local).toContain("# END pibls");
  });

  it("avisa se o .htaccess de produção mudar de forma", () => {
    expect(() => toLocalHtaccess("# nada de HTTPS aqui\nRewriteEngine On\n")).toThrow(
      "ajuste toLocalHtaccess",
    );
  });
});
