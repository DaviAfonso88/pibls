import { expect, test, type Page } from "@playwright/test";

// US5: a Comunicação publica boletins e mensagens da Palavra Viva (T114). Roda contra o build servido com a API de
// verdade (Apache local em http://localhost:8080 ou homologação), com os usuários do LocalDevelopmentSeeder. Todo conteúdo
// é fictício, tem um marcador único por rodada e é excluído no fim (o painel faz exclusão lógica).
//
// Variáveis: E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend). Sem ela, a suíte é pulada.
//
// No Docker local, rode com E2E_TEST_TIMEOUT=360000 e E2E_EXPECT_TIMEOUT=60000 (cada requisição leva ~10 s e o PDF de 10 MB
// demora para subir). Entre rodadas seguidas: `docker compose exec app php artisan cache:clear` (limite de logins).

const PASSWORD = process.env.E2E_USERS_PASSWORD;

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

const RUN = `E2E${Date.now().toString(36)}`;
const EDITION_BASE = Number(String(Date.now()).slice(-6));
const TEN_MB = 10 * 1024 * 1024;

const published = { edition: EDITION_BASE, title: `Boletim ${RUN}` };
const scheduled = {
  edition: EDITION_BASE + 1,
  title: `Boletim agendado ${RUN}`,
};
const message = {
  title: `Mensagem ${RUN}`,
  slug: `mensagem-${RUN.toLowerCase()}`,
};
const futureMessage = {
  title: `Mensagem futura ${RUN}`,
  slug: `mensagem-futura-${RUN.toLowerCase()}`,
};
const draftMessage = {
  title: `Rascunho ${RUN}`,
  slug: `rascunho-${RUN.toLowerCase()}`,
};

/** Um PDF verdadeiro (assinatura `%PDF-` e fim `%%EOF`) com o tamanho pedido: o servidor confere o conteúdo (BR-041). */
function pdfOf(bytes: number): Buffer {
  const head = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";
  const tail = "trailer\n<< /Root 1 0 R >>\n%%EOF\n";
  const padding = Math.max(0, bytes - head.length - tail.length - 4);

  return Buffer.from(`${head}% ${"x".repeat(padding)}\n${tail}`);
}

async function signIn(page: Page, email: string) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Cola HTML no editor, como o navegador faria ao colar do Word ou do WhatsApp. */
async function pasteHtml(page: Page, html: string) {
  await page
    .getByRole("textbox", { name: "Texto da mensagem" })
    .evaluate((element, markup) => {
      const data = new DataTransfer();
      data.setData("text/html", markup);
      data.setData("text/plain", markup.replace(/<[^>]+>/g, ""));
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, html);
}

/** `AAAA-MM-DDTHH:MM` de amanhã às 20h, na hora de Brasília (o campo `datetime-local`). */
function tomorrowAt20h(): string {
  const date = new Date(Date.now() + 36 * 60 * 60 * 1000);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return `${day}T20:00`;
}

async function fillBulletin(
  page: Page,
  data: { edition: number; title: string },
  pdf: { name: string; buffer: Buffer },
) {
  await page.goto("/admin/boletins/novo");
  await page.getByLabel("Edição nº").fill(String(data.edition));
  await page.getByLabel("Título").fill(data.title);
  await page.getByLabel(/Resumo/).fill(`Resumo de ${data.title}.`);
  await page.locator("#pdf").setInputFiles({
    name: pdf.name,
    mimeType: "application/pdf",
    buffer: pdf.buffer,
  });
}

async function deleteBulletinByTitle(page: Page, title: string) {
  await page.goto("/admin/boletins");
  await page
    .getByRole("table")
    .getByRole("row", { name: new RegExp(title) })
    .getByRole("link", { name: /^Editar/ })
    .click();
  await page.getByRole("button", { name: "Excluir boletim" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Excluir boletim" })
    .click();
  await expect(page).toHaveURL(/\/admin\/boletins$/);
  await expect(page.getByRole("table").getByText(title)).toHaveCount(0);
}

async function deletePostByTitle(page: Page, title: string) {
  await page.goto("/admin/palavra-viva");
  await page
    .getByRole("table")
    .getByRole("row", { name: new RegExp(title) })
    .getByRole("link", { name: /^Editar/ })
    .click();
  await page.getByRole("button", { name: "Excluir mensagem" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Excluir mensagem" })
    .click();
  await expect(page).toHaveURL(/\/admin\/palavra-viva$/);
  await expect(page.getByRole("table").getByText(title)).toHaveCount(0);
}

test.describe.configure({ mode: "serial" });

test.describe("boletins e Palavra Viva @us5", () => {
  test("Comunicação publica um boletim com PDF de 10 MB e o público lê e baixa", async ({
    page,
  }) => {
    await signIn(page, "comunicacao@pibls.test");
    await fillBulletin(page, published, {
      name: `boletim-${RUN}.pdf`,
      buffer: pdfOf(TEN_MB - 200),
    });

    await page.getByRole("button", { name: "Publicar agora" }).click();
    await expect(page.getByText("Boletim publicado!")).toBeVisible();

    // O público vê o boletim na lista, sem login
    await page.goto(`/boletins?ano=${new Date().getFullYear()}`);
    const card = page
      .getByRole("listitem")
      .filter({ hasText: published.title });
    await expect(card).toBeVisible();
    await expect(card.getByText(`Resumo de ${published.title}.`)).toBeVisible();

    // "Ler boletim" abre o PDF em outra aba
    const read = card.getByRole("link", { name: /Ler boletim/ });
    await expect(read).toHaveAttribute("target", "_blank");
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      read.click(),
    ]);
    await popup.close();

    // O arquivo é servido pelo Apache, com o tipo certo e o tamanho que foi enviado
    const href = (await read.getAttribute("href")) ?? "";
    expect(href).toMatch(/\/uploads\/boletins\/\d{4}\/[0-9a-f]{32}\.pdf$/);
    const file = await page.request.get(href);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toContain("application/pdf");
    expect((await file.body()).length).toBeGreaterThan(TEN_MB - 400);

    // "Baixar PDF" baixa o arquivo
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      card.getByRole("link", { name: /Baixar PDF/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("BR-041 um PDF falso é recusado e nenhum boletim é criado", async ({
    page,
  }) => {
    await signIn(page, "comunicacao@pibls.test");
    const fake = { edition: EDITION_BASE + 2, title: `Boletim falso ${RUN}` };
    await fillBulletin(page, fake, {
      name: "falso.pdf",
      buffer: Buffer.from("isto é um texto, não um PDF\n"),
    });

    await page.getByRole("button", { name: "Publicar agora" }).click();

    const group = page.getByRole("group", { name: "Arquivo do boletim (PDF)" });
    await expect(
      group.getByText("O arquivo precisa ser um PDF."),
    ).toBeVisible();
    await expect(page.getByText("Boletim publicado!")).toHaveCount(0);

    await page.goto("/admin/boletins");
    await expect(page.getByRole("table").getByText(fake.title)).toHaveCount(0);
  });

  test("BR-040 a mesma edição não se repete", async ({ page }) => {
    await signIn(page, "comunicacao@pibls.test");
    await fillBulletin(
      page,
      { edition: published.edition, title: `Duplicado ${RUN}` },
      {
        name: "outro.pdf",
        buffer: pdfOf(20_000),
      },
    );

    await page.getByRole("button", { name: "Publicar agora" }).click();

    await expect(
      page.getByText(`Já existe um boletim com a edição ${published.edition}.`),
    ).toBeVisible();
  });

  test("BR-042 um boletim agendado fica invisível no site e aparece como Agendado no painel", async ({
    page,
  }) => {
    await signIn(page, "comunicacao@pibls.test");
    await fillBulletin(page, scheduled, {
      name: `agendado-${RUN}.pdf`,
      buffer: pdfOf(50_000),
    });

    await page.getByRole("radio", { name: "Agendar para depois" }).check();
    await page.getByLabel("Data e hora").fill(tomorrowAt20h());
    await page.getByRole("button", { name: "Agendar publicação" }).click();
    await expect(page.getByText(/Boletim agendado para/)).toBeVisible();

    await page.goto("/admin/boletins");
    const row = page
      .getByRole("table")
      .getByRole("row", { name: new RegExp(scheduled.title) });
    await expect(row.getByText("Agendado", { exact: true })).toBeVisible();

    await page.goto(`/boletins?ano=${new Date().getFullYear()}`);
    await expect(
      page.getByRole("listitem").filter({ hasText: published.title }),
    ).toBeVisible();
    await expect(page.getByText(scheduled.title)).toHaveCount(0);

    const api = await page.request.get("/api/public/bulletins?per_page=100");
    expect(await api.text()).not.toContain(scheduled.title);
  });

  test("BR-046 uma mensagem com <script> colado sai sanitizada, com o aviso, e a página tem meta para o WhatsApp", async ({
    page,
    request,
  }) => {
    await signIn(page, "comunicacao@pibls.test");
    await page.goto("/admin/palavra-viva/nova");
    await page.getByRole("textbox", { name: "Título" }).fill(message.title);
    await expect(page.getByLabel("Endereço da página")).toHaveValue(
      message.slug,
    );
    await page.getByLabel(/Pregador/).fill("Pr. Fulano");

    await pasteHtml(
      page,
      '<p>Texto <strong>seguro</strong> da mensagem.</p><script>window.__pwned = 1</script><img src="x" onerror="window.__pwned = 2">',
    );
    await expect(
      page.getByText("Parte da formatação não é permitida e foi removida."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Publicar agora" }).click();
    await expect(page.getByText("Mensagem publicada!")).toBeVisible();

    // A página pública mostra só o texto seguro e nunca executa o script
    await page.goto(`/palavra-viva/${message.slug}`);
    await expect(
      page.getByRole("heading", { level: 1, name: message.title }),
    ).toBeVisible();
    await expect(page.getByText("Texto seguro da mensagem.")).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __pwned?: number }).__pwned,
      ),
    ).toBeUndefined();

    // A API devolve o HTML já sanitizado
    const api = await request.get(`/api/public/palavra-viva/${message.slug}`);
    const body = await api.text();
    expect(body).toContain("seguro");
    expect(body).not.toMatch(/<script|onerror|<img/);

    // O PHP injeta a meta (WhatsApp e buscadores leem o HTML sem executar JavaScript)
    const shell = await request.get(`/palavra-viva/${message.slug}`);
    expect(shell.status()).toBe(200);
    expect(shell.headers()["cache-control"]).toContain("max-age=300");
    const html = await shell.text();
    expect(html).toContain(`<title>${message.title} — PIBLS</title>`);
    expect(html).toMatch(
      /<meta property="og:title" content="[^"]*Mensagem E2E/i,
    );
    expect(html).toContain('"@type":"Article"');
    expect(html).not.toContain("window.__pwned");

    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain(`/palavra-viva/${message.slug}`);
  });

  test("BR-042 uma mensagem agendada dá 404 no público e fora do sitemap", async ({
    page,
    request,
  }) => {
    await signIn(page, "comunicacao@pibls.test");
    await page.goto("/admin/palavra-viva/nova");
    await page
      .getByRole("textbox", { name: "Título" })
      .fill(futureMessage.title);
    await page.getByRole("textbox", { name: "Texto da mensagem" }).click();
    await pasteHtml(page, "<p>Ainda não é hora.</p>");
    await page.getByRole("radio", { name: "Agendar para depois" }).check();
    await page.getByLabel("Data e hora").fill(tomorrowAt20h());
    await page.getByRole("button", { name: "Agendar publicação" }).click();
    await expect(page.getByText(/Mensagem agendada para/)).toBeVisible();

    const shell = await request.get(`/palavra-viva/${futureMessage.slug}`);
    expect(shell.status()).toBe(404);
    expect(await shell.text()).not.toContain(futureMessage.title);
    expect(
      (
        await request.get(`/api/public/palavra-viva/${futureMessage.slug}`)
      ).status(),
    ).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
      futureMessage.slug,
    );
  });

  test("FR-077 com a sessão expirada, o rascunho volta depois de entrar de novo", async ({
    page,
    context,
  }) => {
    await signIn(page, "comunicacao@pibls.test");
    await page.goto("/admin/palavra-viva/nova");
    await page
      .getByRole("textbox", { name: "Título" })
      .fill(draftMessage.title);
    await page.getByRole("textbox", { name: "Texto da mensagem" }).click();
    await pasteHtml(page, "<p>Texto que eu não quero perder.</p>");
    await expect(
      page.getByText(/Rascunho guardado neste navegador às/),
    ).toBeVisible();

    // A sessão expira (o cookie some) e a próxima chamada ao servidor volta 401
    await context.clearCookies({ name: "pibls_session" });
    await page.getByRole("button", { name: "Publicar agora" }).click();
    await expect(
      page.getByText("Sua sessão expirou. Entre novamente."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/entrar/);

    // Entra de novo: volta ao formulário, que oferece o rascunho
    await page.getByLabel("E-mail").fill("comunicacao@pibls.test");
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin\/palavra-viva\/nova/);
    await expect(
      page.getByText(
        "Encontramos um rascunho não salvo neste navegador. Deseja restaurar?",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByRole("textbox", { name: "Título" })).toHaveValue(
      draftMessage.title,
    );
    await expect(
      page.getByRole("textbox", { name: "Texto da mensagem" }),
    ).toContainText("Texto que eu não quero perder.");
  });

  test("FR-077 sair do painel apaga o rascunho deste navegador", async ({
    page,
  }) => {
    await signIn(page, "comunicacao@pibls.test");
    await page.goto("/admin/palavra-viva/nova");
    await page
      .getByRole("textbox", { name: "Título" })
      .fill(draftMessage.title);
    await expect(
      page.getByText(/Rascunho guardado neste navegador às/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/admin\/entrar/);

    expect(
      await page.evaluate(() =>
        Object.keys(window.localStorage).filter((key) =>
          key.startsWith("pibls:draft:"),
        ),
      ),
    ).toEqual([]);
  });

  test("a Comunicação exclui o que criou (exclusão lógica) e o público deixa de ver", async ({
    page,
    request,
  }) => {
    await signIn(page, "comunicacao@pibls.test");

    await deleteBulletinByTitle(page, published.title);
    await deleteBulletinByTitle(page, scheduled.title);
    await deletePostByTitle(page, message.title);
    await deletePostByTitle(page, futureMessage.title);

    await page.goto(`/boletins?ano=${new Date().getFullYear()}`);
    await expect(page.getByText(published.title)).toHaveCount(0);
    expect((await request.get(`/palavra-viva/${message.slug}`)).status()).toBe(
      404,
    );
  });

  test("a Secretaria não tem acesso aos boletins nem às mensagens (BR-076)", async ({
    page,
  }) => {
    await signIn(page, "secretaria@pibls.test");

    await page.goto("/admin/boletins");
    await expect(
      page.getByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();

    const denied = await page.request.get("/api/admin/bulletins");
    expect(denied.status()).toBe(403);
    expect((await page.request.get("/api/admin/palavra-viva")).status()).toBe(
      403,
    );
  });
});
