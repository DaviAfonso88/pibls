/**
 * Resolução de caminhos que imita o `.htaccess` do docroot (deploy/htaccess/public_html.htaccess), para testar o build
 * da SPA sem Apache (CI do a11y/desempenho). A ordem é a do contrato:
 *
 *   1. `/` → index.html
 *   2. arquivo que existe (assets/, data/, favicon…) → servido direto
 *   3. `<caminho>.html` que existe (página pré-renderizada) → servido
 *   4. `/api` e `/sanctum` → Laravel; aqui não há PHP, então 404
 *   5. todo o resto → __spa-fallback.html, com status 200 (painel e 404 da SPA)
 *
 * Função pura: recebe `exists(relativePath)` e devolve o que servir.
 */

/** @typedef {{ kind: "file", path: string } | { kind: "notFound" } | { kind: "forbidden" }} Resolution */

/**
 * @param {string} urlPath caminho da URL, sem query string
 * @param {(relativePath: string) => boolean} exists diz se o arquivo existe no docroot
 * @returns {Resolution}
 */
export function resolvePath(urlPath, exists) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return { kind: "forbidden" };
  }

  // Sobe de pasta? Arquivo oculto? Nem chega ao disco (o .htaccess também nega: regra 2)
  const segments = decoded.split("/").filter((segment) => segment !== "");
  if (segments.some((segment) => segment === ".." || segment.startsWith("."))) {
    return { kind: "forbidden" };
  }

  const relative = segments.join("/");
  if (relative === "") return { kind: "file", path: "index.html" };
  if (exists(relative)) return { kind: "file", path: relative };
  if (exists(`${relative}.html`)) return { kind: "file", path: `${relative}.html` };
  if (/^(api|sanctum)(\/|$)/.test(relative)) return { kind: "notFound" };

  return { kind: "file", path: "__spa-fallback.html" };
}

export const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
