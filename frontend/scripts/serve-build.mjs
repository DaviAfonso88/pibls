#!/usr/bin/env node
/**
 * Serve o build da SPA como o Apache serve (ver static-routes.mjs), para o Playwright + axe e o Lighthouse do CI.
 *
 * Uso: node scripts/serve-build.mjs [pasta-do-build-client]      (padrão: build/client)
 * Ambiente: PORT (4173) e FIXTURES_DIR (pasta cujos arquivos respondem em /data/*, com dados fictícios; sem ela,
 * /data/* cai na SPA como num servidor sem snapshots).
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { CONTENT_TYPES, resolvePath } from "./static-routes.mjs";

const root = resolve(process.argv[2] ?? "build/client");
const fixtures = process.env.FIXTURES_DIR ? resolve(process.env.FIXTURES_DIR) : null;
const port = Number(process.env.PORT ?? 4173);

const isFile = (path) => existsSync(path) && statSync(path).isFile();

function send(response, file) {
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    // Assets têm hash no nome e nunca mudam; HTML e dados sempre revalidam, como no .htaccess
    "Cache-Control": file.startsWith(join(root, "assets"))
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  createReadStream(file).pipe(response);
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");

  // Os dados fictícios do snapshot entram no lugar de public_html/data/
  if (fixtures && pathname.startsWith("/data/")) {
    const resolved = resolvePath(pathname.slice("/data".length), (relative) =>
      isFile(join(fixtures, relative)),
    );
    if (resolved.kind === "file" && isFile(join(fixtures, resolved.path))) {
      send(response, join(fixtures, resolved.path));
      return;
    }
  }

  const resolution = resolvePath(pathname, (relative) => isFile(join(root, relative)));

  if (resolution.kind === "forbidden") {
    response.writeHead(403).end();
  } else if (resolution.kind === "notFound") {
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        error: { code: "NOT_FOUND", message: "Não encontrado.", details: [], traceId: "" },
      }),
    );
  } else {
    send(response, join(root, resolution.path));
  }
}).listen(port, () => {
  console.log(`Servindo ${root} em http://localhost:${port}`);
});
