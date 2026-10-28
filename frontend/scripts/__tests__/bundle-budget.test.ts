import { describe, expect, it } from "vitest";
import {
  evaluate,
  initialAssets,
  leafRoutes,
  parseManifest,
  routeChain,
} from "../bundle-budget.mjs";
import type { ReactRouterManifest } from "../bundle-budget.mjs";

const manifest: ReactRouterManifest = {
  entry: { module: "/assets/entry.js", imports: ["/assets/react.js"], css: [] },
  routes: {
    root: {
      id: "root",
      module: "/assets/root.js",
      imports: ["/assets/react.js", "/assets/ui.js"],
      css: ["/assets/app.css"],
    },
    "routes/public/layout": {
      id: "routes/public/layout",
      parentId: "root",
      module: "/assets/layout.js",
      imports: ["/assets/ui.js"],
      css: [],
    },
    "routes/public/home": {
      id: "routes/public/home",
      parentId: "routes/public/layout",
      index: true,
      module: "/assets/home.js",
      imports: [],
      css: [],
    },
    "routes/public/contato": {
      id: "routes/public/contato",
      parentId: "routes/public/layout",
      path: "contato",
      module: "/assets/contato.js",
      imports: ["/assets/form.js"],
      css: [],
    },
    "routes/admin/layout": {
      id: "routes/admin/layout",
      parentId: "root",
      path: "admin",
      module: "/assets/admin.js",
      imports: ["/assets/tiptap.js"],
      css: [],
    },
    "routes/admin/inicio": {
      id: "routes/admin/inicio",
      parentId: "routes/admin/layout",
      index: true,
      module: "/assets/admin-inicio.js",
      imports: [],
      css: [],
    },
  },
};

const sizes: Record<string, number> = {
  "/assets/entry.js": 60_000,
  "/assets/react.js": 40_000,
  "/assets/ui.js": 20_000,
  "/assets/root.js": 10_000,
  "/assets/layout.js": 3_000,
  "/assets/home.js": 1_000,
  "/assets/form.js": 30_000,
  "/assets/contato.js": 2_000,
  "/assets/admin.js": 500_000,
  "/assets/tiptap.js": 900_000,
  "/assets/admin-inicio.js": 1_000,
  "/assets/app.css": 12_000,
};
const sizeOf = (file: string) => sizes[file] ?? 0;

describe("orçamento de bundle", () => {
  it("lê o manifesto do React Router", () => {
    const source = `window.__reactRouterManifest=${JSON.stringify(manifest)};`;

    expect(parseManifest(source).entry.module).toBe("/assets/entry.js");
    expect(() => parseManifest("console.log(1)")).toThrow("manifesto");
  });

  it("monta a cadeia da raiz até a página e acha as páginas", () => {
    expect(routeChain(manifest, "routes/public/home")).toEqual([
      "root",
      "routes/public/layout",
      "routes/public/home",
    ]);
    expect(leafRoutes(manifest).sort()).toEqual([
      "routes/admin/inicio",
      "routes/public/contato",
      "routes/public/home",
    ]);
  });

  it("soma cada arquivo uma vez só, mesmo importado por vários módulos", () => {
    const { js, css } = initialAssets(manifest, "routes/public/home");

    // react.js e ui.js aparecem no entry, no root e no layout
    expect([...js].sort()).toEqual(
      [
        "/assets/entry.js",
        "/assets/home.js",
        "/assets/layout.js",
        "/assets/react.js",
        "/assets/root.js",
        "/assets/ui.js",
      ].sort(),
    );
    expect([...css]).toEqual(["/assets/app.css"]);
  });

  it("mede só as rotas públicas, da mais pesada para a mais leve, sem o chunk do painel", () => {
    const { rows, violations } = evaluate(manifest, sizeOf, {
      jsGzipBytes: 200_000,
      cssGzipBytes: 40_000,
    });

    expect(rows.map((row) => row.route)).toEqual(["routes/public/contato", "routes/public/home"]);
    expect(rows[0]).toMatchObject({ jsBytes: 165_000, cssBytes: 12_000 });
    expect(rows[1]).toMatchObject({ jsBytes: 134_000 });
    expect(violations).toEqual([]);
  });

  it("aponta a rota que estoura o JS e a que estoura o CSS", () => {
    const { violations } = evaluate(manifest, sizeOf, {
      jsGzipBytes: 150_000,
      cssGzipBytes: 10_000,
    });

    expect(violations).toHaveLength(3);
    expect(violations[0]).toContain("routes/public/contato: JS 161.1 KB gzip");
    expect(violations.filter((violation) => violation.includes("CSS"))).toHaveLength(2);
  });
});
