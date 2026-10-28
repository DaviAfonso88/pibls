import { screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import {
  renderRoute,
  resetQueryCache,
  settingsFixture,
  useSnapshots,
} from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import Eventos from "~/routes/public/eventos";
import { EventPage } from "../components/public/event-page";
import { formatCardDate, formatWhen, registrationStatus } from "../event-presentation";
import { SPOTS_REFRESH_MS, publicEventQuery } from "../public-api";
import { publicEventMessages as text } from "../public-messages";

/*
 * Páginas públicas de eventos (T187; design: Eventos e Evento): a lista com próximos e anteriores, a situação das
 * inscrições (abertas, esgotadas, encerradas, realizado), "Evento não encontrado" e "não encontrado" com a flag desligada.
 */

function summary(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `evento-${id}`,
    title: `Evento ${id}`,
    excerpt: "Resumo.",
    ministry: { id: 2, name: "Jovens (Salt)" },
    starts_at: "2099-11-14T11:00:00Z",
    ends_at: null,
    location: "Salão principal",
    banner_small_url: null,
    registration: { state: "INSCRICOES_ABERTAS", deadline: null, spots_total: 30, spots_left: 22 },
    ...overrides,
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    ...summary(1, { slug: "retiro", title: "Retiro de jovens" }),
    description: "<p>Um dia inteiro de comunhão.</p>",
    banner_url: null,
    has_minors: false,
    form_schema: [],
    ...overrides,
  };
}

const meta = (total: number, lastPage = 1, page = 1) => ({
  page,
  per_page: 12,
  total,
  last_page: lastPage,
});

/** O servidor valida `include_past` como `boolean` do Laravel: só `1` e `0` passam; `true` é 422. */
function mockList(data: unknown[], pageMeta = meta(data.length)) {
  server.use(
    http.get("*/api/public/events", ({ request }) => {
      const flag = new URL(request.url).searchParams.get("include_past");
      if (flag !== null && flag !== "1" && flag !== "0") {
        return HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Confira os campos destacados." } },
          { status: 422 },
        );
      }
      return HttpResponse.json({ data, meta: pageMeta });
    }),
  );
}

function mockEvent(data: Record<string, unknown>) {
  server.use(http.get("*/api/public/events/retiro", () => HttpResponse.json({ data })));
}

function notFoundEnvelope() {
  return HttpResponse.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Não encontramos o que você procurou.",
        details: [],
        traceId: "t",
      },
    },
    { status: 404 },
  );
}

beforeEach(() => {
  resetQueryCache();
  useSnapshots({ settings: settingsFixture({ features: { events: true } }) });
});

describe("lista de eventos", () => {
  it("mostra os próximos em cartões, com a situação das inscrições, e os anteriores numa lista", async () => {
    mockList([
      summary(1, { title: "Retiro de jovens" }),
      summary(2, {
        title: "Chá das mulheres",
        registration: {
          state: "INSCRICOES_ENCERRADAS",
          deadline: null,
          spots_total: 20,
          spots_left: 0,
        },
      }),
      summary(3, {
        title: "Aula inaugural",
        registration: {
          state: "INSCRICOES_ENCERRADAS",
          deadline: "2000-01-01T00:00:00Z",
          spots_total: null,
          spots_left: null,
        },
      }),
      summary(4, {
        title: "Encontro de casais",
        starts_at: "2020-09-26T11:00:00Z",
        registration: { state: "REALIZADO", deadline: null, spots_total: null, spots_left: null },
      }),
    ]);
    renderRoute(Eventos, "/eventos");

    const upcoming = await screen.findByRole("region", { name: text.upcoming });
    const cards = within(upcoming).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(
      within(cards[0] as HTMLElement).getByRole("heading", { name: "Retiro de jovens" }),
    ).toBeVisible();
    expect(cards[0]).toHaveTextContent("Inscrições abertas · 22 vagas");
    expect(cards[0]).toHaveTextContent("Jovens (Salt)");
    expect(cards[1]).toHaveTextContent(text.full);
    expect(cards[2]).toHaveTextContent(text.closed);
    expect(
      within(cards[0] as HTMLElement).getByRole("link", { name: /Ver evento/ }),
    ).toHaveAttribute("href", "/eventos/evento-1");

    const past = screen.getByRole("region", { name: text.past });
    const link = within(past).getByRole("link", { name: /Encontro de casais/ });
    expect(link).toHaveAttribute("href", "/eventos/evento-4");
    expect(link).toHaveTextContent("26/09/2020");
  });

  it("o banner pequeno vira imagem decorativa que carrega sob demanda", async () => {
    mockList([summary(1, { banner_small_url: "/uploads/eventos/2026/abc-800.webp" })]);
    const { container } = renderRoute(Eventos, "/eventos");

    await screen.findByRole("heading", { name: "Evento 1" });
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/uploads/eventos/2026/abc-800.webp");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("sem eventos, diz que não há nenhum", async () => {
    mockList([]);
    renderRoute(Eventos, "/eventos");

    expect(await screen.findByText(text.noEvents)).toBeVisible();
  });

  it("só com eventos passados, diz que não há próximos e ainda mostra os anteriores", async () => {
    mockList([
      summary(1, {
        starts_at: "2020-09-26T11:00:00Z",
        registration: { state: "REALIZADO", deadline: null, spots_total: null, spots_left: null },
      }),
    ]);
    renderRoute(Eventos, "/eventos");

    expect(await screen.findByText(text.noUpcoming)).toBeVisible();
    expect(screen.getByRole("region", { name: text.past })).toBeVisible();
  });

  it("pagina de 12 em 12, com o número da página na URL", async () => {
    mockList([summary(1)], meta(13, 2));
    renderRoute(Eventos, "/eventos");

    expect(await screen.findByText(text.pageOf(1, 2))).toBeVisible();
    expect(screen.getByRole("link", { name: text.next })).toHaveAttribute(
      "href",
      "/eventos?pagina=2",
    );
  });

  it("R-25 com a flag desligada, /eventos é a página de 'não encontrado'", async () => {
    useSnapshots({ settings: settingsFixture({ features: { events: false } }) });
    mockList([]); // a consulta pode sair antes de as configurações chegarem
    renderRoute(Eventos, "/eventos");

    expect(
      await screen.findByRole("heading", { name: "Não encontramos esta página" }),
    ).toBeVisible();
    expect(screen.queryByText(text.upcoming)).not.toBeInTheDocument();
  });

  it("R-25 se a API responde 404 (flag desligada no servidor), também mostra 'não encontrado'", async () => {
    server.use(http.get("*/api/public/events", () => notFoundEnvelope()));
    renderRoute(Eventos, "/eventos");

    expect(
      await screen.findByRole("heading", { name: "Não encontramos esta página" }),
    ).toBeVisible();
  });

  it("falha do servidor mostra o erro com 'Tentar novamente'", async () => {
    server.use(http.get("*/api/public/events", () => new HttpResponse(null, { status: 500 })));
    renderRoute(Eventos, "/eventos");

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  it("a lista não tem violações do axe", async () => {
    mockList([
      summary(1),
      summary(2, {
        registration: {
          state: "INSCRICOES_ENCERRADAS",
          deadline: null,
          spots_total: 5,
          spots_left: 0,
        },
      }),
    ]);
    const { container } = renderRoute(Eventos, "/eventos");
    await screen.findByRole("heading", { name: "Evento 1" });

    await expectNoA11yViolations(container);
  });
});

describe("página do evento", () => {
  function renderEvent() {
    return renderRoute(() => <EventPage slug="retiro" />, "/eventos/retiro");
  }

  it("mostra o cabeçalho, a descrição, as vagas que restam e o formulário", async () => {
    mockEvent(
      detail({
        ends_at: "2099-11-14T20:00:00Z",
        registration: {
          state: "INSCRICOES_ABERTAS",
          deadline: "2099-11-10T01:59:00Z",
          spots_total: 30,
          spots_left: 22,
        },
      }),
    );
    renderEvent();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Retiro de jovens" }),
    ).toBeVisible();
    expect(screen.getByText("Jovens (Salt)")).toBeVisible();
    expect(screen.getByText(/das 08h00 às 17h00/)).toBeVisible();
    expect(screen.getByText("Salão principal")).toBeVisible();
    expect(screen.getByText(/Inscrições até 09\/11\/2099 às 22h59/)).toBeVisible();
    expect(screen.getByText("22 vagas restantes")).toBeVisible();
    expect(screen.getByText("Um dia inteiro de comunhão.")).toBeVisible();
    expect(await screen.findByRole("heading", { name: text.registration })).toBeVisible();
    expect(screen.getByRole("link", { name: text.allEvents })).toHaveAttribute("href", "/eventos");
  });

  it("vagas esgotadas: sem formulário, com o aviso e o caminho para falar com o ministério", async () => {
    mockEvent(
      detail({
        registration: {
          state: "INSCRICOES_ENCERRADAS",
          deadline: null,
          spots_total: 30,
          spots_left: 0,
        },
      }),
    );
    renderEvent();

    expect(await screen.findByRole("heading", { name: text.fullTitle })).toBeVisible();
    expect(screen.queryByRole("heading", { name: text.registration })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.talkToMinistry })).toHaveAttribute(
      "href",
      "/contato",
    );
  });

  it("BR-020 prazo vencido: sem formulário, diz quando terminou", async () => {
    mockEvent(
      detail({
        registration: {
          state: "INSCRICOES_ENCERRADAS",
          deadline: "2020-11-10T01:59:00Z",
          spots_total: 30,
          spots_left: 5,
        },
      }),
    );
    renderEvent();

    expect(await screen.findByRole("heading", { name: text.closedTitle })).toBeVisible();
    expect(screen.getByText("O prazo terminou em 09/11/2020 às 22h59.")).toBeVisible();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });

  it("evento já realizado: sem formulário e sem contador de vagas", async () => {
    mockEvent(
      detail({
        starts_at: "2020-09-26T11:00:00Z",
        registration: { state: "REALIZADO", deadline: null, spots_total: 30, spots_left: 5 },
      }),
    );
    renderEvent();

    expect(await screen.findByRole("heading", { name: text.heldTitle })).toBeVisible();
    expect(screen.queryByText(/vagas restantes/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });

  it("vagas ilimitadas não mostram contador", async () => {
    mockEvent(
      detail({
        registration: {
          state: "INSCRICOES_ABERTAS",
          deadline: null,
          spots_total: null,
          spots_left: null,
        },
      }),
    );
    renderEvent();

    expect(await screen.findByRole("heading", { name: text.registration })).toBeVisible();
    expect(screen.queryByText(/vagas? restantes?/)).not.toBeInTheDocument();
  });

  it("evento despublicado ou que não existe mostra 'Evento não encontrado', fora do índice de busca", async () => {
    server.use(http.get("*/api/public/events/retiro", () => notFoundEnvelope()));
    const { container } = renderEvent();

    expect(
      await screen.findByRole("heading", { level: 1, name: text.notFoundTitle }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: text.allEvents })).toHaveAttribute("href", "/eventos");
    expect(container.ownerDocument.title).toContain(text.notFoundTitle);
  });

  it("falha do servidor mostra o erro com 'Tentar novamente', não 'não encontrado'", async () => {
    server.use(
      http.get("*/api/public/events/retiro", () => new HttpResponse(null, { status: 500 })),
    );
    renderEvent();

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeVisible();
    expect(screen.queryByText(text.notFoundTitle)).not.toBeInTheDocument();
  });

  it("consulta as vagas de novo a cada 30 s, só com a página visível", () => {
    const options = publicEventQuery("retiro");

    expect(options.refetchInterval).toBe(SPOTS_REFRESH_MS);
    expect(SPOTS_REFRESH_MS).toBe(30_000);
    expect(options.refetchIntervalInBackground).toBe(false);
  });

  it("a página não tem violações do axe", async () => {
    mockEvent(detail());
    const { container } = renderEvent();
    await screen.findByRole("heading", { name: text.registration });

    await expectNoA11yViolations(container);
  });
});

describe("apresentação", () => {
  it("formatCardDate usa o horário de São Paulo", () => {
    expect(formatCardDate("2099-11-14T11:00:00Z")).toBe("Sáb. 14/11/2099 · 08h00");
  });

  it("formatWhen: mesmo dia, dias diferentes e sem término", () => {
    expect(formatWhen("2099-11-14T11:00:00Z", "2099-11-14T20:00:00Z")).toBe(
      "Sábado, 14 de novembro de 2099, das 08h00 às 17h00",
    );
    expect(formatWhen("2099-11-13T22:00:00Z", "2099-11-15T15:00:00Z")).toBe(
      "Sexta-feira, 13 de novembro de 2099, às 19h00, até 15/11/2099, às 12h00",
    );
    expect(formatWhen("2099-11-14T11:00:00Z", null)).toBe(
      "Sábado, 14 de novembro de 2099, às 08h00",
    );
  });

  it("registrationStatus separa esgotado de encerrado pelo prazo e pelo início", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const base = { starts_at: "2026-12-05T12:00:00Z" };
    const closed = (deadline: string | null, left: number | null, total: number | null) => ({
      ...base,
      registration: {
        state: "INSCRICOES_ENCERRADAS" as const,
        deadline,
        spots_total: total,
        spots_left: left,
      },
    });

    expect(registrationStatus(closed(null, 0, 10), now)).toBe("full");
    expect(registrationStatus(closed("2026-11-09T00:00:00Z", 0, 10), now)).toBe("closed");
    expect(registrationStatus(closed("2026-11-09T00:00:00Z", 4, 10), now)).toBe("closed");
    expect(
      registrationStatus(
        { starts_at: "2026-11-01T12:00:00Z", registration: closed(null, 0, 10).registration },
        now,
      ),
    ).toBe("closed");
    expect(registrationStatus(closed(null, null, null), now)).toBe("closed");
    expect(
      registrationStatus(
        {
          ...base,
          registration: { state: "REALIZADO", deadline: null, spots_total: null, spots_left: null },
        },
        now,
      ),
    ).toBe("held");
    expect(
      registrationStatus(
        {
          ...base,
          registration: {
            state: "INSCRICOES_ABERTAS",
            deadline: null,
            spots_total: 5,
            spots_left: 5,
          },
        },
        now,
      ),
    ).toBe("open");
  });
});
