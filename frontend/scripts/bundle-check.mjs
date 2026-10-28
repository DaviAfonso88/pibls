#!/usr/bin/env node
/**
 * Confere o orçamento de bundle depois do `npm run build` (ver bundle-budget.mjs). Falha (exit 1) se a pior rota
 * pública passar de 160 KB de JS (ADR-023) ou 40 KB de CSS, em gzip.
 *
 * Uso: node scripts/bundle-check.mjs [pasta-do-build-client]   (padrão: build/client)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { BUDGETS, evaluate, kb, parseManifest } from "./bundle-budget.mjs";

const clientDir = resolve(process.argv[2] ?? "build/client");

const manifestFile = readdirSync(join(clientDir, "assets")).find((name) =>
  /^manifest-.*\.js$/.test(name),
);
if (!manifestFile) {
  console.error(`Manifesto não encontrado em ${clientDir}/assets. Rode "npm run build" antes.`);
  process.exit(2);
}

const manifest = parseManifest(readFileSync(join(clientDir, "assets", manifestFile), "utf8"));

const sizes = new Map();
function gzipSizeOf(file) {
  if (!sizes.has(file)) {
    // O Apache usa mod_deflate no nível padrão (6)
    sizes.set(file, gzipSync(readFileSync(join(clientDir, file)), { level: 6 }).length);
  }
  return sizes.get(file);
}

const { rows, violations } = evaluate(manifest, gzipSizeOf);

console.log(
  `Orçamento por rota pública (gzip): JS ≤ ${kb(BUDGETS.jsGzipBytes)} KB, CSS ≤ ${kb(BUDGETS.cssGzipBytes)} KB\n`,
);
console.table(
  rows.map((row) => ({
    rota: row.route,
    "JS (KB)": kb(row.jsBytes),
    "arquivos JS": row.jsFiles,
    "CSS (KB)": kb(row.cssBytes),
  })),
);

if (violations.length > 0) {
  console.error("\nOrçamento estourado:");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log("\nDentro do orçamento.");
