import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, signIn } from "./helpers";

// QA-01: a jornada de ponta a ponta de quem visita a igreja, só pela interface. Uma pessoa preenche a Ficha de Visitante no site;
// a Secretaria entra no painel, acha o contato pela busca, começa o atendimento, deixa uma anotação e conclui. Um pedido de oração
// anônimo, feito no mesmo site, chega à caixa da Oração e nunca à da Secretaria (BR-007).
//
// Limites: 10 envios por 10 min por IP (esta suíte envia 2) e 20 logins por 15 min por IP (faz 2). Entre rodadas seguidas,
// `docker compose exec app php artisan cache:clear`. No Docker local: E2E_TEST_TIMEOUT=240000, E2E_EXPECT_TIMEOUT=45000.

test.skip(PASSWORD === undefined, "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).");

const RUN = `Jornada${Date.now().toString(36)}`;
/** Celular fictício com DDD 31 (9 + 8 dígitos, o primeiro de 2 a 9), diferente a cada rodada. */
const digits = String(2 + Math.floor(Math.random() * 8)) + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const PHONE_MASKED = `(31) 9${digits.slice(0, 4)}-${digits.slice(4)}`;

const consent = (page: Page) => page.getByRole("checkbox", { name: /Li e concordo/ });

test.describe.configure({ mode: "serial" });

test.describe("jornada do visitante @us2 @us4", () => {
  test("a pessoa envia a Ficha de Visitante, e a Secretaria atende até concluir", async ({ page, browser }) => {
    test.setTimeout(Number(process.env.E2E_TEST_TIMEOUT ?? 30_000) * 4);

    // 1. No site, como visitante
    await page.goto("/sou-visitante");
    await page.getByLabel("Nome", { exact: true }).fill(RUN);
    await page.getByLabel("WhatsApp", { exact: true }).fill(PHONE_MASKED);
    await page.getByLabel("Bairro onde mora").fill("Centro");
    await page.getByRole("group", { name: "Deseja receber uma visita?" }).getByLabel("Sim").check();
    await page.getByRole("group", { name: "Deseja conhecer uma Célula de CL?" }).getByLabel("Não").check();
    await consent(page).check();
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("heading", { name: "Recebemos seu contato!" })).toBeVisible();

    // 2. No painel, como Secretaria (outro contexto: a sessão do visitante não existe)
    const staffPage = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 800 } })).newPage();
    await signIn(staffPage, "secretaria@pibls.test");
    await staffPage.goto(`/admin/contatos?q=${RUN}`);
    const link = staffPage.getByRole("table").getByRole("link", { name: RUN });
    await expect(link).toBeVisible();

    await link.click();
    await expect(staffPage.getByRole("heading", { level: 1, name: RUN })).toBeVisible();
    await staffPage.getByRole("button", { name: "Começar atendimento" }).click();
    await expect(staffPage.getByText("Atendimento atualizado.")).toBeVisible();
    await staffPage.getByLabel(/Só a equipe vê/).fill("Ligamos e combinamos a visita no domingo.");
    await staffPage.getByRole("button", { name: "Salvar anotação" }).click();
    await expect(staffPage.getByText("Anotação salva.")).toBeVisible();
    await staffPage.getByRole("button", { name: "Marcar como concluído" }).click();
    await expect(staffPage.getByRole("button", { name: "Reabrir atendimento" })).toBeVisible();

    // 3. Concluído sai da lista de abertos e continua no filtro "Concluído"
    await staffPage.goto(`/admin/contatos?q=${RUN}`);
    await expect(staffPage.getByRole("table").getByRole("link", { name: RUN })).toHaveCount(0);
    await staffPage.goto(`/admin/contatos?q=${RUN}&status=CONCLUIDO`);
    await expect(staffPage.getByRole("table").getByRole("link", { name: RUN })).toBeVisible();
    await staffPage.context().close();
  });

  test("um pedido de oração anônimo chega à Oração e não à Secretaria", async ({ page, browser }) => {
    test.setTimeout(Number(process.env.E2E_TEST_TIMEOUT ?? 30_000) * 4);
    const request = `Orem por nós ${RUN}`;

    await page.goto("/pedido-de-oracao");
    await page.getByLabel("Seu pedido").fill(request);
    await consent(page).check();
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(page.getByRole("heading", { name: "Recebemos seu pedido" })).toBeVisible();

    const prayer = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 800 } })).newPage();
    await signIn(prayer, "oracao@pibls.test");
    await prayer.goto("/admin/oracao");
    // A lista mostra só nome (aqui "Anônimo") e data, sem o texto: o mais recente é o primeiro da tabela
    await prayer.getByRole("table").getByRole("link", { name: "Anônimo" }).first().click();
    await expect(prayer.getByText(request)).toBeVisible();
    const prayerPath = new URL(prayer.url()).pathname;
    expect(prayerPath).toMatch(/^\/admin\/oracao\/\d+$/);
    await prayer.context().close();

    // A Secretaria não vê o pedido na caixa de contatos nem abre a tela dele (BR-007, BR-076)
    const secretary = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 800 } })).newPage();
    await signIn(secretary, "secretaria@pibls.test");
    await secretary.goto("/admin/contatos?status=");
    await expect(secretary.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(secretary.getByText(request)).toHaveCount(0);
    await secretary.goto(prayerPath);
    await expect(secretary.getByRole("heading", { level: 1, name: "Você não tem acesso a esta área" })).toBeVisible();
    await expect(secretary.getByText(request)).toHaveCount(0);
    await secretary.context().close();
  });
});
