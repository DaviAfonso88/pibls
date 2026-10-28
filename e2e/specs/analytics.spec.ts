import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// FR-076 (ADR-022): a medição de uso é sem cookies, sem `localStorage`, não identifica a pessoa e só fala com a ferramenta
// configurada. O site público não chama nenhum outro terceiro, e o painel não carrega a medição.
//
// Duas formas de rodar:
//  - sem variável (build sem `VITE_ANALYTICS_SRC`): confere que o site público só fala com a própria origem;
//  - `E2E_ANALYTICS_ORIGINS=https://gc.zgo.at,https://<código>.goatcounter.com` (build com a medição ligada): a primeira origem
//    é a do script. Confere que o script carrega, que as origens da ferramenta são as únicas de terceiros e que só o caminho é
//    enviado. Com `E2E_ANALYTICS_STUB=1` as chamadas à ferramenta são respondidas aqui (nenhum acesso à rede, nenhum pageview
//    de teste na conta real); para um build local: `VITE_ANALYTICS_SRC=https://gc.zgo.at/count.js
//    VITE_ANALYTICS_ENDPOINT=https://e2e.goatcounter.com/count npm run build && npm run deploy:local`.

const TOOL_ORIGINS = (process.env.E2E_ANALYTICS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin !== "");
const STUB = process.env.E2E_ANALYTICS_STUB === "1";
const MEASURED = TOOL_ORIGINS.length > 0;

/** O `count.js` de mentira: guarda o destino e manda o caminho como o de verdade (`sendBeacon`). */
const STUB_SCRIPT = `
(function () {
  var endpoint = document.currentScript && document.currentScript.dataset.goatcounter;
  window.goatcounter = window.goatcounter || {};
  window.goatcounter.count = function (vars) {
    navigator.sendBeacon(endpoint + "?p=" + encodeURIComponent(vars.path));
  };
})();
`;

const PUBLIC_PAGES = ["/", "/quem-somos", "/grupos", "/boletins", "/sou-visitante?grupo=23"];

/** Anota toda requisição para fora da origem do site e cada caminho enviado à ferramenta. */
async function watch(context: BrowserContext, page: Page, siteOrigin: string) {
  const foreign = new Set<string>();
  const sentPaths: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.origin !== siteOrigin) foreign.add(url.origin);
  });

  if (STUB && MEASURED) {
    const [scriptOrigin, ...rest] = TOOL_ORIGINS;
    await context.route(`${scriptOrigin}/**`, (route) =>
      route.fulfill({ contentType: "text/javascript", body: STUB_SCRIPT }),
    );
    for (const origin of rest) {
      await context.route(`${origin}/**`, async (route) => {
        sentPaths.push(new URL(route.request().url()).searchParams.get("p") ?? "");
        await route.fulfill({ status: 204 });
      });
    }
  }

  return { foreign, sentPaths };
}

async function expectNoTraces(page: Page, context: BrowserContext) {
  expect(await context.cookies(), "nenhum cookie").toEqual([]);
  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
  }));
  // A única chave é a do próprio React Router (posição de rolagem, só na aba); nada da ferramenta
  expect(storage.local, "nada em localStorage").toEqual([]);
  expect(
    storage.session.filter((key) => key !== "react-router-scroll-positions"),
    "nada em sessionStorage além da rolagem do roteador",
  ).toEqual([]);
}

test.describe("medição de uso sem cookies @us8", () => {
  test("o site público só fala com a própria origem e com a ferramenta configurada, sem cookie nem armazenamento", async ({
    page,
    context,
    baseURL,
  }) => {
    const siteOrigin = new URL(baseURL ?? "http://localhost:8080").origin;
    const { foreign, sentPaths } = await watch(context, page, siteOrigin);

    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Deixa a hidratação e o envio do pageview acontecerem antes da próxima página
      await page.waitForLoadState("networkidle");
    }

    expect([...foreign].sort(), "terceiros chamados pelo site público").toEqual([...TOOL_ORIGINS].sort().filter((origin) => foreign.has(origin)));
    if (MEASURED) expect(foreign.has(TOOL_ORIGINS[0] ?? ""), "o script da medição carregou").toBe(true);

    if (STUB && MEASURED) {
      // O caminho vai sem a query string (`?grupo=23`), e cada página aberta é um pageview
      expect(sentPaths).toEqual(["/", "/quem-somos", "/grupos", "/boletins", "/sou-visitante"]);
    }

    await expectNoTraces(page, context);
  });

  test("o painel não carrega a medição, nem a tela de entrada", async ({ page, context, baseURL }) => {
    const siteOrigin = new URL(baseURL ?? "http://localhost:8080").origin;
    const { foreign, sentPaths } = await watch(context, page, siteOrigin);

    await page.goto("/admin/entrar");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect([...foreign].filter((origin) => TOOL_ORIGINS.includes(origin)), "a medição não pode abrir no painel").toEqual([]);
    expect(sentPaths).toEqual([]);
    await expect(page.locator("script[data-goatcounter]")).toHaveCount(0);
  });
});
