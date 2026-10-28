import { expect, test, type Page } from "@playwright/test";

// US7: a Secretaria mantém configurações e catálogo sem desenvolvedor (T137). Roda contra o build servido com a API de
// verdade (Apache local em http://localhost:8080 ou homologação), com os usuários do LocalDevelopmentSeeder. Todo conteúdo é
// fictício, tem um marcador único por rodada e é desfeito no fim (o aviso volta ao que estava; os itens do catálogo são
// excluídos).
//
// Variáveis: E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend). Sem ela, a suíte é pulada.
//
// No Docker local, rode com E2E_TEST_TIMEOUT=360000 e E2E_EXPECT_TIMEOUT=90000 (cada requisição leva ~10 s).
// Entre rodadas seguidas: `docker compose exec app php artisan cache:clear` (limite de logins).

const PASSWORD = process.env.E2E_USERS_PASSWORD;

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

const RUN = `E2E${Date.now().toString(36)}`;
const NOTICE = `Aviso ${RUN}: Ceia neste domingo.`;
const ACTIVITY = `Culto ${RUN}`;
const GROUP = `Grupo ${RUN}`;
const CELL = `Célula ${RUN}`;
const SECRET_ADDRESS = `Rua Secreta ${RUN}, 77`;
const SECRET_EMAIL = `${RUN.toLowerCase()}@interno.example.com`;

async function signIn(page: Page, email: string) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function openSettings(page: Page) {
  await page.goto("/admin/configuracoes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Configurações do site" }),
  ).toBeVisible();
  await expect(page.getByLabel("Atividade do horário 1")).not.toHaveValue("");
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    page.getByText("Alterações salvas. O site atualiza em seguida."),
  ).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Configurações do site @us7", () => {
  test("só quem tem settings.write e ministerios.write entra nas duas telas", async ({
    page,
  }) => {
    await signIn(page, "tesouraria@pibls.test");

    for (const path of ["/admin/configuracoes", "/admin/ministerios"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", {
          name: "Você não tem acesso a esta área",
        }),
      ).toBeVisible();
    }
    expect((await page.request.get("/api/admin/settings")).status()).toBe(403);
    expect((await page.request.get("/api/admin/ministries")).status()).toBe(
      403,
    );
  });

  test("o aviso da Ceia e um horário novo aparecem na página inicial, e depois voltam ao que estavam", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");
    await openSettings(page);

    // Liga o aviso da Ceia com um texto de teste e acrescenta um horário
    const supperText = page.locator("#supper-text");
    const originalText = await supperText.inputValue();
    const supperSwitch = page.getByRole("switch", { name: "Aviso da Ceia" });
    const wasOn = (await supperSwitch.getAttribute("aria-checked")) === "true";

    await supperText.fill(NOTICE);
    if (!wasOn) await supperSwitch.click();
    await page.getByRole("button", { name: "Adicionar horário" }).click();
    const rows = await page.getByLabel(/^Atividade do horário \d+$/).count();
    await page.getByLabel(`Atividade do horário ${rows}`).fill(ACTIVITY);
    await page.getByLabel(`Hora do horário ${rows}`).fill("21:15");
    await save(page);

    // A página pública lê o snapshot gerado depois de salvar (até 1 minuto)
    await expect(async () => {
      await page.goto("/");
      await expect(page.getByText(NOTICE)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(ACTIVITY)).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 90_000, intervals: [3000] });

    // Desfaz
    await openSettings(page);
    await page.locator("#supper-text").fill(originalText);
    if (!wasOn)
      await page.getByRole("switch", { name: "Aviso da Ceia" }).click();
    await page.getByRole("button", { name: `Remover ${ACTIVITY}` }).click();
    await save(page);
  });

  test("valida no navegador: horário sem hora e e-mail inválido não saem da tela", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");
    await openSettings(page);

    await page.getByRole("button", { name: "Adicionar horário" }).click();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByText("Informe o horário no formato HH:MM, por exemplo 10:10."),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Adicionar e-mail para Fale conosco" })
      .click();
    await page.getByLabel("Novo e-mail para Fale conosco").fill("sem-arroba");
    await page.getByRole("button", { name: "Incluir" }).click();
    await expect(
      page.getByText("Informe até 10 e-mails válidos."),
    ).toBeVisible();
  });
});

test.describe("Catálogo de ministérios, grupos e células @us7", () => {
  test("cria, desativa, reativa e exclui um grupo; ele aparece e some em /grupos", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");
    await page.goto("/admin/ministerios?tipo=grupos");
    await page.getByRole("button", { name: "Novo grupo" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Novo grupo" }),
    ).toBeVisible();

    // BR-049: grupo sem dia e horário não passa
    await page.getByLabel("Nome", { exact: true }).fill(GROUP);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Informe dia e horário.")).toBeVisible();

    await page.getByLabel("Dia e hora").fill("Sábados, 20h");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: `Editar ${GROUP}` }),
    ).toBeVisible();

    await expect(async () => {
      await page.goto("/grupos");
      await expect(page.getByText(GROUP)).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 90_000, intervals: [3000] });

    // Desativa: some do site
    await page.goto("/admin/ministerios?tipo=grupos");
    await page
      .getByRole("switch", { name: `Mostrar ${GROUP} no site` })
      .click();
    await expect(
      page.getByRole("switch", { name: `Mostrar ${GROUP} no site` }),
    ).not.toBeChecked();
    await expect(page.getByText("Oculto no site")).toBeVisible();
    await expect(async () => {
      await page.goto("/grupos");
      await expect(page.getByText(GROUP)).toHaveCount(0, { timeout: 5000 });
    }).toPass({ timeout: 90_000, intervals: [3000] });

    // Exclui
    await page.goto("/admin/ministerios?tipo=grupos");
    await page.getByRole("button", { name: new RegExp(`^${GROUP}`) }).click();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Excluir" })
      .click();
    await expect(
      page.getByRole("button", { name: new RegExp(`^${GROUP}`) }),
    ).toHaveCount(0);
  });

  test("BR-048 o endereço e o e-mail internos de uma célula nunca saem na API pública", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");
    await page.goto("/admin/ministerios?tipo=celulas");
    await page.getByRole("button", { name: "Nova célula" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(CELL);
    await page.getByLabel("Bairro").fill("Promissão");
    await page.getByLabel("Dia e hora").fill("Terças, 20h");
    await page.getByLabel("Endereço da reunião").fill(SECRET_ADDRESS);
    await page.getByLabel("E-mail interno").fill(SECRET_EMAIL);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: `Editar ${CELL}` }),
    ).toBeVisible();

    // O painel mostra os dois campos; a API pública, nenhum
    await expect(page.getByLabel("Endereço da reunião")).toHaveValue(
      SECRET_ADDRESS,
    );
    await expect(async () => {
      const pub = await page.request.get("/api/public/ministries");
      const body = await pub.text();
      expect(body).toContain(CELL);
      expect(body).not.toContain(SECRET_ADDRESS);
      expect(body).not.toContain(SECRET_EMAIL);
      expect(body).not.toContain("private_address");
      expect(body).not.toContain("contact_email");
      const snapshot = await (
        await page.request.get("/data/ministries.json")
      ).text();
      expect(snapshot).not.toContain(SECRET_ADDRESS);
      expect(snapshot).not.toContain(SECRET_EMAIL);
    }).toPass({ timeout: 90_000, intervals: [3000] });

    // Limpa
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Excluir" })
      .click();
    await expect(
      page.getByRole("button", { name: new RegExp(`^${CELL}`) }),
    ).toHaveCount(0);
  });
});
