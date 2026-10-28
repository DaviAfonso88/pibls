import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flattenPrerendered } from "../flatten-prerender.mjs";

let root = "";

function write(relative: string, content = "<html></html>") {
  const path = join(root, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pibls-flatten-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("flattenPrerendered (o .htaccess procura <rota>.html)", () => {
  it("move <rota>/index.html para <rota>.html e remove a pasta vazia", () => {
    write("index.html", "raiz");
    write("quem-somos/index.html", "quem somos");
    write("grupos/index.html", "grupos");

    const moved = flattenPrerendered(root);

    expect(moved).toEqual(["grupos.html", "quem-somos.html"]);
    expect(readFileSync(join(root, "quem-somos.html"), "utf8")).toBe("quem somos");
    expect(existsSync(join(root, "quem-somos"))).toBe(false);
    expect(readFileSync(join(root, "index.html"), "utf8")).toBe("raiz");
  });

  it("trata rotas aninhadas", () => {
    write("palavra-viva/index.html", "lista");
    write("palavra-viva/mensagem/index.html", "mensagem");

    expect(flattenPrerendered(root)).toEqual(["palavra-viva.html", "palavra-viva/mensagem.html"]);
    expect(readFileSync(join(root, "palavra-viva/mensagem.html"), "utf8")).toBe("mensagem");
    expect(readFileSync(join(root, "palavra-viva.html"), "utf8")).toBe("lista");
  });

  it("não mexe em assets, data nem uploads, nem em pasta sem index.html", () => {
    write("assets/index.html", "de um pacote");
    write("data/index.html", "dados");
    write("uploads/index.html", "uploads");
    write("outra/arquivo.txt", "x");

    expect(flattenPrerendered(root)).toEqual([]);
    expect(existsSync(join(root, "assets/index.html"))).toBe(true);
    expect(existsSync(join(root, "outra/arquivo.txt"))).toBe(true);
  });

  it("é idempotente", () => {
    write("grupos/index.html");

    flattenPrerendered(root);

    expect(flattenPrerendered(root)).toEqual([]);
    expect(existsSync(join(root, "grupos.html"))).toBe(true);
  });
});
