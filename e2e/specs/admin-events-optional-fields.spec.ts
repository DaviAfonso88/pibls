import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// ADR-025: evento sem ministério, sem banner e com o formulário sem nome, telefone e e-mail, de ponta a ponta. Roda
// contra o build servido com a API de verdade (Apache local em http://localhost:8080 ou homologação), com a Comunicação
// e o Líder de Ministério do LocalDevelopmentSeeder. Dados fictícios. Com `FEATURE_EVENTS` desligada, a suíte é pulada.
// O prefixo `admin-` põe a suíte no projeto `painel-desktop`: a lista de inscritos é tabela só no desktop.
//
// Variáveis: E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend). Faz 2 logins e 1 inscrição. No Docker local, rode
// com E2E_TEST_TIMEOUT=240000 e E2E_EXPECT_TIMEOUT=45000.

const PASSWORD = process.env.E2E_USERS_PASSWORD;

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

const RUN = `E2E${Date.now().toString(36)}`;
const TITLE = `${RUN} Café geral`;
const SLUG = `${RUN.toLowerCase()}-cafe-geral`;

/** O valor de `<input type="datetime-local">` na hora de Brasília, como o painel espera. */
function brasiliaLocal(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" ", "T");
}

async function signIn(page: Page, email: string) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("ADR-025 ministério opcional e campos padrão por evento @us10", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;
  let eventId = 0;

  test.beforeAll(async ({ browser, request }) => {
    const probe = await request.get("/api/public/events");
    test.skip(
      probe.status() === 404,
      "Eventos (R2) estão desligados (FEATURE_EVENTS).",
    );

    page = await browser.newPage();
    await signIn(page, "comunicacao@pibls.test");
  });

  test.afterAll(async () => {
    if (page === undefined) return;
    if (eventId > 0) {
      await page.request.get("/sanctum/csrf-cookie");
      const state = await page.request.storageState();
      const token = decodeURIComponent(
        state.cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value ??
          "",
      );
      // A inscrição foi cancelada no último teste; sem inscritos, o evento de teste se exclui (BR-028)
      await page.request.delete(`/api/admin/events/${eventId}`, {
        headers: { "X-XSRF-TOKEN": token, Origin: "http://localhost:8080" },
      });
    }
    await page.close();
  });

  test("o painel cria o evento sem ministério, sem banner e sem os campos padrão", async () => {
    await page.goto("/admin/eventos/novo");
    await page.getByRole("textbox", { name: "Nome" }).fill(TITLE);
    await expect(
      page.getByRole("textbox", { name: "Endereço da página" }),
    ).toHaveValue(SLUG);

    const ministry = page.getByRole("combobox", {
      name: /^Ministério responsável/,
    });
    await expect(ministry).toHaveValue("");
    await expect(ministry.getByRole("option").first()).toHaveText(
      "Sem ministério responsável",
    );

    // Começa daqui a 2 horas: fica no topo dos próximos eventos e com as inscrições abertas
    await page
      .getByLabel("Começa")
      .fill(brasiliaLocal(new Date(Date.now() + 2 * 3_600_000)));
    await page.getByRole("textbox", { name: "Local" }).fill("Salão social");
    await page.getByRole("textbox", { name: "Descrição" }).click();
    await page.keyboard.type("Café da manhã para toda a igreja.");

    const fixed = page.getByRole("group", {
      name: "Campos padrão do formulário",
    });
    for (const name of [/Nome completo/, /Telefone/, /E-mail/]) {
      const toggle = fixed.getByRole("switch", { name });
      await expect(toggle).toBeChecked();
      await toggle.uncheck();
    }
    await expect(
      page.getByText(/não consegue barrar a inscrição repetida/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Salvar e publicar" }).click();
    await expect(page).toHaveURL(/\/admin\/eventos\/\d+$/);
    eventId = Number(new URL(page.url()).pathname.split("/").pop());

    // Reaberto do servidor, o evento continua sem ministério e com as chaves desligadas. Abrir a edição direto pelo
    // endereço quebrava a tela ("Algo deu errado"): o editor de texto usava uma instância já destruída
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Descrição" }),
    ).toContainText("Café da manhã para toda a igreja.");
    await expect(
      page.getByRole("combobox", { name: /^Ministério responsável/ }),
    ).toHaveValue("");
    await expect(
      fixed.getByRole("switch", { name: /Telefone/ }),
    ).not.toBeChecked();
  });

  test("o cartão público troca o banner por uma faixa baixa", async ({
    page: visitor,
  }) => {
    await visitor.goto("/eventos");
    const card = visitor
      .getByRole("listitem")
      .filter({ has: visitor.getByRole("heading", { name: TITLE }) });
    const placeholder = card.getByRole("img", { name: "Evento sem imagem" });

    await expect(placeholder).toBeVisible();
    const box = await placeholder.boundingBox();
    expect(box?.height ?? 0).toBeLessThanOrEqual(64);
  });

  test("a inscrição não pede nome, telefone nem e-mail, e a confirmação não fala deles", async ({
    page: visitor,
  }) => {
    await visitor.goto(`/eventos/${SLUG}`);
    await expect(
      visitor.getByRole("heading", { name: "Inscrição" }),
    ).toBeVisible();
    await expect(visitor.getByLabel("Nome completo")).toHaveCount(0);
    await expect(visitor.getByLabel("Telefone", { exact: true })).toHaveCount(
      0,
    );
    await expect(visitor.getByLabel(/^E-mail/)).toHaveCount(0);

    const results = await new AxeBuilder({ page: visitor })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    await visitor.getByRole("checkbox", { name: /Li e concordo/ }).click();
    await visitor.getByRole("button", { name: "Confirmar inscrição" }).click();

    const done = visitor.getByRole("status").filter({
      has: visitor.getByRole("heading", { name: "Inscrição confirmada!" }),
    });
    await expect(done).toBeVisible();
    await expect(done).toContainText(TITLE);
    await expect(done).not.toContainText("Participante");
    await expect(done).not.toContainText("e-mail");
  });

  test("o líder (.own) vê e abre o evento geral e os inscritos dele", async ({
    browser,
  }) => {
    const leader = await browser.newPage();
    await signIn(leader, "lider@pibls.test");

    expect(
      (await leader.request.get(`/api/admin/events/${eventId}`)).status(),
    ).toBe(200);
    await leader.goto("/admin/eventos");
    await leader
      .getByRole("link", { name: `Editar o evento ${TITLE}` })
      .click();
    await expect(leader).toHaveURL(new RegExp(`/admin/eventos/${eventId}$`));

    // O líder pode deixá-lo geral ou trazê-lo para o próprio ministério, nunca para outro
    const ministry = leader.getByRole("combobox", {
      name: /^Ministério responsável/,
    });
    await expect(ministry).toHaveValue("");
    await expect(ministry.getByRole("option")).toHaveCount(2);

    await leader.goto(`/admin/eventos/${eventId}/inscritos`);
    await expect(
      leader
        .getByRole("table", { name: "Lista de inscrições" })
        .getByRole("row"),
    ).toHaveCount(2);
    await leader.close();
  });

  test("a Comunicação vê a inscrição sem nome e a cancela pela data", async () => {
    await page.goto(`/admin/eventos/${eventId}/inscritos`);
    const table = page.getByRole("table", { name: "Lista de inscrições" });
    await expect(table.getByRole("row")).toHaveCount(2);

    await table
      .getByRole("button", { name: /^Cancelar a inscrição feita em / })
      .click();
    const dialog = page.getByRole("alertdialog", {
      name: "Cancelar esta inscrição?",
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar inscrição" }).click();

    // Evento sem limite de vagas: o aviso não fala de vaga liberada
    await expect(
      page.getByRole("status").filter({ hasText: "Inscrição cancelada." }),
    ).toBeVisible();
    await expect(page.getByText("Ninguém se inscreveu ainda.")).toBeVisible();
  });
});
