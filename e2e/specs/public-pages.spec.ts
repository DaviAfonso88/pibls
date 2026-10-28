import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// US1: o site público a 360 px (T058). Roda contra o build servido (Apache local, homologação ou o servidor do job
// a11y-perf). O conteúdo vem do snapshot que o ambiente serve; os cenários que precisam de um dado específico (células com
// bairro, mapa, snapshot indisponível) interceptam `/data/*.json` com as fixtures de e2e/fixtures/data, que são fictícias.

const fixture = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../fixtures/data/${name}.json`, import.meta.url)),
    "utf8",
  );

/** Serve uma fixture no lugar do arquivo estático. */
async function serveFixture(
  page: Page,
  name: string,
  edit?: (json: { data: Record<string, unknown> }) => void,
) {
  await page.route(`**/data/${name}.json`, (route: Route) => {
    const json = JSON.parse(fixture(name)) as { data: Record<string, unknown> };
    edit?.(json);
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(json),
    });
  });
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
}

test.describe("página inicial @us1", () => {
  test("mostra boas-vindas, horários, avisos, transmissões e rodapé", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Seja bem-vindo. Aqui as pessoas importam.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Planeje sua visita" }),
    ).toHaveAttribute("href", "/como-chegar");

    const schedule = page.getByRole("region", { name: "Horários" });
    await expect(schedule.getByRole("listitem").first()).toBeVisible();
    await expect(schedule.getByText("Culto Matinal")).toBeVisible();
    await expect(schedule.getByText("10h10")).toBeVisible();
    await expect(schedule.getByText("20h00")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Assista aos cultos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Fale com a gente" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("contentinfo").getByText(/CNPJ 20\.969\.119\/0001-84/),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("o menu do site público não gera rolagem horizontal da página", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("FR-011 mostra o aviso 'desatualizado' quando o arquivo e a API falham e há snapshot no build", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_BUILD_SNAPSHOTS,
      "o build precisa de BUILD_SNAPSHOTS_FROM (job a11y-perf)",
    );
    await page.route("**/data/*.json", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await page.route("**/api/public/**", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );

    await page.goto("/");

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Algumas informações podem estar desatualizadas." }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Horários" })
        .getByRole("listitem")
        .first(),
    ).toBeVisible();
  });

  test("sem snapshot nem API, mostra o erro com 'Tentar novamente'", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env.E2E_BUILD_SNAPSHOTS),
      "com snapshot no build o fallback cobre este caso",
    );
    await page.route("**/data/*.json", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );
    await page.route("**/api/public/**", (route) =>
      route.fulfill({ status: 503, body: "" }),
    );

    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Tentar novamente" }),
    ).toBeVisible();
  });
});

test.describe("como chegar @us1", () => {
  test("o mapa só carrega depois do toque", async ({ page }) => {
    await serveFixture(page, "settings", (json) => {
      json.data.map_links = {
        google_maps_url: "https://maps.example.com/",
        waze_url: "https://waze.example.com/",
        embed_url: "https://www.google.com/maps/embed?pb=exemplo",
      };
    });
    const googleRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("google.com"))
        googleRequests.push(request.url());
    });
    // O iframe de verdade não é necessário: só interessa quando ele é pedido
    await page.route("https://www.google.com/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>mapa de teste</p>" }),
    );

    await page.goto("/como-chegar");

    await expect(
      page.getByRole("heading", { level: 1, name: "Como chegar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Abrir no Google Maps/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Abrir no Waze/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mostrar o mapa" }),
    ).toBeVisible();
    expect(await page.locator("iframe").count()).toBe(0);
    expect(googleRequests).toEqual([]);

    await page.getByRole("button", { name: "Mostrar o mapa" }).click();

    await expect(
      page.locator("iframe[title='Mapa com a localização da igreja']"),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});

test.describe("ministérios @us1", () => {
  test("abre um ministério e leva ao contato com ele pré-selecionado", async ({
    page,
  }) => {
    await page.goto("/ministerios");

    await expect(
      page.getByRole("heading", { level: 1, name: "Ministérios" }),
    ).toBeVisible();
    const first = page
      .getByRole("listitem")
      .filter({ has: page.locator("summary") })
      .first();
    await first.locator("summary").click();
    const link = first.getByRole("link", { name: /Falar com este ministério/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /^\/contato\?ministerio=\d+$/);

    await link.click();

    await expect(page).toHaveURL(/\/contato\?ministerio=\d+$/);
    await expectNoSeriousA11yViolations(page);
  });
});

test.describe("grupos e células @us1", () => {
  test("filtra por perfil e por bairro, sem endereço residencial", async ({
    page,
  }) => {
    await serveFixture(page, "ministries");
    await page.goto("/grupos");

    await expect(
      page.getByRole("heading", { level: 1, name: "Para você" }),
    ).toBeVisible();
    await expect(page.getByText("1 Pedro 4:10")).toBeVisible();
    const cards = page
      .getByRole("region", { name: "Grupos" })
      .getByRole("heading", { level: 2 });
    await expect(cards).toHaveCount(5);

    await page.getByRole("button", { name: "Mulheres" }).click();
    await expect(cards).toHaveText(["Mulheres (MCM)"]);
    await expect(page).toHaveURL(/\?perfil=mulheres$/);

    await page.getByRole("button", { name: "Células de CL" }).click();
    await expect(cards).toHaveText([
      "Célula de CL Promissão",
      "Célula de CL Centro",
    ]);
    await page.getByLabel("Bairro das Células de CL").selectOption("Centro");
    await expect(cards).toHaveText(["Célula de CL Centro"]);
    await expect(page).toHaveURL(/bairro=Centro/);

    const html = await page.content();
    expect(html).not.toContain("private_address");
    await expectNoSeriousA11yViolations(page);
  });

  test("'Quero participar' leva à Ficha de Visitante com o grupo escolhido", async ({
    page,
  }) => {
    await serveFixture(page, "ministries");
    await page.goto("/grupos?perfil=celulas");

    const link = page.getByRole("link", {
      name: "Quero participar: Célula de CL Promissão",
    });
    await expect(link).toHaveAttribute("href", "/sou-visitante?grupo=6");
    await link.click();

    await expect(page).toHaveURL(/\/sou-visitante\?grupo=6$/);
  });

  test("o arquivo público de ministérios nunca traz o endereço residencial nem o e-mail (BR-048)", async ({
    request,
  }) => {
    const response = await request.get("/data/ministries.json");
    test.skip(
      !(response.headers()["content-type"] ?? "").includes("json"),
      "este ambiente não serve /data/ministries.json",
    );

    const body = await response.text();
    expect(body).not.toContain("private_address");
    expect(body).not.toContain("contact_email");
  });
});

test.describe("quem somos @us1", () => {
  test("mostra a idade, a linha do tempo, os 8 ex-pastores e a Declaração de Fé", async ({
    page,
  }) => {
    await page.goto("/quem-somos");

    await expect(
      page.getByRole("heading", { level: 1, name: "Quem somos" }),
    ).toBeVisible();
    await expect(page.getByText("anos de fé e serviço")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nossa história" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("heading", { name: "Pastores que serviram a igreja" })
        .locator("..")
        .getByRole("listitem"),
    ).toHaveCount(8);
    await expect(
      page.getByRole("link", { name: /Ler a Declaração de Fé/ }),
    ).toHaveAttribute("href", /convencaobatista\.com\.br/);
    await expectNoSeriousA11yViolations(page);
  });
});

test.describe("404 amigável @us1", () => {
  test("oferece Início, Horários e Contato", async ({ page }) => {
    await page.goto("/pagina-que-nao-existe");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Não encontramos esta página",
      }),
    ).toBeVisible();
    const shortcuts = page.getByRole("navigation", { name: "Atalhos" });
    await expect(shortcuts.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(
      shortcuts.getByRole("link", { name: "Horários dos cultos" }),
    ).toBeVisible();
    await expect(
      shortcuts.getByRole("link", { name: "Contato" }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});

test.describe("Open Graph por página @us1", () => {
  const pages = [
    { path: "/", title: "Primeira Igreja Batista em Lagoa Santa" },
    { path: "/quem-somos", title: "Quem somos — PIBLS" },
    { path: "/ministerios", title: "Ministérios — PIBLS" },
    { path: "/grupos", title: "Grupos e Células de CL — PIBLS" },
    { path: "/como-chegar", title: "Como chegar — PIBLS" },
  ];

  for (const { path, title } of pages) {
    test(`${path} tem título, descrição, URL e imagem próprios no HTML pré-renderizado`, async ({
      request,
    }) => {
      // O HTML que o WhatsApp e os buscadores leem: sem executar JavaScript
      const html = await (await request.get(path)).text();

      expect(html).toContain(`<title>${title}</title>`);
      expect(html).toMatch(/<meta name="description" content="[^"]{20,}"/);
      expect(html).toContain(`<meta property="og:title" content="${title}"`);
      expect(html).toMatch(
        /<meta property="og:description" content="[^"]{20,}"/,
      );
      expect(html).toContain(
        `<meta property="og:url" content="https://pibls.com${path === "/" ? "/" : path}"`,
      );
      expect(html).toContain(
        '<meta property="og:image" content="https://pibls.com/og-default.png"',
      );
    });
  }

  test("a imagem padrão existe", async ({ request }) => {
    const response = await request.get("/og-default.png");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });
});
