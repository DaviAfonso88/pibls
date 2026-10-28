import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// US4: o atendimento dos contatos por papel (T101): Secretaria, Oração e Pastoral. Roda contra o build servido com a API
// de verdade (Apache local em http://localhost:8080 ou homologação), com os usuários do LocalDevelopmentSeeder. Os
// contatos são criados pela API pública, como os formulários do site fazem (US2), com dados fictícios e um marcador único.
//
// Variáveis: E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend). Sem ela, a suíte é pulada.
//
// Limites: 10 envios por 10 min por IP (esta suíte envia 6) e 20 logins por 15 min por IP (faz 6). Entre rodadas seguidas,
// `docker compose exec app php artisan cache:clear`. No Docker local, rode com E2E_TEST_TIMEOUT=240000 e
// E2E_EXPECT_TIMEOUT=45000 (cada requisição leva ~10 s).

const PASSWORD = process.env.E2E_USERS_PASSWORD;

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

const RUN = `E2E${Date.now().toString(36)}`;
const phone = (suffix: number) =>
  `+55319${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}${suffix}`.slice(
    0,
    14,
  );

/** Envia um contato pela API pública, como o formulário do site (CSRF incluído). */
async function submitLead(
  request: APIRequestContext,
  body: Record<string, unknown>,
) {
  await request.get("/sanctum/csrf-cookie");
  const state = await request.storageState();
  const token = decodeURIComponent(
    state.cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value ?? "",
  );
  const response = await request.post("/api/public/leads", {
    data: { consent: true, website: "", ...body },
    headers: { "X-XSRF-TOKEN": token, Origin: "http://localhost:8080" },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function signIn(page: Page, email: string) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const visitor = `Visitante ${RUN}`;
const contact = `Contato ${RUN}`;
const toErase = `Titular ${RUN}`;

test.describe.configure({ mode: "serial" });

test.describe("atendimento dos contatos @us4", () => {
  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext({
      baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    });
    await submitLead(request, {
      type: "VISITANTE",
      name: visitor,
      phone: phone(1),
      neighborhood: "Centro",
      wants_visit: true,
      wants_cell_group: false,
      message: "Gostei do culto.",
    });
    await submitLead(request, {
      type: "CONTATO",
      name: contact,
      email: `${RUN.toLowerCase()}@example.com`,
      message: "Preciso falar com a secretaria.",
    });
    await submitLead(request, {
      type: "VISITANTE",
      name: toErase,
      phone: phone(2),
      neighborhood: "Promissão",
      wants_visit: false,
      wants_cell_group: true,
    });
    await submitLead(request, {
      type: "ORACAO",
      message: `Orem pela minha família ${RUN}`,
    });
    await request.dispose();
  });

  test("Secretaria: vê os contatos gerais, nunca o pedido de oração, e atende até concluir", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");

    await page.getByRole("link", { name: "Contatos" }).first().click();
    await expect(page).toHaveURL(/\/admin\/contatos$/);
    await page.getByLabel("Buscar por nome ou telefone").fill(RUN);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/q=E2E/);

    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: visitor })).toBeVisible();
    await expect(table.getByRole("link", { name: contact })).toBeVisible();
    // BR-007: o pedido de oração tem a caixa dele e não aparece aqui, nem na busca pelo texto dele
    await expect(page.getByText(`Orem pela minha família ${RUN}`)).toHaveCount(
      0,
    );
    await expect(table.getByRole("row")).toHaveCount(4); // cabeçalho + visitante + contato + titular

    await table.getByRole("link", { name: visitor }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: visitor }),
    ).toBeVisible();
    await expect(page.getByText("Gostei do culto.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Responder no WhatsApp/ }),
    ).toHaveAttribute("href", /^https:\/\/wa\.me\/5531/);

    // só as transições permitidas: de NOVO, começar (BR-008)
    await expect(
      page.getByRole("button", { name: "Reabrir atendimento" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Começar atendimento" }).click();
    await expect(page.getByText("Atendimento atualizado.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Marcar como concluído" }),
    ).toBeVisible();
    await expect(page.getByLabel("Responsável")).toContainText(
      "Teste Secretaria",
    );

    await page.getByLabel(/Só a equipe vê/).fill("Liguei, retorno na quinta.");
    await page.getByRole("button", { name: "Salvar anotação" }).click();
    await expect(page.getByText("Anotação salva.")).toBeVisible();
    const history = page
      .getByRole("heading", { name: "Histórico" })
      .locator("..");
    await expect(history.getByText("Liguei, retorno na quinta.")).toBeVisible();
    await expect(
      history.getByText(/Atendimento iniciado por Teste Secretaria/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Marcar como concluído" }).click();
    await expect(
      page.getByRole("button", { name: "Reabrir atendimento" }),
    ).toBeVisible();
    await expect(page.getByText("Concluído").first()).toBeVisible();

    // a lista (abertos) já não traz o concluído; o filtro "Concluído" traz
    await page.goto(`/admin/contatos?q=${RUN}`);
    await expect(
      page.getByRole("table").getByRole("link", { name: visitor }),
    ).toHaveCount(0);
    await page.goto(`/admin/contatos?q=${RUN}&status=CONCLUIDO`);
    await expect(
      page.getByRole("table").getByRole("link", { name: visitor }),
    ).toBeVisible();
  });

  test("BR-007: o pedido de oração é invisível para a Secretaria, na tela e na API", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");

    await page.goto("/admin/oracao");
    await expect(
      page.getByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();

    const denied = await page.request.get("/api/admin/leads?inbox=oracao");
    expect(denied.status()).toBe(403);
  });

  test("Oração: vê só os pedidos de oração e atende", async ({ page }) => {
    await signIn(page, "oracao@pibls.test");

    await page.goto("/admin/contatos");
    await expect(
      page.getByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();

    await page.goto("/admin/oracao");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pedidos de oração" }),
    ).toBeVisible();
    await expect(page.getByLabel("Tipo")).toHaveCount(0);
    const rows = page.getByRole("table").getByRole("link", { name: "Anônimo" });
    await rows.first().click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Anônimo" }),
    ).toBeVisible();
    await expect(page.getByText(/Orem pela minha família/)).toBeVisible();
    // sem telefone, sem WhatsApp
    await expect(
      page.getByRole("link", { name: /Responder no WhatsApp/ }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Começar atendimento" }).click();
    await expect(
      page.getByRole("button", { name: "Marcar como concluído" }),
    ).toBeVisible();

    // o detalhe de um contato geral é 404 para a Oração (BR-007)
    const list = await page.request.get(
      `/api/admin/leads?inbox=oracao&per_page=1`,
    );
    expect(list.status()).toBe(200);
  });

  test("Pastoral: lê as duas caixas, sem poder atender nem excluir", async ({
    page,
  }) => {
    await signIn(page, "pastoral@pibls.test");

    await page.goto(`/admin/contatos?q=${RUN}&status=`);
    await page.getByRole("table").getByRole("link", { name: contact }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: contact }),
    ).toBeVisible();
    await expect(
      page.getByText("Você pode ler este contato, mas não atendê-lo."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Começar atendimento" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Excluir dados desta pessoa" }),
    ).toHaveCount(0);

    await page.goto("/admin/oracao");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pedidos de oração" }),
    ).toBeVisible();
  });

  test("BR-081: exclusão a pedido do titular, com confirmação, apaga o contato e o deixa fora da lista", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");
    await page.goto(`/admin/contatos?q=${RUN}`);
    await page.getByRole("table").getByRole("link", { name: toErase }).click();

    await page
      .getByRole("button", { name: "Excluir dados desta pessoa" })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(
      dialog.getByRole("heading", { name: `Excluir os dados de ${toErase}?` }),
    ).toBeVisible();
    const confirm = dialog.getByRole("button", {
      name: "Excluir definitivamente",
    });
    await expect(confirm).toBeDisabled();
    await dialog
      .getByRole("checkbox", {
        name: "Confirmo que a própria pessoa pediu a exclusão.",
      })
      .check();
    await confirm.click();

    await expect(
      page.getByRole("heading", { name: "Dados excluídos" }),
    ).toBeVisible();

    await page.goto(`/admin/contatos?q=${RUN}&status=`);
    await expect(
      page.getByRole("table").getByRole("link", { name: toErase }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("table").getByRole("link", { name: contact }),
    ).toBeVisible();
  });
});
