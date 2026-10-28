import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// US10: a inscrição pública com garantia de vaga (T182). Roda contra o build servido com a API de verdade (Apache local
// em http://localhost:8080 ou homologação), com o Líder de Ministério do LocalDevelopmentSeeder, que cria os eventos pela
// API do painel. Os eventos são do R2: com `FEATURE_EVENTS` desligada a API responde 404 e a suíte é pulada.
//
// Variáveis: E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend). Sem ela, a suíte é pulada.
//
// Limites: 60 inscrições por 10 min por IP e 5 por telefone (esta suíte envia 9) e 20 logins por 15 min por IP (faz 1).
// Entre rodadas seguidas, `docker compose exec app php artisan cache:clear`. No Docker local, rode com
// E2E_TEST_TIMEOUT=240000 e E2E_EXPECT_TIMEOUT=45000.

const PASSWORD = process.env.E2E_USERS_PASSWORD;

test.skip(
  PASSWORD === undefined,
  "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).",
);

const RUN = `E2E${Date.now().toString(36)}`;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Um celular fictício e aleatório por chamada (cada telefone tem limite próprio de envios). */
const phone = () => {
  const tail = String(Math.floor(Math.random() * 90_000_000) + 10_000_000);
  return `(31) 9${tail.slice(0, 4)}-${tail.slice(4)}`;
};
const digits = (value: string) => value.replace(/\D/g, "");

interface CreatedEvent {
  id: number;
  slug: string;
  title: string;
}

const created: CreatedEvent[] = [];

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

/** Cria um evento pela API do painel, como o Líder de Ministério, no ministério dele. */
async function createEvent(
  page: Page,
  ministryId: number,
  name: string,
  fields: Record<string, unknown> = {},
): Promise<CreatedEvent> {
  const slug = `${RUN.toLowerCase()}-${name}`;
  const title = `${RUN} ${name}`;
  const token = await csrfToken(page.request);
  const response = await page.request.post("/api/admin/events", {
    data: {
      title,
      slug,
      ministry_id: ministryId,
      description: "<p>Evento fictício criado pelo teste E2E.</p>",
      starts_at: new Date(Date.now() + 14 * DAY).toISOString(),
      location: "Salão principal",
      is_published: true,
      ...fields,
    },
    headers: { "X-XSRF-TOKEN": token, Origin: "http://localhost:8080" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { data: { id: number } };
  const event = { id: body.data.id, slug, title };
  created.push(event);
  return event;
}

/** Inscreve uma pessoa pela API pública, como o formulário do site (CSRF incluído). */
async function registerViaApi(
  request: APIRequestContext,
  slug: string,
  name: string,
) {
  const token = await csrfToken(request);
  const response = await request.post(`/api/public/events/${slug}/register`, {
    data: {
      participant_name: name,
      phone: `+55${digits(phone())}`,
      answers: {},
      consent: true,
      website: "",
    },
    headers: { "X-XSRF-TOKEN": token, Origin: "http://localhost:8080" },
  });
  expect(response.status(), await response.text()).toBe(201);
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

const consent = (page: Page) =>
  page.getByRole("checkbox", { name: /Li e concordo/ });

async function fillParticipant(page: Page, name: string, number = phone()) {
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("WhatsApp", { exact: true }).fill(number);
}

test.describe("inscrição pública em eventos @us10", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;
  let ministryId = 0;
  let open: CreatedEvent;
  let minors: CreatedEvent;
  let full: CreatedEvent;
  let closed: CreatedEvent;
  let draft: CreatedEvent;

  test.beforeAll(async ({ browser, request }) => {
    test.setTimeout(Math.max(test.info().timeout, 300_000));
    const probe = await request.get("/api/public/events");
    test.skip(
      probe.status() === 404,
      "Eventos (R2) estão desligados (FEATURE_EVENTS).",
    );

    page = await browser.newPage();
    await signInAsLeader(page);

    const me = await page.request.get("/api/auth/me");
    const body = (await me.json()) as {
      data?: { ministry?: { id: number } | null };
      ministry?: { id: number } | null;
    };
    ministryId = (body.data ?? body).ministry?.id ?? 0;
    expect(
      ministryId,
      "o Líder precisa ter ministério vinculado",
    ).toBeGreaterThan(0);

    open = await createEvent(page, ministryId, "aberto", {
      max_spots: 50,
      form_schema: [
        {
          key: "igreja",
          label: "Igreja onde congrega",
          type: "TEXT",
          required: true,
        },
        {
          key: "camiseta",
          label: "Tamanho da camiseta",
          type: "SELECT",
          required: true,
          options: ["P", "M", "G"],
        },
      ],
    });
    minors = await createEvent(page, ministryId, "menores", {
      has_minors: true,
    });
    full = await createEvent(page, ministryId, "esgotado", { max_spots: 1 });
    await registerViaApi(page.request, full.slug, "Primeira Pessoa Teste");
    closed = await createEvent(page, ministryId, "prazo", {
      registration_deadline: new Date(Date.now() - 2 * HOUR).toISOString(),
    });
    draft = await createEvent(page, ministryId, "rascunho", {
      is_published: false,
    });
  });

  test.afterAll(async () => {
    if (page === undefined) return;
    const token = await csrfToken(page.request);
    const headers = { "X-XSRF-TOKEN": token, Origin: "http://localhost:8080" };
    for (const event of created) {
      // Evento com inscritos não se exclui (BR-028): sai do ar, sem deixar evento de teste publicado
      const removed = await page.request.delete(
        `/api/admin/events/${event.id}`,
        {
          headers,
        },
      );
      if (!removed.ok()) {
        await page.request.patch(`/api/admin/events/${event.id}`, {
          data: { is_published: false },
          headers,
        });
      }
    }
    await page.close();
  });

  test("lista os eventos e abre o formulário de um evento com vagas", async ({
    page: visitor,
  }) => {
    await visitor.goto("/eventos");
    await expect(
      visitor.getByRole("heading", { level: 1, name: "Eventos" }),
    ).toBeVisible();
    await visitor
      .getByRole("link", { name: new RegExp(open.title) })
      .first()
      .click();

    await expect(
      visitor.getByRole("heading", { level: 1, name: open.title }),
    ).toBeVisible();
    await expect(visitor.getByText("50 vagas restantes")).toBeVisible();
    await expect(
      visitor.getByRole("heading", { name: "Inscrição" }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(visitor);
  });

  test("inscreve com as perguntas do evento, valida e confirma; a repetida é recusada", async ({
    page: visitor,
  }) => {
    const name = `Maria ${RUN}`;
    const number = phone();
    await visitor.goto(`/eventos/${open.slug}`);

    // Sem preencher: os erros aparecem nos campos
    await visitor.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(visitor.getByText("Informe seu nome.")).toBeVisible();
    await expect(
      visitor.getByText(/precisa concordar com a Política de Privacidade/),
    ).toBeVisible();

    await fillParticipant(visitor, name, number);
    await visitor.getByLabel("Igreja onde congrega").fill("PIBLS");
    await visitor
      .getByRole("group", { name: /Tamanho da camiseta/ })
      .getByLabel("M")
      .check();
    await consent(visitor).check();
    await visitor.getByRole("button", { name: "Confirmar inscrição" }).click();

    await expect(
      visitor.getByRole("heading", { name: "Inscrição confirmada!" }),
    ).toBeVisible();
    await expect(visitor.getByText(name)).toBeVisible();

    // A mesma pessoa, com o mesmo telefone, não se inscreve duas vezes (BR-022)
    await visitor.goto(`/eventos/${open.slug}`);
    await expect(visitor.getByText("49 vagas restantes")).toBeVisible();
    await fillParticipant(visitor, name, number);
    await visitor.getByLabel("Igreja onde congrega").fill("PIBLS");
    await visitor
      .getByRole("group", { name: /Tamanho da camiseta/ })
      .getByLabel("M")
      .check();
    await consent(visitor).check();
    await visitor.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(
      visitor.getByText(
        "Esta pessoa já está inscrita neste evento com este telefone.",
      ),
    ).toBeVisible();
  });

  test("evento com menores pede o responsável legal", async ({
    page: visitor,
  }) => {
    await visitor.goto(`/eventos/${minors.slug}`);
    await expect(
      visitor.getByText("Responsável legal (participante menor de 18 anos)"),
    ).toBeVisible();

    await fillParticipant(visitor, `Joãozinho ${RUN}`);
    await consent(visitor).check();
    await visitor.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(
      visitor.getByText(/responsável/i).filter({ hasText: /Informe|obrigat/ }),
    ).not.toHaveCount(0);

    await visitor.getByLabel("Nome do responsável").fill(`Ana ${RUN}`);
    await visitor.getByLabel("Telefone do responsável").fill(phone());
    await visitor
      .getByRole("checkbox", { name: /Sou o responsável legal/ })
      .check();
    await visitor.getByRole("button", { name: "Confirmar inscrição" }).click();
    await expect(
      visitor.getByRole("heading", { name: "Inscrição confirmada!" }),
    ).toBeVisible();
  });

  test("vagas esgotadas: a página avisa e não mostra o formulário", async ({
    page: visitor,
  }) => {
    await visitor.goto(`/eventos/${full.slug}`);
    await expect(
      visitor.getByRole("heading", { name: "As vagas acabaram" }),
    ).toBeVisible();
    await expect(
      visitor.getByRole("button", { name: "Confirmar inscrição" }),
    ).toHaveCount(0);
    await expectNoSeriousA11yViolations(visitor);
  });

  test("prazo vencido: a página avisa e não mostra o formulário", async ({
    page: visitor,
  }) => {
    await visitor.goto(`/eventos/${closed.slug}`);
    await expect(
      visitor.getByRole("heading", { name: "Inscrições encerradas" }),
    ).toBeVisible();
    await expect(
      visitor.getByRole("button", { name: "Confirmar inscrição" }),
    ).toHaveCount(0);
  });

  test("evento despublicado é 'Evento não encontrado'", async ({
    page: visitor,
  }) => {
    await visitor.goto(`/eventos/${draft.slug}`);
    await expect(
      visitor.getByRole("heading", { name: "Evento não encontrado" }),
    ).toBeVisible();

    await visitor.goto("/eventos");
    await expect(visitor.getByText(draft.title)).toHaveCount(0);
  });
});
