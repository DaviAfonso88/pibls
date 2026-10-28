import { expect, test, type Page } from "@playwright/test";

// US6: o PIX na página pública e as três situações do painel da Tesouraria (T126). Roda contra o build servido com a API
// de verdade (Apache local em http://localhost:8080 ou homologação), com os usuários do LocalDevelopmentSeeder.
//
// Variáveis:
//   E2E_USERS_PASSWORD         a TEST_USERS_PASSWORD do backend. Sem ela, a suíte é pulada.
//   E2E_PIX_ALERT_CONFIGURED   "true" (padrão) quando o servidor tem PIX_ALERT_RECIPIENTS preenchido: roda a senha errada e a
//                              alteração com sucesso. "false" quando está vazio: roda só a recusa da BR-063.
//
// A alteração com sucesso grava a chave e o favorecido de teste e, no fim, devolve os valores que estavam. O QR Code não tem
// como voltar a "nenhum" (a tela exige um); se não havia, o QR de teste (um PNG de 1 pixel) fica. Em ambiente de teste, ok.
// Limite: 20 logins por 15 min por IP. No Docker local, rode com E2E_TEST_TIMEOUT=240000 e E2E_EXPECT_TIMEOUT=45000.

const PASSWORD = process.env.E2E_USERS_PASSWORD;
const ALERT_CONFIGURED =
  (process.env.E2E_PIX_ALERT_CONFIGURED ?? "true") !== "false";

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

/** CNPJ válido, diferente do da igreja, para a alteração de teste. */
const TEST_CNPJ = "11222333000181";
const TEST_CNPJ_MASKED = "11.222.333/0001-81";
const TEST_BENEFICIARY = "Favorecido de teste E2E";

/** Um PNG de 1 pixel gerado pelo próprio GD do servidor (um PNG só com assinatura válida é recusado na decodificação). */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAADElEQVQImWNgYGAAAAAEAAGjChXjAAAAAElFTkSuQmCC",
  "base64",
);

async function signIn(page: Page, email: string) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Preenche o formulário do PIX e abre o diálogo da senha. */
async function fillPix(
  page: Page,
  values: { key: string; beneficiary: string; qr?: boolean },
) {
  const key = page.getByLabel("Chave", { exact: true });
  await key.fill("");
  await key.pressSequentially(values.key);
  await page.getByLabel("Nome do favorecido").fill(values.beneficiary);
  if (values.qr) {
    await page
      .locator("#qr")
      .setInputFiles({
        name: "qr.png",
        mimeType: "image/png",
        buffer: PNG_1PX,
      });
  }
  await page.getByRole("button", { name: "Salvar alteração" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirme sua senha" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("PIX público @us6", () => {
  test("a página Contribua mostra a chave, o favorecido e copia a chave sem máscara", async ({
    page,
    context,
    request,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const settings = await (await request.get("/api/public/settings")).json();
    const pix = settings.data.pix as {
      pix_key: string;
      beneficiary_name: string;
      qr_image_url: string | null;
    };

    await page.goto("/contribua");
    await expect(
      page.getByRole("heading", { level: 1, name: "Contribua" }),
    ).toBeVisible();
    await expect(
      page.getByText(pix.beneficiary_name, { exact: true }).first(),
    ).toBeVisible();
    const masked = `${pix.pix_key.slice(0, 2)}.${pix.pix_key.slice(2, 5)}.${pix.pix_key.slice(5, 8)}/${pix.pix_key.slice(8, 12)}-${pix.pix_key.slice(12)}`;
    await expect(page.getByText(masked)).toBeVisible();
    if (pix.qr_image_url) {
      await expect(page.getByAltText("QR Code do PIX da igreja")).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { level: 2, name: "Como contribuir" }),
    ).toBeVisible();
    await expect(page.getByText("2 Coríntios 9:7")).toBeVisible();

    await page.getByRole("button", { name: "Copiar chave" }).click();
    await expect(
      page.getByRole("button", { name: "Chave copiada!" }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      pix.pix_key,
    );
  });

  test("sem a Clipboard API a página manda tocar e segurar para copiar", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
    });
    await page.goto("/contribua");

    await page.getByRole("button", { name: "Copiar chave" }).click();

    await expect(
      page.getByText(
        "Não foi possível copiar. Toque e segure a chave para copiar.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Chave copiada!" }),
    ).toHaveCount(0);
  });
});

test.describe("PIX no painel @us6", () => {
  test("BR-076 só a Tesouraria acessa /admin/pix", async ({ page }) => {
    await signIn(page, "comunicacao@pibls.test");

    await page.goto("/admin/pix");
    await expect(
      page.getByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();

    expect((await page.request.get("/api/admin/settings/pix")).status()).toBe(
      403,
    );
  });

  test("a Tesouraria vê os dados vigentes e o aviso de segurança", async ({
    page,
  }) => {
    await signIn(page, "tesouraria@pibls.test");
    await page.goto("/admin/pix");

    await expect(
      page.getByRole("heading", { level: 1, name: "Chave PIX" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Para mudar a chave, você confirma sua senha/),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "No site agora" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Alterações" }),
    ).toBeVisible();
  });

  test.describe("com PIX_ALERT_RECIPIENTS configurado", () => {
    test.skip(
      !ALERT_CONFIGURED,
      "O servidor está sem destinatários do alerta (E2E_PIX_ALERT_CONFIGURED=false).",
    );

    test("BR-060 com a senha errada nada muda", async ({ page, request }) => {
      await signIn(page, "tesouraria@pibls.test");
      await page.goto("/admin/pix");
      await expect(page.getByLabel("Chave", { exact: true })).not.toHaveValue(
        "",
      );
      const before = (await (await request.get("/api/public/settings")).json())
        .data.pix;

      const dialog = await fillPix(page, {
        key: TEST_CNPJ,
        beneficiary: TEST_BENEFICIARY,
        qr: true,
      });
      await dialog.getByLabel("Senha").fill("senha-errada-e2e");
      await dialog.getByRole("button", { name: "Confirmar e salvar" }).click();

      await expect(
        dialog.getByText("Senha incorreta. Os dados PIX não foram alterados."),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Cancelar" }).click();

      const after = (await (await request.get("/api/public/settings")).json())
        .data.pix;
      expect(after).toEqual(before);
    });

    test("com a senha certa a página Contribua mostra o novo valor, e depois voltamos ao que estava", async ({
      page,
      request,
    }) => {
      await signIn(page, "tesouraria@pibls.test");
      await page.goto("/admin/pix");
      const keyField = page.getByLabel("Chave", { exact: true });
      await expect(keyField).not.toHaveValue("");
      const originalKey = await keyField.inputValue();
      const originalBeneficiary = await page
        .getByLabel("Nome do favorecido")
        .inputValue();

      // Altera
      let dialog = await fillPix(page, {
        key: TEST_CNPJ,
        beneficiary: TEST_BENEFICIARY,
        qr: true,
      });
      await dialog.getByLabel("Senha").fill(PASSWORD ?? "");
      await dialog.getByRole("button", { name: "Confirmar e salvar" }).click();
      await expect(page.getByText("Chave PIX atualizada.")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // O histórico registra quem alterou
      const history = page.getByRole("region", { name: "Alterações" });
      await expect(
        history.getByText(/Alterou .* por Teste Tesouraria/).first(),
      ).toBeVisible();

      // A API e a página pública mostram o novo valor
      const pix = (await (await request.get("/api/public/settings")).json())
        .data.pix;
      expect(pix.pix_key).toBe(TEST_CNPJ);
      expect(pix.beneficiary_name).toBe(TEST_BENEFICIARY);
      await page.goto("/contribua");
      await expect(page.getByText(TEST_CNPJ_MASKED)).toBeVisible();
      await expect(
        page.getByText(TEST_BENEFICIARY, { exact: true }).first(),
      ).toBeVisible();

      // Devolve os valores de antes (o QR de teste fica)
      await page.goto("/admin/pix");
      await expect(page.getByLabel("Chave", { exact: true })).toHaveValue(
        TEST_CNPJ_MASKED,
      );
      dialog = await fillPix(page, {
        key: originalKey,
        beneficiary: originalBeneficiary,
      });
      await dialog.getByLabel("Senha").fill(PASSWORD ?? "");
      await dialog.getByRole("button", { name: "Confirmar e salvar" }).click();
      await expect(page.getByText("Chave PIX atualizada.")).toBeVisible();

      const restored = (
        await (await request.get("/api/public/settings")).json()
      ).data.pix;
      expect(restored.pix_key).toBe(originalKey.replace(/\D/g, ""));
      expect(restored.beneficiary_name).toBe(originalBeneficiary);
    });
  });

  test.describe("sem PIX_ALERT_RECIPIENTS", () => {
    test.skip(
      ALERT_CONFIGURED,
      "O servidor tem destinatários do alerta (E2E_PIX_ALERT_CONFIGURED=true).",
    );

    test("BR-063 a alteração é recusada e nada muda", async ({
      page,
      request,
    }) => {
      await signIn(page, "tesouraria@pibls.test");
      await page.goto("/admin/pix");
      await expect(page.getByLabel("Chave", { exact: true })).not.toHaveValue(
        "",
      );
      const before = (await (await request.get("/api/public/settings")).json())
        .data.pix;

      const dialog = await fillPix(page, {
        key: TEST_CNPJ,
        beneficiary: TEST_BENEFICIARY,
        qr: true,
      });
      await dialog.getByLabel("Senha").fill(PASSWORD ?? "");
      await dialog.getByRole("button", { name: "Confirmar e salvar" }).click();

      await expect(
        page.getByText(
          /Alteração bloqueada: os destinatários do alerta de PIX não estão configurados/,
        ),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(
        (await (await request.get("/api/public/settings")).json()).data.pix,
      ).toEqual(before);
    });
  });
});
