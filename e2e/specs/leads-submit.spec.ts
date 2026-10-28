import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

// US2: os cinco formulários públicos (T072). Roda contra o build servido com a API de verdade (Apache local em
// http://localhost:8080 ou homologação), com dados fictícios.
//
// Limites de envio (BR-003): 10 envios por IP e 3 por telefone ou e-mail, a cada 10 minutos. Esta suíte faz 9 envios, então
// uma segunda rodada em menos de 10 minutos esbarra no limite do IP. Local: `docker compose exec app php artisan
// cache:clear` entre as rodadas.
//
// E-mail: o teste de notificação só roda com E2E_MAILPIT_URL (ex.: http://localhost:8025). Se E2E_QUEUE_CMD existir
// (ex.: `docker compose exec -T app php artisan queue:work --stop-when-empty`), ele processa a fila antes de olhar a caixa;
// sem ele, o teste espera o agendador do ambiente. No Docker local, rode com E2E_TEST_TIMEOUT=240000 e
// E2E_EXPECT_TIMEOUT=45000 (cada requisição leva ~10 s). O tipo enviado precisa ter destinatários nas configurações.

/** Telefone fictício único por chamada: o limite por telefone não derruba os outros testes. */
function uniquePhone(): { masked: string } {
  // 9 + 8 dígitos, o primeiro de 2 a 9 (celular com DDD 31)
  const digits =
    String(2 + Math.floor(Math.random() * 8)) +
    String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  return { masked: `(31) 9${digits.slice(0, 4)}-${digits.slice(4)}` };
}

const consent = (page: Page) =>
  page.getByRole("checkbox", { name: /Li e concordo/ });

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

async function fillVisitor(
  page: Page,
  phone: string,
  name = "Visitante de Teste",
) {
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByLabel("WhatsApp", { exact: true }).fill(phone);
  await page.getByLabel("Bairro onde mora").fill("Centro");
  await page
    .getByRole("group", { name: "Deseja receber uma visita?" })
    .getByLabel("Sim")
    .check();
  await page
    .getByRole("group", { name: "Deseja conhecer uma Célula de CL?" })
    .getByLabel("Não")
    .check();
  await consent(page).check();
}

test.describe("formulários de contato @us2", () => {
  test("Ficha de Visitante: valida, envia e confirma", async ({ page }) => {
    await page.goto("/sou-visitante");

    // Sem preencher: os erros aparecem nos campos e o foco vai ao primeiro
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Informe seu nome.")).toBeVisible();
    await expect(
      page.getByText(
        "Para enviar, você precisa concordar com a Política de Privacidade.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Nome", { exact: true })).toBeFocused();
    await expectNoSeriousA11yViolations(page);

    await fillVisitor(page, uniquePhone().masked);
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(
      page.getByRole("heading", { name: "Recebemos seu contato!" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recebemos seu contato!" }),
    ).toBeFocused();
    await expectNoSeriousA11yViolations(page);
  });

  test("Quero ser membro: envia e confirma", async ({ page }) => {
    await page.goto("/quero-ser-membro");

    await page.getByLabel("Nome", { exact: true }).fill("Membro de Teste");
    await page
      .getByLabel("WhatsApp", { exact: true })
      .fill(uniquePhone().masked);
    await page
      .getByRole("group", { name: "É membro de outra igreja batista?" })
      .getByLabel("Não")
      .check();
    await consent(page).check();
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(
      page.getByRole("heading", { name: "Recebemos seu contato!" }),
    ).toBeVisible();
  });

  test("Pedido de oração: anônimo por padrão e com texto de até 4.000 caracteres", async ({
    page,
  }) => {
    await page.goto("/pedido-de-oracao");

    await expect(page.getByLabel(/WhatsApp ou e-mail/)).toHaveCount(0);
    await page
      .getByLabel("Seu pedido")
      .fill("Peço oração por uma família de teste. ".repeat(20));
    await consent(page).check();
    await page.getByRole("button", { name: "Enviar pedido" }).click();

    await expect(
      page.getByRole("heading", { name: "Recebemos seu pedido" }),
    ).toBeVisible();
  });

  test("Fale conosco: exige telefone ou e-mail", async ({ page }) => {
    await page.goto("/contato");

    await page.getByLabel("Nome", { exact: true }).fill("Contato de Teste");
    await page
      .getByLabel("Mensagem")
      .fill("Uma mensagem de teste para a secretaria.");
    await consent(page).check();
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(
      page.getByText("Informe um telefone ou um e-mail para retorno."),
    ).toBeVisible();

    await page.getByLabel("E-mail").fill(`teste-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Enviar mensagem" }).click();

    await expect(
      page.getByRole("heading", { name: "Recebemos seu contato!" }),
    ).toBeVisible();
  });

  test("Contato com ministério: abre no ministério da URL e envia", async ({
    page,
    request,
  }) => {
    const snapshot = (await (
      await request.get("/data/ministries.json")
    ).json()) as {
      data: Array<{ id: number; category: string; name: string }>;
    };
    const ministry = snapshot.data.find(
      (item) => item.category === "MINISTERIO",
    );
    test.skip(
      ministry === undefined,
      "O snapshot deste ambiente não tem ministérios.",
    );

    await page.goto(`/contato?ministerio=${ministry?.id}`);

    await expect(
      page.getByRole("radio", { name: "Com um ministério" }),
    ).toBeChecked();
    await expect(page.getByLabel("Ministério", { exact: true })).toHaveValue(
      String(ministry?.id),
    );

    await page.getByLabel("Nome", { exact: true }).fill("Contato de Teste");
    await page.getByLabel(/Telefone ou WhatsApp/).fill(uniquePhone().masked);
    await page
      .getByLabel("Mensagem")
      .fill("Gostaria de conhecer o ministério.");
    await consent(page).check();
    await page.getByRole("button", { name: "Enviar mensagem" }).click();

    await expect(
      page.getByRole("heading", { name: "Recebemos seu contato!" }),
    ).toBeVisible();
  });

  test("?grupo=<id> abre a Ficha de Visitante com o grupo escolhido", async ({
    page,
    request,
  }) => {
    const snapshot = (await (
      await request.get("/data/ministries.json")
    ).json()) as {
      data: Array<{ id: number; category: string; name: string }>;
    };
    const group = snapshot.data.find((item) => item.category === "GRUPO");
    test.skip(group === undefined, "O snapshot deste ambiente não tem grupos.");

    await page.goto(`/sou-visitante?grupo=${group?.id}`);
    await expect(page.getByLabel(/Grupo de interesse/)).toHaveValue(
      String(group?.id),
    );

    // Um id que não existe é ignorado
    await page.goto("/sou-visitante?grupo=999999");
    await expect(page.getByLabel(/Grupo de interesse/)).toHaveValue("");
  });

  test("BR-003 o 4º envio com o mesmo telefone em 10 minutos é recusado", async ({
    page,
  }) => {
    const phone = uniquePhone().masked;

    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto("/sou-visitante");
      await fillVisitor(page, phone, `Visitante ${attempt}`);
      await page.getByRole("button", { name: "Enviar" }).click();
      await expect(
        page.getByRole("heading", { name: "Recebemos seu contato!" }),
      ).toBeVisible();
    }

    await page.goto("/sou-visitante");
    await fillVisitor(page, phone, "Visitante 4");
    await page.getByRole("button", { name: "Enviar" }).click();

    const alert = page
      .getByRole("alert")
      .filter({ hasText: /tente|aguarde|muitas/i });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Tentar novamente" }),
    ).toBeVisible();
    await expect(alert.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
    // O formulário continua preenchido
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
      "Visitante 4",
    );
  });

  test("BR-007 a notificação por e-mail não leva dado pessoal", async ({
    page,
    request,
  }) => {
    const mailpit = process.env.E2E_MAILPIT_URL;
    test.skip(
      mailpit === undefined,
      "Defina E2E_MAILPIT_URL para conferir a caixa do Mailpit.",
    );

    const name = `Nome Sigiloso ${Date.now()}`;
    await page.goto("/sou-visitante");
    await fillVisitor(page, uniquePhone().masked, name);
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(
      page.getByRole("heading", { name: "Recebemos seu contato!" }),
    ).toBeVisible();

    if (process.env.E2E_QUEUE_CMD)
      execSync(process.env.E2E_QUEUE_CMD, { stdio: "ignore" });

    await expect
      .poll(
        async () => {
          const list = (await (
            await request.get(`${mailpit}/api/v1/messages`)
          ).json()) as {
            messages: Array<{ Subject: string }>;
          };
          return list.messages.some((message) =>
            message.Subject.includes("Novo contato"),
          );
        },
        {
          timeout: 90_000,
          message: "Nenhum e-mail 'Novo contato' chegou ao Mailpit.",
        },
      )
      .toBe(true);

    const list = (await (
      await request.get(`${mailpit}/api/v1/messages`)
    ).json()) as {
      messages: Array<{ ID: string; Subject: string }>;
    };
    for (const message of list.messages.filter((item) =>
      item.Subject.includes("Novo contato"),
    )) {
      const detail = (await (
        await request.get(`${mailpit}/api/v1/message/${message.ID}`)
      ).json()) as {
        Text: string;
        HTML: string;
      };
      expect(`${detail.Text}${detail.HTML}`).not.toContain(name);
    }
  });
});
