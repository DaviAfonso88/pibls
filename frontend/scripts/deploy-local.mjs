#!/usr/bin/env node
/**
 * `npm run deploy:local`: serve o build da SPA pelo Apache do Docker (http://localhost:8080) com o `.htaccess` real do
 * docroot, como em produção (ADR-004). O docroot local é `backend/public`; o script
 *
 *   1. copia `build/client/*` (index.html, páginas pré-renderizadas, `assets/`, `__spa-fallback.html`) para lá;
 *   2. guarda o `.htaccess` do Laravel em `.htaccess.laravel` e põe o de `deploy/htaccess/public_html.htaccess`, sem o que
 *      presume HTTPS (ver local-htaccess.mjs).
 *
 * `npm run deploy:local -- --restore` desfaz: devolve o `.htaccess` do Laravel e apaga o que copiou. Rode antes
 * `docker compose up -d` e `npm run build`; para os dados do rodapé e dos horários,
 * `docker compose exec app php artisan pibls:snapshots:refresh`.
 */
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { toLocalHtaccess } from "./local-htaccess.mjs";

const frontend = resolve(import.meta.dirname, "..");
const build = join(frontend, "build", "client");
const docroot = resolve(frontend, "..", "backend", "public");
const productionHtaccess = resolve(frontend, "..", "deploy", "htaccess", "public_html.htaccess");

const htaccess = join(docroot, ".htaccess");
const laravelHtaccess = join(docroot, ".htaccess.laravel");

/** O que este script põe no docroot: tudo o que vem do build, mais o `.htaccess`. Nunca toca `data/`, `uploads/` nem `index.php`. */
function builtEntries() {
  return existsSync(build) ? readdirSync(build) : [];
}

function restore() {
  for (const name of builtEntries()) rmSync(join(docroot, name), { recursive: true, force: true });
  if (existsSync(laravelHtaccess)) {
    rmSync(htaccess, { force: true });
    renameSync(laravelHtaccess, htaccess);
  }
  console.log(
    "Docroot local restaurado (.htaccess do Laravel de volta; arquivos do build removidos).",
  );
}

function deploy() {
  if (!existsSync(join(build, "index.html"))) {
    console.error('Build não encontrado em frontend/build/client. Rode "npm run build" antes.');
    process.exit(2);
  }

  // Faz a cópia limpa: um `assets/` de um build antigo não pode sobrar misturado com o novo
  for (const name of builtEntries()) rmSync(join(docroot, name), { recursive: true, force: true });
  cpSync(build, docroot, { recursive: true, force: true });

  if (!existsSync(laravelHtaccess) && existsSync(htaccess)) renameSync(htaccess, laravelHtaccess);
  writeFileSync(htaccess, toLocalHtaccess(readFileSync(productionHtaccess, "utf8")));

  console.log(`Build servido em http://localhost:8080 (copiado para ${docroot}).`);
  console.log("Dados do site: docker compose exec app php artisan pibls:snapshots:refresh");
}

if (process.argv.includes("--restore")) restore();
else deploy();
