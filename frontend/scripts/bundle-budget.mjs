/**
 * Orçamento de bundle do site público (Performance: celular de gama média em 4G; tasks T052).
 *
 * "Carga inicial" de uma rota é tudo o que o navegador baixa para mostrá-la: o entry da SPA mais o módulo de cada rota
 * da cadeia (root → layout → página) e os imports estáticos deles, sem repetir arquivo. O que é carregado depois, por
 * `import()` (painel, pdfmake, TipTap, mapas), não conta. Os limites valem para a PIOR rota pública; as rotas do
 * painel (`routes/admin/*`) ficam de fora porque entram só por `lazy`.
 *
 * As funções são puras (recebem o manifesto e uma função de tamanho) para o teste não precisar de build.
 */

/** Limites em bytes, já gzip (como o Apache entrega com mod_deflate). */
export const BUDGETS = {
  jsGzipBytes: 160 * 1024,
  cssGzipBytes: 40 * 1024,
};

const PREFIX = "window.__reactRouterManifest=";

/** O manifesto do React Router é um JS: `window.__reactRouterManifest={...};`. Devolve o objeto. */
export function parseManifest(source) {
  const start = source.indexOf(PREFIX);
  if (start === -1) throw new Error("manifesto do React Router não encontrado");

  const end = source.lastIndexOf("};");
  const json = source.slice(start + PREFIX.length, end + 1);
  return JSON.parse(json);
}

export function isAdminRoute(routeId) {
  return routeId === "routes/admin" || routeId.startsWith("routes/admin/");
}

/** Ids de cima para baixo: root, layout, página. */
export function routeChain(manifest, routeId) {
  const chain = [];
  for (let id = routeId; id !== undefined; id = manifest.routes[id]?.parentId) {
    chain.unshift(id);
  }
  return chain;
}

/** Rotas que ninguém tem como pai: as páginas de verdade. */
export function leafRoutes(manifest) {
  const parents = new Set(Object.values(manifest.routes).map((route) => route.parentId));
  return Object.keys(manifest.routes).filter((id) => !parents.has(id));
}

/** Arquivos de uma carga inicial: `{ js: Set, css: Set }`, com caminhos do manifesto (`/assets/x.js`). */
export function initialAssets(manifest, routeId) {
  const js = new Set([manifest.entry.module, ...manifest.entry.imports]);
  const css = new Set(manifest.entry.css ?? []);

  for (const id of routeChain(manifest, routeId)) {
    const route = manifest.routes[id];
    js.add(route.module);
    for (const file of route.imports ?? []) js.add(file);
    for (const file of route.css ?? []) css.add(file);
  }

  return { js, css };
}

/**
 * Mede cada rota pública e aponta quem estoura.
 * @param {object} manifest
 * @param {(file: string) => number} gzipSizeOf tamanho gzip em bytes do arquivo (caminho do manifesto)
 * @param {{jsGzipBytes: number, cssGzipBytes: number}} budgets
 */
export function evaluate(manifest, gzipSizeOf, budgets = BUDGETS) {
  const rows = leafRoutes(manifest)
    .filter((id) => !isAdminRoute(id))
    .map((id) => {
      const { js, css } = initialAssets(manifest, id);
      const sum = (files) => [...files].reduce((total, file) => total + gzipSizeOf(file), 0);
      return {
        route: id,
        jsBytes: sum(js),
        cssBytes: sum(css),
        jsFiles: js.size,
        cssFiles: css.size,
      };
    })
    .sort((a, b) => b.jsBytes - a.jsBytes);

  const violations = [];
  for (const row of rows) {
    if (row.jsBytes > budgets.jsGzipBytes) {
      violations.push(
        `${row.route}: JS ${kb(row.jsBytes)} KB gzip, acima do limite de ${kb(budgets.jsGzipBytes)} KB`,
      );
    }
    if (row.cssBytes > budgets.cssGzipBytes) {
      violations.push(
        `${row.route}: CSS ${kb(row.cssBytes)} KB gzip, acima do limite de ${kb(budgets.cssGzipBytes)} KB`,
      );
    }
  }

  return { rows, violations };
}

export function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}
