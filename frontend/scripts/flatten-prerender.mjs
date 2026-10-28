/**
 * O React Router grava cada página pré-renderizada como `<rota>/index.html`. O `.htaccess` do docroot procura
 * `<rota>.html` (regra 5: `RewriteCond %{DOCUMENT_ROOT}/$1.html -f`), que é o layout previsto no build
 * (architecture.md: `index.html, quem-somos.html, …, __spa-fallback.html`). Sem isto, `/quem-somos` cairia no
 * `__spa-fallback.html` (sem o título e o Open Graph da página) em vez de no HTML pré-renderizado.
 *
 * `quem-somos/index.html` vira `quem-somos.html`, a pasta vazia some, e o `index.html` da raiz fica onde está.
 */
import { existsSync, readdirSync, renameSync, rmdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Pastas que não são páginas: arquivos do build e conteúdo servido pelo Apache. */
const IGNORED = new Set(["assets", "data", "uploads"]);

/**
 * @param {string} root pasta do build (`build/client`)
 * @returns {string[]} as páginas movidas, relativas à raiz (`quem-somos.html`)
 */
export function flattenPrerendered(root) {
  const moved = [];

  function visit(directory, relative) {
    for (const name of readdirSync(directory)) {
      if (relative === "" && IGNORED.has(name)) continue;
      const path = join(directory, name);
      if (!statSync(path).isDirectory()) continue;

      const childRelative = relative === "" ? name : `${relative}/${name}`;
      visit(path, childRelative);

      const index = join(path, "index.html");
      if (existsSync(index)) {
        renameSync(index, join(directory, `${name}.html`));
        moved.push(`${childRelative}.html`);
      }
      if (readdirSync(path).length === 0) rmdirSync(path);
    }
  }

  visit(root, "");
  return moved.sort();
}
