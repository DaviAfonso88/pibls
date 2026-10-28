import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import { resetQueryCache, settingsFixture, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";

/*
 * Inscritos no painel (T193; design: AdminInscritos). FR-060 a FR-062: o contador de vagas, a lista com as respostas na ordem
 * do formulário, a busca, as exportações em CSV e em PDF e o cancelamento com confirmação (BR-034, BR-081).
 */

const COMUNICACAO = userFixture("COMUNICACAO");
const LIDER = userFixture("LIDER_MINISTERIO", { ministry: { id: 2, name: "Música" } });
const SECRETARIA = userFixture("SECRETARIA");

const field = (key: string, label: string, type: string) => ({
  key,
  label,
  type,
  required: false,
  help_text: null,
  sensitive: false,
  min: null,
  max: null,
  options: null,
});

const EVENT = {
  id: 1,
  slug: "retiro",
  title: "Retiro de jovens",
  excerpt: "Resumo.",
  ministry: { id: 2, name: "Música" },
  starts_at: "2099-12-05T12:00:00Z",
  ends_at: null,
  location: "Chácara Boa Vista",
  banner_small_url: null,
  registration: { state: "INSCRICOES_ABERTAS", deadline: null, spots_total: 60, spots_left: 18 },
  description: "<p>Três dias.</p>",
  banner_url: null,
  has_minors: true,
  form_schema: [
    field("camiseta", "Tamanho da camiseta", "SELECT"),
    field("alergias", "Alergias", "TEXT"),
  ],
  is_published: true,
  max_spots: 60,
  registration_deadline: null,
  registrations_count: 42,
  updated_at: "2026-10-16T13:10:00Z",
  updated_by: null,
};

function registration(id: number, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    created_at: "2026-11-02T15:30:00Z",
    participant_name: name,
    phone: "+5531988776655",
    email: null,
    guardian_name: "Rita Souza",
    guardian_phone: "+5531977665544",
    answers: [
      { key: "camiseta", label: "Tamanho da camiseta", type: "SELECT", value: "M" },
      { key: "alergias", label: "Alergias", type: "TEXT", value: "Amendoim" },
    ],
    ...overrides,
  };
}

const ROWS = [registration(10, "Ana Souza"), registration(11, "Bruno Lima", { answers: [] })];

const pageMeta = (overrides: Record<string, unknown> = {}) => ({
  page: 1,
  per_page: 50,
  total: 2,
  last_page: 1,
  spots_total: 60,
  spots_filled: 42,
  ...overrides,
});

const apiError = (code: string, message: string, status: number) =>
  HttpResponse.json({ error: { code, message, details: [], traceId: "t" } }, { status });

/** Os endereços pedidos à API de inscritos, para conferir busca, página e tamanho. */
function mockRegistrations(
  rows: unknown[] = ROWS,
  meta: Record<string, unknown> = pageMeta(),
): string[] {
  const seen: string[] = [];
  server.use(
    http.get("*/api/admin/events/1", () => HttpResponse.json({ data: EVENT })),
    http.get("*/api/admin/events/1/registrations", ({ request }) => {
      seen.push(new URL(request.url).search);
      return HttpResponse.json({ data: rows, meta });
    }),
  );
  return seen;
}

/** O que `saveBlob` faz no navegador: o link temporário clicado, com o nome do arquivo. */
function captureDownloads(): string[] {
  const names: string[] = [];
  URL.createObjectURL = vi.fn(() => "blob:teste");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  return names;
}

/** O botão de cancelar da linha, na tabela (no jsdom a visão em cartões também existe; o CSS esconde uma delas). */
async function cancelButton(name: string) {
  const table = await screen.findByRole("table", { name: "Lista de inscrições" });
  return within(table).getByRole("button", { name: `Cancelar a inscrição de ${name}` });
}

beforeEach(() => {
  resetQueryCache();
  useSnapshots({ settings: settingsFixture({ features: { events: true } }) });
  mockAdminDefaults();
  mockMe(COMUNICACAO);
  server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("flag, permissão e evento", () => {
  it("com features.events desligada, a tela não existe", async () => {
    useSnapshots({ settings: settingsFixture({ features: { events: false } }) });
    renderAdmin("/admin/eventos/1/inscritos");

    expect(
      await screen.findByRole("heading", { name: "Esta página do painel não existe" }),
    ).toBeVisible();
  });

  it("BR-076 quem não lê inscritos vê o aviso de falta de acesso", async () => {
    mockMe(userFixture("TESOURARIA"));
    renderAdmin("/admin/eventos/1/inscritos");

    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
  });

  it("um endereço que não é de evento não existe", async () => {
    renderAdmin("/admin/eventos/abc/inscritos");

    expect(
      await screen.findByRole("heading", { name: "Esta página do painel não existe" }),
    ).toBeVisible();
  });

  it("BR-030 evento de outro ministério (404) diz que não encontrou, sem tentar de novo", async () => {
    mockMe(LIDER);
    server.use(
      http.get("*/api/admin/events/1", () => apiError("NOT_FOUND", "Evento não encontrado.", 404)),
      http.get("*/api/admin/events/1/registrations", () =>
        apiError("NOT_FOUND", "Evento não encontrado.", 404),
      ),
    );
    renderAdmin("/admin/eventos/1/inscritos");

    expect(await screen.findByText("Não encontramos este evento.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });
});

describe("lista (FR-060)", () => {
  it("mostra o contador, a barra e as respostas na ordem do formulário", async () => {
    mockRegistrations();
    const { container } = renderAdmin("/admin/eventos/1/inscritos");

    expect(await screen.findByRole("heading", { level: 1, name: "Inscritos" })).toBeVisible();
    expect(await screen.findByText("42 de 60 vagas preenchidas")).toBeVisible();
    const bar = screen.getByRole("progressbar", { name: "Vagas preenchidas" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemax", "60");

    const table = await screen.findByRole("table", { name: "Lista de inscrições" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    // O nome vai primeiro; o resto segue a ordem do CSV e do PDF; a coluna de ações fecha
    expect(headers).toEqual([
      "Nome",
      "Inscrito em",
      "Telefone",
      "E-mail",
      "Responsável",
      "Telefone do responsável",
      "Tamanho da camiseta",
      "Alergias",
      "Ações",
    ]);
    const ana = within(table).getByRole("row", { name: /Ana Souza/ });
    expect(within(ana).getByText("(31) 98877-6655")).toBeVisible();
    expect(within(ana).getByText("02/11/2026 12h30")).toBeVisible();
    expect(within(ana).getByText("Rita Souza")).toBeVisible();
    expect(within(ana).getByText("M")).toBeVisible();
    expect(within(ana).getByText("Amendoim")).toBeVisible();

    expect(screen.getByRole("link", { name: /Retiro de jovens/ })).toHaveAttribute(
      "href",
      "/admin/eventos/1",
    );
    expect(screen.getByText(/O arquivo exportado tem dados pessoais/)).toBeVisible();
    await expectNoA11yViolations(container);
  });

  it("evento sem limite de vagas fala em inscritos e não mostra a barra", async () => {
    mockRegistrations(ROWS, pageMeta({ spots_total: null, spots_filled: 2 }));
    renderAdmin("/admin/eventos/1/inscritos");

    expect(await screen.findByText("2 inscritos")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("sem inscrições, diz que ninguém se inscreveu", async () => {
    mockRegistrations([], pageMeta({ total: 0, spots_filled: 0 }));
    renderAdmin("/admin/eventos/1/inscritos");

    expect(await screen.findByText("Ninguém se inscreveu ainda.")).toBeVisible();
    expect(screen.getByText("0 de 60 vagas preenchidas")).toBeVisible();
  });

  it("a busca vai para a URL e para a API, e sem resultado diz isso", async () => {
    const seen = mockRegistrations();
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/eventos/1/inscritos");
    await screen.findByRole("table", { name: "Lista de inscrições" });

    server.use(
      http.get("*/api/admin/events/1/registrations", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({ data: [], meta: pageMeta({ total: 0 }) });
      }),
    );
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "souza");

    await waitFor(() => expect(router.state.location.search).toBe("?busca=souza"));
    expect(await screen.findByText("Nenhuma inscrição encontrada para essa busca.")).toBeVisible();
    expect(seen.at(-1)).toContain("q=souza");
  });

  it("pagina pela URL, 50 por vez", async () => {
    const seen = mockRegistrations(ROWS, pageMeta({ total: 120, last_page: 3, page: 2 }));
    renderAdmin("/admin/eventos/1/inscritos?pagina=2");

    expect(await screen.findByText("Mostrando 51–100 de 120")).toBeVisible();
    expect(screen.getByRole("link", { name: "Página 3" })).toHaveAttribute(
      "href",
      "/admin/eventos/1/inscritos?pagina=3",
    );
    expect(seen[0]).toContain("per_page=50");
    expect(seen[0]).toContain("page=2");
  });

  it("falha ao carregar mostra o erro com 'Tentar novamente'", async () => {
    server.use(
      http.get("*/api/admin/events/1", () => HttpResponse.json({ data: EVENT })),
      http.get("*/api/admin/events/1/registrations", () => new HttpResponse(null, { status: 500 })),
    );
    renderAdmin("/admin/eventos/1/inscritos");

    expect(await screen.findByText("Não foi possível carregar as inscrições.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });
});

describe("cancelamento (FR-062, BR-034, BR-081)", () => {
  it("BR-034 pede confirmação, exclui, devolve a vaga e avisa", async () => {
    let rows = ROWS;
    let body: unknown = null;
    server.use(
      http.get("*/api/admin/events/1", () => HttpResponse.json({ data: EVENT })),
      http.get("*/api/admin/events/1/registrations", () =>
        HttpResponse.json({
          data: rows,
          meta: pageMeta({ total: rows.length, spots_filled: 40 + rows.length }),
        }),
      ),
      http.delete("*/api/admin/events/1/registrations/10", async ({ request }) => {
        body = await request.json();
        rows = rows.filter((row) => row.id !== 10);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1/inscritos");

    expect(await screen.findByText("42 de 60 vagas preenchidas")).toBeVisible();
    await user.click(await cancelButton("Ana Souza"));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Cancelar a inscrição de Ana Souza?",
    });
    expect(
      within(dialog).getByText(
        "A inscrição de Ana Souza será excluída definitivamente e a vaga liberada. Confirmar?",
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        "A vaga volta a ficar disponível no site. Avise a pessoa pelo WhatsApp, se for o caso.",
      ),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar inscrição" }));

    expect(
      await screen.findByText("Inscrição cancelada. A vaga voltou a ficar disponível."),
    ).toBeVisible();
    expect(body).toEqual({ reason: "CANCELLED" });
    expect(await screen.findByText("41 de 60 vagas preenchidas")).toBeVisible();
    expect(screen.queryByRole("row", { name: /Ana Souza/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("'Manter inscrição' fecha sem excluir", async () => {
    mockRegistrations();
    let deleted = false;
    server.use(
      http.delete("*/api/admin/events/1/registrations/10", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1/inscritos");

    await user.click(await cancelButton("Ana Souza"));
    await user.click(await screen.findByRole("button", { name: "Manter inscrição" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleted).toBe(false);
    expect(screen.getByRole("row", { name: /Ana Souza/ })).toBeVisible();
  });

  it("BR-081 a pedido do titular, avisa que é definitivo e manda o motivo certo", async () => {
    mockRegistrations();
    let body: unknown = null;
    server.use(
      http.delete("*/api/admin/events/1/registrations/11", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1/inscritos");

    await user.click(await cancelButton("Bruno Lima"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("radio", { name: /pediu a exclusão dos próprios dados/ }),
    );
    expect(
      within(dialog).getByText("Esta exclusão é definitiva e não pode ser desfeita. Confirmar?"),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar inscrição" }));

    expect(await screen.findByText("Inscrição excluída a pedido do titular.")).toBeVisible();
    expect(body).toEqual({ reason: "TITULAR_REQUEST" });
  });

  it("se o servidor recusar, a confirmação continua aberta e a inscrição continua na lista", async () => {
    mockRegistrations();
    server.use(
      http.delete("*/api/admin/events/1/registrations/10", () =>
        apiError("FORBIDDEN", "Você não tem permissão para esta ação.", 403),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1/inscritos");

    await user.click(await cancelButton("Ana Souza"));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Cancelar inscrição",
      }),
    );

    expect(await screen.findByText("Você não tem permissão para esta ação.")).toBeVisible();
    expect(screen.getByRole("alertdialog")).toBeVisible();
  });

  it("BR-030 o líder do ministério cancela as do próprio evento", async () => {
    mockMe(LIDER);
    mockRegistrations();
    renderAdmin("/admin/eventos/1/inscritos");

    expect(await cancelButton("Ana Souza")).toBeVisible();
  });

  it("BR-076 a Secretaria vê e exporta, mas não tem o botão de cancelar", async () => {
    mockMe(SECRETARIA);
    mockRegistrations();
    renderAdmin("/admin/eventos/1/inscritos");

    expect(await screen.findByRole("row", { name: /Ana Souza/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Cancelar a inscrição/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
  });
});

describe("exportações (FR-061)", () => {
  it("o CSV vem do servidor e é baixado com o nome que ele sugeriu", async () => {
    mockRegistrations();
    const downloads = captureDownloads();
    let accept = "";
    server.use(
      http.get("*/api/admin/events/1/registrations/export.csv", ({ request }) => {
        accept = request.headers.get("Accept") ?? "";
        return new HttpResponse("Inscrito em;Nome\r\n", {
          headers: {
            "Content-Type": "text/csv; charset=UTF-8",
            "Content-Disposition": 'attachment; filename="inscritos-retiro-20261110.csv"',
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1/inscritos");

    await user.click(await screen.findByRole("button", { name: "Exportar CSV" }));

    expect(await screen.findByText("CSV baixado.")).toBeVisible();
    expect(downloads).toEqual(["inscritos-retiro-20261110.csv"]);
    expect(accept).toContain("text/csv");
  });

  it("um erro do servidor na exportação (limite de 10 por 10 minutos) vira aviso, sem baixar nada", async () => {
    mockRegistrations();
    const downloads = captureDownloads();
    server.use(
      http.get("*/api/admin/events/1/registrations/export.csv", () =>
        apiError("TOO_MANY_REQUESTS", "Muitas tentativas. Tente de novo em instantes.", 429),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1/inscritos");

    await user.click(await screen.findByRole("button", { name: "Exportar CSV" }));

    expect(await screen.findByText("Muitas tentativas. Tente de novo em instantes.")).toBeVisible();
    expect(downloads).toEqual([]);
  });

  it("o PDF é gerado no navegador com todas as inscrições (até 500) e baixado", async () => {
    mockRegistrations();
    const downloads = captureDownloads();
    const user = userEvent.setup();
    const seen = mockRegistrations();
    renderAdmin("/admin/eventos/1/inscritos");
    await screen.findByRole("table", { name: "Lista de inscrições" });

    await user.click(screen.getByRole("button", { name: "Exportar PDF" }));

    expect(await screen.findByText("PDF baixado.", {}, { timeout: 30_000 })).toBeVisible();
    expect(seen.some((search) => search.includes("per_page=500"))).toBe(true);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^inscritos-retiro-\d{8}\.pdf$/);
  }, 60_000);
});
