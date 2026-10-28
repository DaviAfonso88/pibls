#!/usr/bin/env node
/** `postbuild`: ver flatten-prerender.mjs. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { flattenPrerendered } from "./flatten-prerender.mjs";

const root = resolve(import.meta.dirname, "..", "build", "client");

if (!existsSync(root)) {
  console.error("build/client não existe: rode o build antes.");
  process.exit(2);
}

const moved = flattenPrerendered(root);
console.log(
  `Páginas pré-renderizadas como <rota>.html: ${moved.length === 0 ? "nenhuma" : moved.join(", ")}`,
);
