import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { sundaysAround } from "~/shared/format";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetQueryCache, settingsFixture, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";

beforeEach(() => {
  resetQueryCache();
  useSnapshots();
  mockAdminDefaults();
});

const shortcutNames = async () => {
  const section = await screen.findByRole("region", { name: "Atalhos" });
  return within(section)
    .getAllByRole("link")
    .map((link) => link.textContent);
};

describe("Início do painel", () => {
  it("cumprimenta pelo primeiro nome, com a data, e oferece 'Ver o site'", async () => {
    mockMe(userFixture("SECRETARIA"));

    renderAdmin("/admin");

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/^(Bom dia|Boa tarde|Boa noite), Rafael$/);
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "Ver o site" }),
    ).toHaveAttribute("href", "/");
  });

  it.each([
    ["SECRETARIA", ["Atender contatos", "Horários e avisos do site", "Ministérios e grupos"]],
    [
      "COMUNICACAO",
      [
        "Publicar boletim",
        "Nova mensagem da Palavra Viva",
        "Horários e avisos do site",
        "Ministérios e grupos",
      ],
    ],
    ["TESOURARIA", ["Dados do PIX"]],
    ["ORACAO", ["Pedidos de oração"]],
    ["ADMIN_TECNICO", ["Ver quem tem acesso"]],
  ])("%s só tem os atalhos do que pode fazer", async (role, expected) => {
    mockMe(userFixture(role));

    renderAdmin("/admin");

    expect(await shortcutNames()).toEqual(expected);
  });

  it("os atalhos levam às telas certas", async () => {
    mockMe(userFixture("COMUNICACAO"));

    renderAdmin("/admin");

    const section = await screen.findByRole("region", { name: "Atalhos" });
    expect(within(section).getByRole("link", { name: "Publicar boletim" })).toHaveAttribute(
      "href",
      "/admin/boletins/novo",
    );
    expect(
      within(section).getByRole("link", { name: "Nova mensagem da Palavra Viva" }),
    ).toHaveAttribute("href", "/admin/palavra-viva/nova");
  });

  it("não tem violação de acessibilidade", async () => {
    mockMe(userFixture("COMUNICACAO"));

    const { container } = renderAdmin("/admin");
    await shortcutNames();

    await expectNoA11yViolations(container);
  });

  describe("contatos parados (BR-010)", () => {
    const lead = (id: number, overrides: object = {}) => ({
      id,
      type: "VISITANTE",
      name: "Mariana Souza",
      waiting_days: 5,
      assigned_to: null,
      ...overrides,
    });

    it("pede os contatos novos da caixa geral parados há mais de 3 dias, e só a quem lê a caixa", async () => {
      mockMe(userFixture("SECRETARIA"));
      let url: URL | null = null;
      server.use(
        http.get("*/api/admin/leads", ({ request }) => {
          url = new URL(request.url);
          return HttpResponse.json({ data: [lead(12)] });
        }),
      );

      renderAdmin("/admin");

      await screen.findByText("Mariana Souza");
      expect(url).not.toBeNull();
      const params = (url as unknown as URL).searchParams;
      expect(params.get("inbox")).toBe("geral");
      expect(params.get("status")).toBe("NOVO");
      expect(params.get("sort")).toBe("created_at");
      // `to` = hoje − 3 dias, em AAAA-MM-DD
      const expected = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const day = params.get("to") ?? "";
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        Math.abs(new Date(`${day}T12:00:00-03:00`).getTime() - expected.getTime()),
      ).toBeLessThan(36 * 60 * 60 * 1000);
    });

    it("lista nome, tipo, responsável e há quantos dias esperam, com link para o contato", async () => {
      mockMe(userFixture("SECRETARIA"));
      server.use(
        http.get("*/api/admin/leads", () =>
          HttpResponse.json({
            data: [
              lead(12),
              lead(13, {
                type: "MEMBRO",
                name: "Carlos Alves",
                waiting_days: 4,
                assigned_to: { id: 3, name: "Secretaria" },
              }),
              lead(14, { type: "CONTATO", name: null, waiting_days: 1 }),
            ],
          }),
        ),
      );

      renderAdmin("/admin");

      const section = (
        await screen.findByRole("heading", { name: "Contatos parados há mais de 3 dias" })
      ).closest("section") as HTMLElement;
      const items = await within(section).findAllByRole("listitem");
      expect(items.map((item) => item.textContent)).toEqual([
        "Mariana SouzaSou visitante · Sem responsávelAguardando atendimento há 5 dias",
        "Carlos AlvesQuero ser membro · SecretariaAguardando atendimento há 4 dias",
        "AnônimoFale conosco · Sem responsávelAguardando atendimento há 1 dia",
      ]);
      expect(within(items[0] as HTMLElement).getByRole("link")).toHaveAttribute(
        "href",
        "/admin/contatos/12",
      );
      expect(within(section).getByRole("link", { name: "Ver todos" })).toHaveAttribute(
        "href",
        "/admin/contatos",
      );
    });

    it("BR-010 ignora o contato do dia-limite que ainda não completou 3 dias (waiting_days nulo), sem derrubar o bloco", async () => {
      mockMe(userFixture("SECRETARIA"));
      server.use(
        http.get("*/api/admin/leads", () =>
          HttpResponse.json({
            // O filtro `to` é por data; a API só marca `waiting_days` depois de 3 dias completos
            data: [lead(12), lead(13, { name: "Chegou ontem", waiting_days: null })],
          }),
        ),
      );

      renderAdmin("/admin");

      expect(await screen.findByText("Mariana Souza")).toBeVisible();
      expect(screen.queryByText("Chegou ontem")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Não foi possível carregar os contatos agora."),
      ).not.toBeInTheDocument();
    });

    it("sem contatos parados, comemora", async () => {
      mockMe(userFixture("SECRETARIA"));
      server.use(http.get("*/api/admin/leads", () => HttpResponse.json({ data: [] })));

      renderAdmin("/admin");

      expect(
        await screen.findByText("Nenhum contato esperando há mais de 3 dias. Bom trabalho!"),
      ).toBeVisible();
    });

    it("some em silêncio enquanto a API de contatos ainda não existe (404)", async () => {
      mockMe(userFixture("SECRETARIA"));

      renderAdmin("/admin");

      await shortcutNames();
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: "Contatos parados há mais de 3 dias" }),
        ).not.toBeInTheDocument(),
      );
    });

    it("falha do servidor mostra o erro com 'Tentar novamente'", async () => {
      const user = userEvent.setup();
      mockMe(userFixture("SECRETARIA"));
      let calls = 0;
      server.use(
        http.get("*/api/admin/leads", ({ request }) => {
          // Só a lista de parados (a que tem `to`) falha; as contagens do resumo e do menu seguem a sua vida
          if (!new URL(request.url).searchParams.has("to")) {
            return HttpResponse.json({
              data: [],
              meta: { page: 1, per_page: 1, total: 0, last_page: 1 },
            });
          }
          calls += 1;
          return calls === 1
            ? HttpResponse.json(
                {
                  error: {
                    code: "INTERNAL_ERROR",
                    message: "Algo deu errado.",
                    details: [],
                    traceId: "t",
                  },
                },
                { status: 500 },
              )
            : HttpResponse.json({ data: [lead(12)] });
        }),
      );
      resetQueryCache();

      renderAdmin("/admin");

      expect(await screen.findByText("Não foi possível carregar os contatos agora.")).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
      expect(await screen.findByText("Mariana Souza")).toBeVisible();
    });

    it("quem não lê a caixa geral nem pede os contatos", async () => {
      mockMe(userFixture("ORACAO"));
      let calls = 0;
      server.use(
        http.get("*/api/admin/leads", ({ request }) => {
          // A caixa de oração, que ela lê, é pedida para o resumo e o menu; a geral não
          if (new URL(request.url).searchParams.get("inbox") === "geral") calls += 1;
          return HttpResponse.json({
            data: [],
            meta: { page: 1, per_page: 1, total: 0, last_page: 1 },
          });
        }),
      );

      renderAdmin("/admin");

      await shortcutNames();
      expect(calls).toBe(0);
    });
  });
});

const eventsOn = () => useSnapshots({ settings: settingsFixture({ features: { events: true } }) });

/** `GET /api/admin/leads`: a contagem de novos por caixa (meta.total) e, no mais, nenhum contato parado. */
const mockLeadCounts = (counts: { geral: number; oracao: number }) =>
  server.use(
    http.get("*/api/admin/leads", ({ request }) => {
      const inbox =
        new URL(request.url).searchParams.get("inbox") === "oracao" ? "oracao" : "geral";
      return HttpResponse.json({
        data: [],
        meta: { page: 1, per_page: 1, total: counts[inbox], last_page: 1 },
      });
    }),
  );

const emptyPage = { page: 1, per_page: 1, total: 0, last_page: 1 };

const spotsEvent = (registration: object) => ({
  data: [{ id: 47, title: "Retiro de jovens", registration }],
  meta: { page: 1, per_page: 1, total: 1, last_page: 1 },
});

describe("Resumo do Início", () => {
  it("mostra os números do dia para quem pode abrir cada um", async () => {
    mockMe(userFixture("SECRETARIA"));
    eventsOn();
    mockLeadCounts({ geral: 3, oracao: 1 });
    server.use(
      http.get("*/api/admin/registrations/today", () =>
        HttpResponse.json({ data: [], meta: { total: 4 } }),
      ),
      http.get("*/api/admin/events", () =>
        HttpResponse.json(spotsEvent({ spots_total: 40, spots_left: 18 })),
      ),
    );

    renderAdmin("/admin");

    const summary = await screen.findByRole("region", { name: "Resumo" });
    // A secretaria não lê a caixa de oração: o cartão não existe
    await waitFor(() =>
      expect(
        within(summary)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual([
        "Contatos novos3Abrir contatos",
        "Inscrições hoje4Ver inscritos",
        "Vagas no próximo evento18Ver evento",
      ]),
    );
    expect(within(summary).getByRole("link", { name: /Contatos novos/ })).toHaveAttribute(
      "href",
      "/admin/contatos",
    );
    // Quem lê inscritos abre o evento pela lista de inscritos
    expect(within(summary).getByRole("link", { name: /Vagas no próximo evento/ })).toHaveAttribute(
      "href",
      "/admin/eventos/47/inscritos",
    );
  });

  it("pede 1 linha por caixa, status NOVO, e lê o total", async () => {
    mockMe(userFixture("PASTORAL"));
    const urls: URL[] = [];
    server.use(
      http.get("*/api/admin/leads", ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json({
          data: [],
          meta: { page: 1, per_page: 1, total: 7, last_page: 1 },
        });
      }),
    );

    renderAdmin("/admin");

    const summary = await screen.findByRole("region", { name: "Resumo" });
    expect(
      await within(summary).findByRole("link", { name: /Pedidos de oração novos/ }),
    ).toHaveTextContent("7");
    const counts = urls.filter((url) => url.searchParams.get("per_page") === "1");
    expect(
      counts
        .map((url) => `${url.searchParams.get("inbox")}:${url.searchParams.get("status")}`)
        .sort(),
    ).toEqual(["geral:NOVO", "oracao:NOVO"]);
  });

  it("sem a flag de eventos não mostra inscrições nem vagas, nem pede essas rotas", async () => {
    mockMe(userFixture("SECRETARIA"));
    mockLeadCounts({ geral: 2, oracao: 0 });
    let calls = 0;
    server.use(
      http.get(
        "*/api/admin/registrations/today",
        () => (calls++, HttpResponse.json({ data: [], meta: { total: 0 } })),
      ),
      http.get("*/api/admin/events", () => (calls++, HttpResponse.json({ data: [] }))),
    );

    renderAdmin("/admin");

    const summary = await screen.findByRole("region", { name: "Resumo" });
    await within(summary).findByText("2");
    expect(within(summary).queryByText("Inscrições hoje")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Vagas no próximo evento")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Inscrições de hoje" })).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("evento sem limite de vagas mostra 'Sem limite'", async () => {
    mockMe(userFixture("COMUNICACAO"));
    eventsOn();
    server.use(
      http.get("*/api/admin/registrations/today", () =>
        HttpResponse.json({ data: [], meta: { total: 0 } }),
      ),
      http.get("*/api/admin/events", () =>
        HttpResponse.json(spotsEvent({ spots_total: null, spots_left: null })),
      ),
    );

    renderAdmin("/admin");

    const card = await screen.findByRole("link", { name: /Vagas no próximo evento/ });
    await waitFor(() => expect(card).toHaveTextContent("Sem limite"));
  });

  it("sem evento aberto, o cartão de vagas mostra um traço e leva à lista de eventos", async () => {
    mockMe(userFixture("COMUNICACAO"));
    eventsOn();
    server.use(
      http.get("*/api/admin/registrations/today", () =>
        HttpResponse.json({ data: [], meta: { total: 0 } }),
      ),
      http.get("*/api/admin/events", () => HttpResponse.json({ data: [], meta: emptyPage })),
    );

    renderAdmin("/admin");

    const card = await screen.findByRole("link", { name: /Vagas no próximo evento/ });
    await waitFor(() => expect(card).toHaveTextContent("—"));
    expect(card).toHaveTextContent("nenhum evento com inscrições abertas");
    expect(card).toHaveAttribute("href", "/admin/eventos");
  });

  it("um número que falha mostra um traço, sem derrubar o resto do Início", async () => {
    mockMe(userFixture("SECRETARIA"));
    server.use(http.get("*/api/admin/leads", () => HttpResponse.error()));

    renderAdmin("/admin");

    const card = await screen.findByRole("link", { name: /Contatos novos/ });
    await waitFor(() => expect(card).toHaveTextContent("—"));
    expect(card).toHaveTextContent("indisponível");
    expect(await screen.findByRole("region", { name: "Atalhos" })).toBeVisible();
  });

  it("quem não vê nenhum número não tem a seção", async () => {
    mockMe(userFixture("TESOURARIA"));

    renderAdmin("/admin");

    await shortcutNames();
    expect(screen.queryByRole("region", { name: "Resumo" })).not.toBeInTheDocument();
  });
});

describe("Inscrições de hoje no Início", () => {
  const error500 = {
    error: { code: "INTERNAL_ERROR", message: "Algo deu errado.", details: [], traceId: "t" },
  };

  it("lista hora, nome abreviado e evento, e avisa quando há mais do que as mostradas", async () => {
    mockMe(userFixture("COMUNICACAO"));
    eventsOn();
    server.use(
      http.get("*/api/admin/registrations/today", () =>
        HttpResponse.json({
          data: [
            {
              id: 2,
              created_at: "2026-10-24T18:27:00Z",
              name: "Beatriz C.",
              event: { id: 47, title: "Retiro de jovens" },
            },
            {
              id: 1,
              created_at: "2026-10-24T12:12:00Z",
              name: "Pedro H.",
              event: { id: 47, title: "Retiro de jovens" },
            },
          ],
          meta: { total: 12 },
        }),
      ),
    );

    renderAdmin("/admin");

    const table = await screen.findByRole("table", { name: "Inscrições de hoje" });
    expect(
      within(table)
        .getAllByRole("row")
        .map((row) => row.textContent),
    ).toEqual([
      "HoraNomeEvento",
      "15h27Beatriz C.Retiro de jovens",
      "09h12Pedro H.Retiro de jovens",
    ]);
    expect(screen.getByText("e mais 10 inscrições hoje")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver inscritos" })).toHaveAttribute(
      "href",
      "/admin/eventos",
    );
  });

  it("sem inscrições hoje, diz isso", async () => {
    mockMe(userFixture("COMUNICACAO"));
    eventsOn();
    server.use(
      http.get("*/api/admin/registrations/today", () =>
        HttpResponse.json({ data: [], meta: { total: 0 } }),
      ),
    );

    renderAdmin("/admin");

    expect(await screen.findByText("Nenhuma inscrição hoje.")).toBeVisible();
  });

  it("falha do servidor mostra o erro com 'Tentar novamente'", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("COMUNICACAO"));
    eventsOn();
    let calls = 0;
    server.use(
      http.get("*/api/admin/registrations/today", () => {
        calls += 1;
        // O cartão do Resumo e o bloco pedem a mesma rota (uma consulta só, uma chamada); o reenvio é a segunda
        return calls === 1
          ? HttpResponse.json(error500, { status: 500 })
          : HttpResponse.json({ data: [], meta: { total: 0 } });
      }),
    );

    renderAdmin("/admin");

    const block = (await screen.findByRole("heading", { name: "Inscrições de hoje" })).closest(
      "section",
    ) as HTMLElement;
    expect(
      await within(block).findByText("Não foi possível carregar as inscrições de hoje."),
    ).toBeVisible();
    await user.click(within(block).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma inscrição hoje.")).toBeVisible();
  });

  it("quem não lê inscritos não pede as inscrições, mesmo com eventos ligados", async () => {
    mockMe(userFixture("PASTORAL"));
    eventsOn();
    let calls = 0;
    server.use(
      http.get(
        "*/api/admin/registrations/today",
        () => (calls++, HttpResponse.json({ data: [], meta: { total: 0 } })),
      ),
    );

    renderAdmin("/admin");

    await shortcutNames();
    expect(calls).toBe(0);
  });
});

describe("Nesta semana no Início", () => {
  const { next, last } = sundaysAround();
  const bulletin = (overrides: object = {}) => ({
    id: 9,
    edition_number: 41,
    reference_date: next,
    title: "Boletim",
    summary_text: null,
    pdf_url: "/x.pdf",
    pdf_size_bytes: 10,
    published_at: "2026-10-20T12:00:00Z",
    status: "PUBLICADO",
    updated_at: null,
    updated_by: null,
    ...overrides,
  });
  const post = (overrides: object = {}) => ({
    id: 5,
    title: "Mensagem",
    slug: "mensagem",
    excerpt: "x",
    author_display: null,
    youtube_video_id: null,
    published_at: `${last}T15:00:00Z`,
    body: "<p>x</p>",
    youtube_url: null,
    status: "PUBLICADO",
    updated_at: null,
    updated_by: null,
    ...overrides,
  });
  const list = (data: object[]) =>
    HttpResponse.json({ data, meta: { page: 1, per_page: 20, total: data.length, last_page: 1 } });
  const weekSection = async () =>
    (await screen.findByRole("heading", { name: "Nesta semana" })).closest(
      "section",
    ) as HTMLElement;

  it("sem o boletim de domingo, chama para publicar; sem a Palavra Viva, chama para escrever", async () => {
    mockMe(userFixture("COMUNICACAO"));
    server.use(
      http.get("*/api/admin/bulletins", () => list([bulletin({ reference_date: "2020-01-05" })])),
      http.get("*/api/admin/palavra-viva", () =>
        list([post({ published_at: "2020-01-05T12:00:00Z" })]),
      ),
    );

    renderAdmin("/admin");

    const week = await weekSection();
    expect(
      await within(week).findByText("O boletim de domingo ainda não foi publicado."),
    ).toBeVisible();
    expect(within(week).getByRole("link", { name: "Publicar boletim" })).toHaveAttribute(
      "href",
      "/admin/boletins/novo",
    );
    expect(
      within(week).getByText("A Palavra Viva de domingo ainda não foi publicada."),
    ).toBeVisible();
    expect(within(week).getByRole("link", { name: "Nova mensagem" })).toHaveAttribute(
      "href",
      "/admin/palavra-viva/nova",
    );
  });

  it("com o boletim do domingo e a mensagem da semana publicados, mostra os dois", async () => {
    mockMe(userFixture("COMUNICACAO"));
    server.use(
      http.get("*/api/admin/bulletins", () => list([bulletin()])),
      http.get("*/api/admin/palavra-viva", () => list([post()])),
    );

    renderAdmin("/admin");

    const week = await weekSection();
    expect(await within(week).findByText("O boletim de domingo foi publicado.")).toBeVisible();
    expect(within(week).getByRole("link", { name: "Ver boletim" })).toHaveAttribute(
      "href",
      "/admin/boletins/9",
    );
    expect(await within(week).findByText("Palavra Viva de domingo publicada")).toBeVisible();
    expect(within(week).getByRole("link", { name: "Ver mensagem" })).toHaveAttribute(
      "href",
      "/admin/palavra-viva/5",
    );
  });

  it("boletim agendado não conta como publicado", async () => {
    mockMe(userFixture("COMUNICACAO"));
    server.use(
      http.get("*/api/admin/bulletins", () => list([bulletin({ status: "AGENDADO" })])),
      http.get("*/api/admin/palavra-viva", () => list([])),
    );

    renderAdmin("/admin");

    expect(await screen.findByText("O boletim de domingo está agendado.")).toBeVisible();
  });

  it("a Pastoral (só Palavra Viva) não vê nem pede o boletim", async () => {
    mockMe(userFixture("PASTORAL"));
    let bulletinCalls = 0;
    server.use(
      http.get("*/api/admin/bulletins", () => (bulletinCalls++, list([]))),
      http.get("*/api/admin/palavra-viva", () => list([])),
    );

    renderAdmin("/admin");

    const week = await weekSection();
    expect(
      await within(week).findByText("A Palavra Viva de domingo ainda não foi publicada."),
    ).toBeVisible();
    expect(within(week).queryByText(/boletim/i)).not.toBeInTheDocument();
    expect(bulletinCalls).toBe(0);
  });

  it("quem não publica nada não tem a seção", async () => {
    mockMe(userFixture("SECRETARIA"));

    renderAdmin("/admin");

    await shortcutNames();
    expect(screen.queryByRole("heading", { name: "Nesta semana" })).not.toBeInTheDocument();
  });
});

describe("Selos de novos no menu", () => {
  it("mostra quantos contatos e pedidos de oração são novos, com o texto para leitor de tela", async () => {
    mockMe(userFixture("PASTORAL"));
    mockLeadCounts({ geral: 3, oracao: 1 });

    renderAdmin("/admin");

    expect(await screen.findByRole("link", { name: "Contatos 3 novos" })).toHaveAttribute(
      "href",
      "/admin/contatos",
    );
    expect(await screen.findByRole("link", { name: "Pedidos de oração 1 novo" })).toHaveAttribute(
      "href",
      "/admin/oracao",
    );
  });

  it("sem novos, o item não tem selo", async () => {
    mockMe(userFixture("SECRETARIA"));
    mockLeadCounts({ geral: 0, oracao: 0 });

    renderAdmin("/admin");

    await screen.findByRole("region", { name: "Resumo" });
    expect(await screen.findByRole("link", { name: "Contatos" })).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Painel" })).queryByText(/novos?$/),
    ).not.toBeInTheDocument();
  });
});

describe("Usuários (diretório somente leitura)", () => {
  const person = (overrides: object) => ({
    ...userFixture("SECRETARIA"),
    is_active: true,
    last_login_at: null,
    ...overrides,
  });

  beforeEach(() => {
    mockMe(
      userFixture("PASTORAL", { id: 1, name: "Pr. Joselito Sena", email: "pastor@pibls.test" }),
    );
  });

  it("lista nome, papel, áreas e último acesso, marca 'Você' e avisa que é só consulta", async () => {
    server.use(
      http.get("*/api/admin/users", () =>
        HttpResponse.json({
          data: [
            person({
              ...userFixture("PASTORAL"),
              id: 1,
              name: "Pr. Joselito Sena",
              last_login_at: "2020-03-18T12:00:00Z",
            }),
            person({ id: 2, name: "Ana Secretaria" }),
            person({
              ...userFixture("LIDER_MINISTERIO"),
              id: 3,
              name: "Bruno Líder",
              is_active: false,
              last_login_at: "2020-03-18T12:00:00Z",
            }),
          ],
          meta: { page: 1, per_page: 100, total: 3, last_page: 1 },
        }),
      ),
    );

    const { container } = renderAdmin("/admin/usuarios");

    expect(await screen.findByRole("heading", { name: "3 pessoas com acesso" })).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent("Esta lista é só para consulta.");

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);

    const [pastor, secretaria, leader] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(pastor).getByText("Você")).toBeVisible();
    expect(within(pastor).getByText("Pastoral")).toBeVisible();
    expect(
      within(pastor)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Contatos (só consulta)",
      "Pedidos de oração (só consulta)",
      "Palavra Viva",
      "Lista de usuários",
    ]);
    expect(within(pastor).getByText("18/03/2020")).toBeVisible();

    expect(within(secretaria).getByText("Nunca entrou")).toBeVisible();
    expect(within(secretaria).queryByText("Você")).not.toBeInTheDocument();
    expect(within(secretaria).getByText("Contatos")).toBeVisible();

    expect(within(leader).getByText("Desativado")).toBeVisible();
    expect(within(leader).getByText("Liderança de ministério")).toBeVisible();
    expect(
      within(leader)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Eventos do seu ministério", "Inscrições do seu ministério"]);

    await expectNoA11yViolations(container);
  });

  it("não tem botões de criar, editar ou desativar (BR-077)", async () => {
    server.use(
      http.get("*/api/admin/users", () =>
        HttpResponse.json({
          data: [person({ id: 2, name: "Ana Secretaria" })],
          meta: { page: 1, per_page: 100, total: 1, last_page: 1 },
        }),
      ),
    );

    renderAdmin("/admin/usuarios");

    await screen.findByText("1 pessoa com acesso");
    const main = screen.getByRole("main");
    expect(within(main).queryByRole("button")).not.toBeInTheDocument();
  });

  it("falha ao carregar mostra o erro com 'Tentar novamente'", async () => {
    server.use(http.get("*/api/admin/users", () => HttpResponse.error()));

    renderAdmin("/admin/usuarios");

    expect(await screen.findByText("Não foi possível carregar a lista de usuários.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });
});
