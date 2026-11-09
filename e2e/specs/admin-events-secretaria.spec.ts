import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// ADR-027: a Secretaria, que só lê inscritos, chega aos inscritos pelo menu "Eventos", com a API de verdade. Os testes do
// frontend simulam a API, e por isso não pegaram o 403 que o servidor dava em `GET /api/admin/events/{id}`: a tela de
// inscritos dela mostrava "Não foi possível carregar o evento" em qualquer evento. Roda contra o build servido (Apache
// local em http://localhost:8080 ou homologação), com a Comunicação e a Secretaria do LocalDevelopmentSeeder. Dados
// fictícios. Com `FEATURE_EVENTS` desligada, a suíte é pulada. O prefixo `admin-` põe a suíte no projeto `painel-desktop`.
//
// Variáveis: E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend). Faz 2 logins e nenhuma inscrição.

const PASSWORD = process.env.E2E_USERS_PASSWORD;

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

const RUN = `E2E${Date.now().toString(36)}`;
const TITLE = `${RUN} Encontro de casais`;
const SLUG = `${RUN.toLowerCase()}-encontro-de-casais`;
const ORIGIN = { Origin: "http://localhost:8080" };

async function signIn(page: Page, email: string) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Entra só pela API: a Comunicação apenas cria e apaga o evento, e abrir o Início dela dispara consultas à toa. */
async function signInByApi(page: Page, email: string) {
  const response = await page.request.post("/api/auth/login", {
    data: { email, password: PASSWORD ?? "" },
    headers: await xsrf(page),
  });
  expect(response.status()).toBe(200);
}

async function xsrf(page: Page) {
  await page.request.get("/sanctum/csrf-cookie");
  const state = await page.request.storageState();
  return {
    "X-XSRF-TOKEN": decodeURIComponent(
      state.cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value ?? "",
    ),
    ...ORIGIN,
  };
}

test.describe("ADR-027 a Secretaria chega aos inscritos pela lista de eventos @us11", () => {
  test.describe.configure({ mode: "serial" });

  // Cada pessoa no seu contexto (cookies separados); o axe só roda em página criada por `browser.newContext()`
  let contexts: BrowserContext[] = [];
  let comunicacao: Page;
  let secretaria: Page;
  let eventId = 0;

  test.beforeAll(async ({ browser, request }) => {
    const probe = await request.get("/api/public/events");
    test.skip(
      probe.status() === 404,
      "Eventos (R2) estão desligados (FEATURE_EVENTS).",
    );

    // Um rascunho sem inscrições, para poder ser excluído no fim (BR-028)
    const staffContext = await browser.newContext();
    const secretariaContext = await browser.newContext();
    contexts = [staffContext, secretariaContext];
    comunicacao = await staffContext.newPage();
    secretaria = await secretariaContext.newPage();
    await signInByApi(comunicacao, "comunicacao@pibls.test");
    const created = await comunicacao.request.post("/api/admin/events", {
      data: {
        title: TITLE,
        slug: SLUG,
        ministry_id: null,
        description: "<p>Evento fictício criado pelo teste E2E.</p>",
        starts_at: new Date(Date.now() + 21 * 24 * 3_600_000).toISOString(),
        location: "Salão principal",
        max_spots: 30,
      },
      headers: await xsrf(comunicacao),
    });
    expect(created.status(), await created.text()).toBe(201);
    eventId = ((await created.json()) as { data: { id: number } }).data.id;

    await signIn(secretaria, "secretaria@pibls.test");
  });

  test.afterAll(async () => {
    if (comunicacao !== undefined && eventId > 0) {
      await comunicacao.request.delete(`/api/admin/events/${eventId}`, {
        headers: await xsrf(comunicacao),
      });
    }
    for (const context of contexts) await context.close();
  });

  test("o menu mostra Eventos e a lista abre só para consulta", async () => {
    await secretaria
      .getByRole("navigation", { name: "Painel" })
      .getByRole("link", { name: "Eventos" })
      .click();
    await expect(secretaria).toHaveURL(/\/admin\/eventos$/);
    await expect(
      secretaria.getByRole("heading", { level: 1, name: "Eventos" }),
    ).toBeVisible();

    const table = secretaria.getByRole("table", { name: "Eventos" });
    await expect(
      table.getByRole("link", { name: TITLE, exact: true }),
    ).toHaveAttribute("href", `/admin/eventos/${eventId}/inscritos`);
    await expect(
      secretaria.getByRole("link", { name: "Novo evento" }),
    ).toHaveCount(0);
    await expect(
      secretaria.getByRole("link", { name: `Editar o evento ${TITLE}` }),
    ).toHaveCount(0);

    const results = await new AxeBuilder({ page: secretaria })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test("o nome do evento leva aos inscritos, que carregam sem erro e sem o botão de cancelar", async () => {
    await secretaria
      .getByRole("table", { name: "Eventos" })
      .getByRole("link", { name: TITLE, exact: true })
      .click();
    await expect(secretaria).toHaveURL(
      new RegExp(`/admin/eventos/${eventId}/inscritos$`),
    );
    await expect(
      secretaria.getByRole("heading", { level: 1, name: "Inscritos" }),
    ).toBeVisible();
    await expect(
      secretaria.getByText("0 de 30 vagas preenchidas"),
    ).toBeVisible();
    await expect(
      secretaria.getByText("Não foi possível carregar o evento."),
    ).toHaveCount(0);
    await expect(
      secretaria.getByRole("button", { name: "Exportar CSV" }),
    ).toBeEnabled();
  });

  test("a API mostra o evento à Secretaria, mas recusa alterá-lo", async () => {
    expect(
      (await secretaria.request.get(`/api/admin/events/${eventId}`)).status(),
    ).toBe(200);

    const changed = await secretaria.request.patch(
      `/api/admin/events/${eventId}`,
      { data: { title: "Alterado" }, headers: await xsrf(secretaria) },
    );
    expect(changed.status()).toBe(403);

    // A edição continua fechada no painel
    await secretaria.goto(`/admin/eventos/${eventId}`);
    await expect(
      secretaria.getByRole("heading", {
        name: "Você não tem acesso a esta área",
      }),
    ).toBeVisible();
  });
});
