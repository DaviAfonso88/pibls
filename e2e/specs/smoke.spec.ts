import { expect, test } from "@playwright/test";

// E2E de fumaça (DevOps → Pipeline de CD, passo 5): roda em homologação depois de cada deploy, contra a release
// recém-ativada (E2E_EXPECT_RELEASE). Só confere que o que acabou de subir está de pé: nada de regra de negócio.

test.describe("fumaça @smoke", () => {
  test("a API responde ok e com a release esperada", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    const body = (await response.json()) as { status: string; release: string };
    expect(body.status).toBe("ok");
    if (process.env.E2E_EXPECT_RELEASE) {
      expect(body.release).toBe(process.env.E2E_EXPECT_RELEASE);
    }
  });

  test("o cookie CSRF do Sanctum é emitido", async ({ request }) => {
    const response = await request.get("/sanctum/csrf-cookie");

    expect(response.status()).toBe(204);
    expect(response.headers()["set-cookie"]).toContain("XSRF-TOKEN");
  });

  test("erro da API vem no envelope padrão, com o id da requisição", async ({
    request,
  }) => {
    const response = await request.get("/api/esta-rota-nao-existe");

    expect(response.status()).toBe(404);
    const body = (await response.json()) as {
      error: { code: string; traceId: string };
    };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.traceId).toBe(response.headers()["x-request-id"]);
  });

  test("a página inicial carrega e hidrata sem erro no console", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Primeira Igreja Batista/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("os cabeçalhos de segurança do .htaccess estão no ar", async ({
    request,
  }) => {
    const headers = (await request.get("/")).headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
  });

  test("uma rota desconhecida cai na SPA, não em erro do servidor", async ({
    page,
  }) => {
    const response = await page.goto("/admin/entrar");

    expect(response?.status()).toBe(200);
  });
});
