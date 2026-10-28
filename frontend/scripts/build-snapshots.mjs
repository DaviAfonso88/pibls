#!/usr/bin/env node
/**
 * `prebuild`: grava em `app/content/snapshots/` os snapshots que o build leva como último recurso (ver
 * build-snapshots-lib.mjs). Sem `BUILD_SNAPSHOTS_FROM`, limpa a pasta e não leva nenhum.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SNAPSHOT_NAMES, collectSnapshots } from "./build-snapshots-lib.mjs";

const target = resolve(import.meta.dirname, "..", "app", "content", "snapshots");
const from = process.env.BUILD_SNAPSHOTS_FROM?.trim();

// Começa sempre do zero: um snapshot de um build anterior não pode ficar para trás
if (existsSync(target)) {
  for (const name of readdirSync(target)) {
    if (name.endsWith(".json")) rmSync(join(target, name));
  }
}

if (!from) {
  console.log("BUILD_SNAPSHOTS_FROM não definido: o build não leva snapshot de fallback.");
  process.exit(0);
}

mkdirSync(target, { recursive: true });

const folder = resolve(from);
const { files, skipped } = await collectSnapshots(from, {
  fetchText: async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  },
  readText: (name) => {
    const file = join(folder, `${name}.json`);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  },
});

for (const [name, content] of Object.entries(files))
  writeFileSync(join(target, `${name}.json`), content);

console.log(
  `Snapshots do build (${from}): ${Object.keys(files).length} de ${SNAPSHOT_NAMES.length} gravados.`,
);
for (const message of skipped) console.warn(`  aviso: ${message}`);
