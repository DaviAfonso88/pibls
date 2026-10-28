import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { readFile } from "node:fs/promises";

// US11: o Líder de Ministério acompanha os inscritos, exporta CSV e PDF e cancela inscrições (T191). Roda contra o build
// servido com a API de verdade (Apache local em http://localhost:8080 ou homologação), com o Líder do
// LocalDevelopmentSeeder. Os eventos são do R2: com `FEATURE_EVENTS` desligada a API responde 404 e a suíte é pulada.
//
// Variáveis: E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend). Sem ela, a suíte é pulada.
//   E2E_VOLUME_EVENT_ID: o id de um evento com 500 inscrições fictícias do ministério do Líder (o limite de envios do site
//   impede criá-las pela API; no Docker local, `docker compose exec app php e2e-seed-registrations.php seed 500`). Sem ela,
//   só o caso do PDF de 500 é pulado.
//
// SC-014: o PDF de 500 inscrições sai em até 10 s no computador de referência; o Chromium roda com a CPU 4× mais lenta.
// No Docker local, rode com E2E_TEST_TIMEOUT=240000 e E2E_EXPECT_TIMEOUT=45000.

const PASSWORD = process.env.E2E_USERS_PASSWORD;
const VOLUME_EVENT_ID = process.env.E2E_VOLUME_EVENT_ID;

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

const RUN = `E2E${Date.now().toString(36)}`;
const DAY = 24 * 3_600_000;
const PDF_BUDGET_MS = 10_000;
// A busca das 500 inscrições leva ~3 s no Docker local de Windows (bind mount lento) e uma fração disso em produção
const SERVER_ALLOWANCE_MS = 5_000;

const phone = () =>
  `+5531${String(Math.floor(Math.random() * 900_000_000) + 100_000_000)}`;

async function csrfToken(request: APIRequestContext) {
  await request.get("/sanctum/csrf-cookie");
  const state = await request.storageState();
  return decodeURIComponent(
    state.cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value ?? "",
  );
}

async function signInAsLeader(page: Page) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill("lider@pibls.test");
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
}

test.describe("inscritos do evento no painel @us11", () => {
  test.describe.configure({ mode: "serial" });

  let context: BrowserContext;
  let page: Page;
  let eventId = 0;
  let slug = "";
  let title = "";

  const origin = { Origin: "http://localhost:8080" };

  async function post(path: string, data: unknown) {
    const token = await csrfToken(page.request);
    return page.request.post(path, {
      data,
      headers: { "X-XSRF-TOKEN": token, ...origin },
    });
  }

  test.beforeAll(async ({ browser, request }) => {
    test.setTimeout(Math.max(test.info().timeout, 300_000));
    const probe = await request.get("/api/public/events");
    test.skip(
      probe.status() === 404,
      "Eventos (R2) estão desligados (FEATURE_EVENTS).",
    );

    context = await browser.newContext();
    page = await context.newPage();
    await signInAsLeader(page);

    const me = await page.request.get("/api/auth/me");
    const body = (await me.json()) as {
      data?: { ministry?: { id: number } | null };
      ministry?: { id: number } | null;
    };
    const ministryId = (body.data ?? body).ministry?.id ?? 0;
    expect(
      ministryId,
      "o Líder precisa ter ministério vinculado",
    ).toBeGreaterThan(0);

    slug = `${RUN.toLowerCase()}-inscritos`;
    title = `${RUN} inscritos`;
    const created = await post("/api/admin/events", {
      title,
      slug,
      ministry_id: ministryId,
      description: "<p>Evento fictício criado pelo teste E2E.</p>",
      starts_at: new Date(Date.now() + 14 * DAY).toISOString(),
      location: "Salão principal",
      is_published: true,
      max_spots: 20,
      form_schema: [
        {
          key: "camiseta",
          label: "Tamanho da camiseta",
          type: "SELECT",
          required: false,
          options: ["P", "M", "G"],
        },
      ],
    });
    expect(created.status(), await created.text()).toBe(201);
    eventId = ((await created.json()) as { data: { id: number } }).data.id;

    const names = ["Ana Souza Teste", "Bruno Lima Teste", "=CMD Injecao Teste"];
    for (const name of names) {
      const registered = await post(`/api/public/events/${slug}/register`, {
        participant_name: name,
        phone: phone(),
        answers: { camiseta: "M" },
        consent: true,
        website: "",
      });
      expect(registered.status(), await registered.text()).toBe(201);
    }
  });

  test.afterAll(async () => {
    if (page === undefined) return;
    const token = await csrfToken(page.request);
    const headers = { "X-XSRF-TOKEN": token, ...origin };
    for (const id of [eventId].filter((value) => value > 0)) {
      // Evento com inscritos não se exclui (BR-028): sai do ar, sem deixar evento de teste publicado
      const removed = await page.request.delete(`/api/admin/events/${id}`, {
        headers,
      });
      if (!removed.ok()) {
        await page.request.patch(`/api/admin/events/${id}`, {
          data: { is_published: false },
          headers,
        });
      }
    }
    await context.close();
  });

  test("mostra o contador de vagas e a lista de inscritos", async () => {
    await page.goto(`/admin/eventos/${eventId}/inscritos`);

    await expect(
      page.getByRole("heading", { level: 1, name: /Inscritos/ }),
    ).toBeVisible();
    await expect(page.getByText("3 de 20 vagas preenchidas")).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Vagas preenchidas" }),
    ).toHaveAttribute("aria-valuenow", "3");

    const table = page.getByRole("table");
    await expect(
      table.getByRole("columnheader", { name: "Tamanho da camiseta" }),
    ).toBeVisible();
    await expect(table.getByText("Ana Souza Teste")).toBeVisible();
    await expect(table.getByText("Bruno Lima Teste")).toBeVisible();

    await expectNoSeriousA11yViolations(page);
  });

  test("busca por nome e guarda a busca na URL", async () => {
    await page.goto(`/admin/eventos/${eventId}/inscritos`);
    await page.getByRole("searchbox", { name: "Buscar" }).fill("bruno");

    await expect(page).toHaveURL(/busca=bruno/);
    const table = page.getByRole("table");
    await expect(table.getByText("Bruno Lima Teste")).toBeVisible();
    await expect(table.getByText("Ana Souza Teste")).toHaveCount(0);
  });

  test("exporta o CSV com BOM, ponto e vírgula e proteção contra fórmulas", async () => {
    await page.goto(`/admin/eventos/${eventId}/inscritos`);
    await expect(page.getByText("3 de 20 vagas preenchidas")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar CSV" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^inscritos-${slug}-\\d{8}\\.csv$`),
    );
    const path = await download.path();
    const raw = await readFile(path);
    expect(raw.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));

    const lines = raw.toString("utf8").replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe(
      "Inscrito em;Nome;Telefone;E-mail;Tamanho da camiseta",
    );
    const body = lines.filter((line, index) => index > 0 && line !== "");
    expect(body).toHaveLength(3);
    expect(body.some((line) => line.includes(";Ana Souza Teste;"))).toBe(true);
    // CSV injection: a célula que começa com "=" sai com apóstrofo
    expect(body.some((line) => line.includes(";'=CMD Injecao Teste;"))).toBe(
      true,
    );
    await expect(page.getByText("CSV baixado.")).toBeVisible();
  });

  test("exporta o PDF com os inscritos", async () => {
    await page.goto(`/admin/eventos/${eventId}/inscritos`);
    await expect(page.getByText("3 de 20 vagas preenchidas")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar PDF" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^inscritos-${slug}-\\d{8}\\.pdf$`),
    );
    const raw = await readFile(await download.path());
    expect(raw.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    await expect(page.getByText("PDF baixado.")).toBeVisible();
  });

  test("cancela uma inscrição com confirmação e devolve a vaga", async () => {
    await page.goto(`/admin/eventos/${eventId}/inscritos`);
    await expect(page.getByText("3 de 20 vagas preenchidas")).toBeVisible();

    const table = page.getByRole("table");
    await table
      .getByRole("button", { name: "Cancelar a inscrição de Bruno Lima Teste" })
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(
      dialog.getByText(
        "A inscrição de Bruno Lima Teste será excluída definitivamente e a vaga liberada. Confirmar?",
      ),
    ).toBeVisible();

    // Manter não muda nada
    await dialog.getByRole("button", { name: "Manter inscrição" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("3 de 20 vagas preenchidas")).toBeVisible();

    await table
      .getByRole("button", { name: "Cancelar a inscrição de Bruno Lima Teste" })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar inscrição" })
      .click();

    await expect(
      page.getByText("Inscrição cancelada. A vaga voltou a ficar disponível."),
    ).toBeVisible();
    await expect(page.getByText("2 de 20 vagas preenchidas")).toBeVisible();
    await expect(table.getByText("Bruno Lima Teste")).toHaveCount(0);

    // A vaga volta no site público (BR-034)
    const publicEvent = await page.request.get(`/api/public/events/${slug}`);
    const publicBody = (await publicEvent.json()) as {
      data: { registration: { spots_left: number } };
    };
    expect(publicBody.data.registration.spots_left).toBe(18);
  });

  test("a exclusão a pedido do titular (LGPD) pede o motivo e avisa que é definitiva", async () => {
    await page.goto(`/admin/eventos/${eventId}/inscritos`);
    const table = page.getByRole("table");
    await table
      .getByRole("button", { name: "Cancelar a inscrição de Ana Souza Teste" })
      .click();

    const dialog = page.getByRole("alertdialog");
    await dialog
      .getByRole("radio", { name: /exclusão dos próprios dados/ })
      .check();
    await expect(
      dialog.getByText(
        "Esta exclusão é definitiva e não pode ser desfeita. Confirmar?",
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar inscrição" }).click();

    await expect(
      page.getByText("Inscrição excluída a pedido do titular."),
    ).toBeVisible();
    await expect(table.getByText("Ana Souza Teste")).toHaveCount(0);
  });

  test("evento sem inscrições mostra o estado vazio e o CSV só com o cabeçalho", async () => {
    // Já cancelamos duas das três; cancela a última para esvaziar a lista
    await page.goto(`/admin/eventos/${eventId}/inscritos`);
    await page
      .getByRole("table")
      .getByRole("button", { name: /^Cancelar a inscrição de / })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar inscrição" })
      .click();

    await expect(page.getByText("Ninguém se inscreveu ainda.")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar CSV" }).click(),
    ]);
    const text = (await readFile(await download.path()))
      .toString("utf8")
      .replace(/^﻿/, "");
    expect(text.trimEnd().split("\r\n")).toEqual([
      "Inscrito em;Nome;Telefone;E-mail;Tamanho da camiseta",
    ]);
  });

  test("com 500 inscrições, o PDF sai em até 10 s com a CPU 4× mais lenta", async () => {
    test.skip(
      VOLUME_EVENT_ID === undefined,
      "Defina E2E_VOLUME_EVENT_ID (evento com 500 inscrições fictícias).",
    );

    const volume = await context.newPage();
    try {
      const cdp = await context.newCDPSession(volume);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

      await volume.goto(`/admin/eventos/${VOLUME_EVENT_ID}/inscritos`);
      await expect(
        volume.getByText(/^500 de \d+ vagas preenchidas$/),
      ).toBeVisible();

      const button = volume.getByRole("button", { name: "Exportar PDF" });
      const started = Date.now();
      // O instante em que as 500 inscrições terminaram de chegar ao navegador
      const dataArrived = volume
        .waitForResponse(
          (response) =>
            response.url().includes("/registrations?") &&
            response.url().includes("per_page=500"),
        )
        .then(async (response) => {
          await response.finished();
          return Date.now();
        });
      const [download] = await Promise.all([
        volume.waitForEvent("download", { timeout: 60_000 }),
        button.click(),
      ]);
      const finished = Date.now();
      const received = await dataArrived;

      const raw = await readFile(await download.path());
      expect(raw.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      // O PDF em si é o que sobra depois que os dados chegaram; a busca é do servidor (no Docker local de Windows, ~3 s).
      const total = finished - started;
      const generation = finished - received;
      console.log(
        `PDF de 500 inscrições: ${total} ms no total, ${generation} ms depois dos dados chegarem (CPU 4× mais lenta)`,
      );
      expect(total, "SC-014: do clique ao arquivo").toBeLessThanOrEqual(
        PDF_BUDGET_MS + SERVER_ALLOWANCE_MS,
      );
      expect(generation, "geração do PDF no navegador").toBeLessThanOrEqual(
        PDF_BUDGET_MS,
      );
    } finally {
      await volume.close();
    }
  });
});
