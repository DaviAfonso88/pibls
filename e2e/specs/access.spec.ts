import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

// US3: acesso ao painel (T086). Roda contra o build servido com a API de verdade (Apache local em http://localhost:8080 ou
// homologação), com os usuários do LocalDevelopmentSeeder: um por papel (`<papel>@pibls.test`) e `redefinicao@pibls.example`,
// só para a redefinição de senha.
//
// Variáveis:
// - E2E_USERS_PASSWORD: a senha dos usuários de teste (a mesma TEST_USERS_PASSWORD do backend). Sem ela, a suíte é pulada.
// - E2E_MAILPIT_URL (ex.: http://localhost:8025): liga o teste da redefinição pelo e-mail. E2E_QUEUE_CMD (ex.: `docker compose
//   exec -T app php artisan queue:work --stop-when-empty`) processa a fila antes de olhar a caixa.
//
// Limites (BR-071): 20 logins por 15 min por IP e 3 pedidos de redefinição por hora por e-mail. Esta suíte faz cerca de 14
// logins; entre rodadas seguidas, `docker compose exec app php artisan cache:clear`. No Docker local, rode com
// E2E_TEST_TIMEOUT=240000 e E2E_EXPECT_TIMEOUT=45000 (cada requisição leva ~10 s).

const PASSWORD = process.env.E2E_USERS_PASSWORD;

test.skip(PASSWORD === undefined, "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).");

const menuNames = async (page: Page) => {
  const nav = page.getByRole("navigation", { name: "Painel" });
  await expect(nav).toBeVisible();
  return (await nav.getByRole("link").allTextContents()).map((text) => text.trim());
};

async function signIn(page: Page, email: string, password = PASSWORD ?? "") {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Eventos é da R2 (flag desligada na R1): fora da comparação, entre em cena quando a flag ligar. */
const withoutEvents = (names: string[]) => names.filter((name) => name !== "Eventos");

const ROLES: Array<{ role: string; email: string; menu: string[] }> = [
  {
    role: "COMUNICACAO",
    email: "comunicacao@pibls.test",
    menu: ["Início", "Boletins", "Palavra Viva", "Ministérios e grupos", "Configurações"],
  },
  {
    role: "SECRETARIA",
    email: "secretaria@pibls.test",
    menu: ["Início", "Contatos", "Ministérios e grupos", "Configurações"],
  },
  { role: "TESOURARIA", email: "tesouraria@pibls.test", menu: ["Início", "PIX"] },
  { role: "ORACAO", email: "oracao@pibls.test", menu: ["Início", "Pedidos de oração"] },
  {
    role: "PASTORAL",
    email: "pastoral@pibls.test",
    menu: ["Início", "Contatos", "Pedidos de oração", "Palavra Viva", "Usuários"],
  },
  { role: "LIDER_MINISTERIO", email: "lider@pibls.test", menu: ["Início"] },
  { role: "ADMIN_TECNICO", email: "admin@pibls.test", menu: ["Início", "Usuários"] },
];

test.describe("acesso ao painel @us3", () => {
  for (const { role, email, menu } of ROLES) {
    test(`${role}: entra, vê só os módulos do papel e sai`, async ({ page }) => {
      await page.goto("/admin");
      // sem sessão, o painel pede o login e guarda a rota pedida
      await expect(page).toHaveURL(/\/admin\/entrar\?voltar=%2Fadmin$/);

      await signIn(page, email);

      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/, Teste$/);
      expect(withoutEvents(await menuNames(page))).toEqual(menu);

      await page.getByRole("button", { name: "Sair" }).click();
      await expect(page).toHaveURL(/\/admin\/entrar$/);

      // depois de sair, o painel volta a pedir o login
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/entrar/);
    });
  }

  test("BR-070: e-mail inexistente e senha errada recebem a mesma frase", async ({ page }) => {
    await page.goto("/admin/entrar");

    await signIn(page, "nao-existe@pibls.test", "uma-senha-qualquer-123");
    const unknown = await page.getByRole("alert").textContent();

    await signIn(page, "admin@pibls.test", "senha-errada-123456");
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");

    expect(unknown?.trim()).toBe("E-mail ou senha inválidos.");
    await expect(page).toHaveURL(/\/admin\/entrar/);
  });

  test("depois do login volta à rota que a pessoa pediu", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await expect(page).toHaveURL(/\/admin\/entrar\?voltar=%2Fadmin%2Fusuarios/);

    await signIn(page, "admin@pibls.test");

    await expect(page).toHaveURL(/\/admin\/usuarios$/);
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Esta lista é só para consulta.");
  });

  test("BR-076: acesso direto sem permissão mostra o aviso na tela e a API responde 403", async ({
    page,
  }) => {
    await page.goto("/admin/entrar");
    await signIn(page, "comunicacao@pibls.test");
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/usuarios");
    await expect(
      page.getByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar ao início do painel" })).toHaveAttribute(
      "href",
      "/admin",
    );

    // a tela é só experiência: o servidor recusa de qualquer jeito
    const response = await page.request.get("/api/admin/users");
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toMatchObject({
      code: "FORBIDDEN",
      message: "Você não tem permissão para esta ação.",
    });
  });

  test("a API do painel responde 401 sem sessão", async ({ request }) => {
    const response = await request.get("/api/admin/users");

    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  test("o cookie de sessão é HttpOnly e SameSite=Strict, e o id muda no login", async ({
    page,
    context,
  }) => {
    await page.goto("/admin/entrar");
    await page.waitForLoadState("networkidle");
    await signIn(page, "admin@pibls.test");
    await expect(page).toHaveURL(/\/admin$/);

    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === "pibls_session");
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Strict");
    // o XSRF-TOKEN precisa ser legível pela SPA (é o que vai no cabeçalho)
    expect(cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.httpOnly).toBe(false);
  });

  test("o painel não é indexado (noindex)", async ({ page }) => {
    await page.goto("/admin/entrar");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("telas de acesso sem violação de acessibilidade", async ({ page }) => {
    const check = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations
          .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
          .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`),
      ).toEqual([]);
    };

    await page.goto("/admin/entrar");
    await expect(page.getByRole("form", { name: "Entrar no painel" })).toBeVisible();
    await check();

    await page.goto("/admin/esqueci-senha");
    await expect(page.getByRole("form", { name: "Pedir link de nova senha" })).toBeVisible();
    await check();

    await page.goto("/admin/entrar");
    await signIn(page, "pastoral@pibls.test");
    // a tela de entrada também tem um h1: espera a navegação para o painel antes de olhar
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/, Teste/);
    await check();

    await page.goto("/admin/usuarios");
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await check();
  });
});

test.describe("redefinição de senha pelo e-mail @us3", () => {
  const RESET_EMAIL = "redefinicao@pibls.example";
  const mailpit = process.env.E2E_MAILPIT_URL;

  test.skip(mailpit === undefined, "Defina E2E_MAILPIT_URL para ler o e-mail no Mailpit.");

  /** Pede o link, processa a fila e devolve a URL do último e-mail "Crie uma nova senha" do Mailpit. */
  async function requestLink(page: Page, request: import("@playwright/test").APIRequestContext) {
    await request.delete(`${mailpit}/api/v1/messages`);
    await page.goto("/admin/esqueci-senha");
    await page.getByLabel("E-mail").fill(RESET_EMAIL);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();

    if (process.env.E2E_QUEUE_CMD) execSync(process.env.E2E_QUEUE_CMD, { stdio: "ignore" });

    let link = "";
    await expect
      .poll(
        async () => {
          const list = (await (await request.get(`${mailpit}/api/v1/messages`)).json()) as {
            messages: Array<{ ID: string; Subject: string }>;
          };
          const message = list.messages.find((item) => item.Subject.includes("nova senha"));
          if (!message) return "";
          const detail = (await (await request.get(`${mailpit}/api/v1/message/${message.ID}`)).json()) as {
            Text: string;
          };
          link = /https?:\/\/\S+\/admin\/redefinir-senha#\S+/.exec(detail.Text)?.[0] ?? "";
          return link;
        },
        { timeout: 90_000, message: "O e-mail de nova senha não chegou ao Mailpit." },
      )
      .not.toBe("");

    return link;
  }

  async function chooseNewPassword(page: Page, link: string, password: string) {
    // o link do e-mail aponta para o endereço de produção/homologação; localmente, só o caminho e o fragmento importam
    const { hash } = new URL(link);
    await page.goto("about:blank");
    await page.goto(`/admin/redefinir-senha${hash}`);
    await page.getByLabel("Nova senha", { exact: true }).fill(password);
    await page.getByLabel("Repita a nova senha").fill(password);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("heading", { name: "Senha alterada" })).toBeVisible();
  }

  test("pede o link, define a nova senha, encerra as outras sessões e devolve a senha original", async ({
    page,
    browser,
    request,
  }) => {
    const temporary = `Temporaria-${Date.now()}-xyz`;
    const original = PASSWORD ?? "";

    // uma segunda sessão aberta antes da troca
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/admin/entrar");
    await signIn(otherPage, RESET_EMAIL);
    await expect(otherPage).toHaveURL(/\/admin$/);

    const link = await requestLink(page, request);
    // o token nunca vai na query string (fica no fragmento, que o servidor não vê)
    expect(new URL(link).search).toBe("");
    expect(link).toContain("#token=");

    await chooseNewPassword(page, link, temporary);
    // o fragmento é tirado da barra de endereço logo que a tela lê
    expect(new URL(page.url()).hash).toBe("");

    // o e-mail "Sua senha foi alterada" também foi enfileirado
    if (process.env.E2E_QUEUE_CMD) execSync(process.env.E2E_QUEUE_CMD, { stdio: "ignore" });
    await expect
      .poll(async () => {
        const list = (await (await request.get(`${mailpit}/api/v1/messages`)).json()) as {
          messages: Array<{ Subject: string }>;
        };
        return list.messages.some((item) => item.Subject.includes("foi alterada"));
      }, { timeout: 90_000 })
      .toBe(true);

    // a sessão que estava aberta foi encerrada
    await otherPage.goto("/admin");
    await expect(otherPage).toHaveURL(/\/admin\/entrar/);
    await other.close();

    // o link já usado não vale de novo (sair antes da página: mudar só o fragmento seria navegação interna, sem recarregar)
    await page.goto("about:blank");
    await page.goto(`/admin/redefinir-senha${new URL(link).hash}`);
    await page.getByLabel("Nova senha", { exact: true }).fill("outra-senha-bem-longa-9");
    await page.getByLabel("Repita a nova senha").fill("outra-senha-bem-longa-9");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();

    // a senha antiga não entra mais; a nova, sim
    await page.goto("/admin/entrar");
    await signIn(page, RESET_EMAIL, original);
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
    await signIn(page, RESET_EMAIL, temporary);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: "Sair" }).click();

    // devolve a senha original para a próxima rodada
    const restoreLink = await requestLink(page, request);
    await chooseNewPassword(page, restoreLink, original);
  });
});
