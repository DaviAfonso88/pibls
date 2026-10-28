import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import { resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { activityLines, leadFields } from "../components/lead-detail";
import { filtersFromParams, paramsFromFilters } from "../components/inbox-list";
import type { LeadDetail } from "../admin-api";

beforeEach(() => {
  resetQueryCache();
  useSnapshots();
  mockAdminDefaults();
  server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
});

const meta = (page = 1, lastPage = 1, total = 0, perPage = 25) => ({
  page,
  per_page: perPage,
  total,
  last_page: lastPage,
});

function item(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "VISITANTE",
    status: "NOVO",
    name: `Pessoa ${id}`,
    phone: "+5531999990000",
    created_at: "2026-10-15T22:48:00Z", // 15/10 · 19h48 em Brasília
    waiting_days: null,
    assigned_to: null,
    ...overrides,
  };
}

function detail(id: number, overrides: Record<string, unknown> = {}) {
  return {
    ...item(id),
    email: null,
    neighborhood: "Centro",
    wants_visit: true,
    wants_cell_group: false,
    group: { id: 4, name: "Homens (UMHBB)" },
    from_other_baptist_church: null,
    ministry: null,
    message: "Gostamos muito do culto.",
    consent_at: "2026-10-15T22:48:00Z",
    consent_version: "1.0",
    whatsapp_url: "https://wa.me/5531999990000",
    activities: [],
    ...overrides,
  };
}

function mockList(data: unknown[], listMeta = meta(1, 1, data.length)) {
  const requests: URL[] = [];
  server.use(
    http.get("*/api/admin/leads", ({ request }) => {
      const url = new URL(request.url);
      // A contagem de novos do menu (1 linha, status NOVO) não é a lista da tela
      if (url.searchParams.get("per_page") !== "1") requests.push(url);
      return HttpResponse.json({ data, meta: listMeta });
    }),
  );
  return requests;
}

const apiError = (code: string, message: string, status: number, details: object[] = []) =>
  HttpResponse.json({ error: { code, message, details, traceId: "t" } }, { status });

describe("filtros na URL", () => {
  it("lê os filtros do endereço e só escreve na URL o que difere do padrão", () => {
    const params = new URLSearchParams("tipo=VISITANTE&status=NOVO&resp=me&q=maria&pagina=3");

    expect(filtersFromParams(params, "geral")).toEqual({
      type: "VISITANTE",
      status: "NOVO",
      assignee: "me",
      q: "maria",
      page: 3,
    });
    expect(filtersFromParams(new URLSearchParams(), "geral")).toEqual({
      type: "",
      status: "ABERTOS",
      assignee: "",
      q: "",
      page: 1,
    });
    // a caixa de oração não tem tipo; página inválida volta à 1
    expect(
      filtersFromParams(new URLSearchParams("tipo=VISITANTE&pagina=0"), "oracao"),
    ).toMatchObject({
      type: "",
      page: 1,
    });
    expect(
      paramsFromFilters({ type: "", status: "ABERTOS", assignee: "", q: " " }).toString(),
    ).toBe("");
    expect(
      paramsFromFilters({ type: "MEMBRO", status: "", assignee: "none", q: "ana" }).toString(),
    ).toBe("tipo=MEMBRO&status=&resp=none&q=ana");
  });
});

describe("Caixa geral", () => {
  it("lista tipo, nome, data, status e responsável, e pede só os contatos abertos da caixa geral", async () => {
    mockMe(userFixture("SECRETARIA"));
    const requests = mockList(
      [
        item(1, {
          type: "MEMBRO",
          name: "Carlos Alves",
          status: "EM_ATENDIMENTO",
          assigned_to: { id: 3, name: "Secretaria", is_active: true },
        }),
        item(2, { name: null, type: "CONTATO" }),
        item(3, {
          status: "CONCLUIDO",
          assigned_to: { id: 9, name: "Ex Atendente", is_active: false },
        }),
      ],
      meta(1, 1, 3),
    );

    const { container } = renderAdmin("/admin/contatos");

    expect(await screen.findByRole("heading", { name: "3 contatos abertos" })).toBeVisible();
    const params = requests[0]?.searchParams;
    expect(params?.get("inbox")).toBe("geral");
    expect(params?.get("status")).toBe("ABERTOS");
    expect(params?.has("page")).toBe(false);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "Quero ser membroCarlos Alves15/10 · 19h48Em atendimentoSecretaria",
      "Fale conoscoAnônimo15/10 · 19h48NovoSem responsável",
      "Sou visitantePessoa 315/10 · 19h48ConcluídoEx Atendente (inativo)",
    ]);
    expect(
      within(rows[0] as HTMLElement).getByRole("link", { name: "Carlos Alves" }),
    ).toHaveAttribute("href", "/admin/contatos/1");
    await expectNoA11yViolations(container);
  });

  it("destaca quem espera há mais de 3 dias (BR-010)", async () => {
    mockMe(userFixture("SECRETARIA"));
    mockList([item(1, { waiting_days: 5 }), item(2)]);

    renderAdmin("/admin/contatos");

    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(within(rows[0] as HTMLElement).getByText("Aguardando há 5 dias")).toBeVisible();
    expect(rows[0]?.className).toContain("bg-warning");
    expect(within(rows[1] as HTMLElement).queryByText(/Aguardando/)).not.toBeInTheDocument();
    expect(rows[1]?.className).not.toContain("bg-warning");
    expect(screen.getByText("Destaque: sem atendimento há mais de 3 dias")).toBeVisible();
  });

  it("os filtros vão para a URL e para a API; a busca e o status 'Todos' também", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA"));
    const requests = mockList([item(1)]);

    const { router } = renderAdmin("/admin/contatos");
    await screen.findByRole("heading", { name: "1 contato aberto" });

    await user.selectOptions(screen.getByLabelText("Tipo"), "VISITANTE");
    await user.selectOptions(screen.getByLabelText("Status"), "NOVO");
    await user.selectOptions(screen.getByLabelText("Responsável"), "me");
    await user.type(screen.getByLabelText("Buscar por nome ou telefone"), "maria");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));

    await waitFor(() =>
      expect(router.state.location.search).toBe("?tipo=VISITANTE&status=NOVO&resp=me&q=maria"),
    );
    await waitFor(() => expect(requests.length).toBeGreaterThan(1));
    const sent = requests.at(-1)?.searchParams;
    expect([
      sent?.get("type"),
      sent?.get("status"),
      sent?.get("assigned_to"),
      sent?.get("q"),
    ]).toEqual(["VISITANTE", "NOVO", "me", "maria"]);
    // sem o filtro de abertos, o título é o do total
    expect(await screen.findByRole("heading", { name: "1 contato" })).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Status"), "");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(router.state.location.search).toContain("status="));
  });

  it("abre já com os filtros do endereço marcados nos campos", async () => {
    mockMe(userFixture("SECRETARIA"));
    const requests = mockList([]);

    renderAdmin("/admin/contatos?tipo=MEMBRO&status=CONCLUIDO&resp=none&q=ana");

    expect(await screen.findByLabelText("Tipo")).toHaveValue("MEMBRO");
    expect(screen.getByLabelText("Status")).toHaveValue("CONCLUIDO");
    expect(screen.getByLabelText("Responsável")).toHaveValue("none");
    expect(screen.getByLabelText("Buscar por nome ou telefone")).toHaveValue("ana");
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0]?.searchParams.get("assigned_to")).toBe("none");
  });

  it("pagina pela URL, com a página atual marcada", async () => {
    mockMe(userFixture("SECRETARIA"));
    mockList([item(1)], meta(2, 3, 60));

    renderAdmin("/admin/contatos?pagina=2");

    const nav = await screen.findByRole("navigation", { name: "Páginas" });
    expect(within(nav).getByText("Mostrando 26–50 de 60")).toBeVisible();
    expect(within(nav).getByRole("link", { name: "Página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Página 3" })).toHaveAttribute(
      "href",
      "/admin/contatos?pagina=3",
    );
    expect(within(nav).getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/contatos",
    );
    expect(within(nav).getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/contatos?pagina=3",
    );
  });

  it("sem resultados mostra o vazio; com falha, o erro e 'Tentar novamente'", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA"));
    let calls = 0;
    server.use(
      http.get("*/api/admin/leads", () => {
        calls += 1;
        return calls === 1
          ? apiError("INTERNAL_ERROR", "Algo deu errado.", 500)
          : HttpResponse.json({ data: [], meta: meta() });
      }),
    );

    renderAdmin("/admin/contatos");

    expect(await screen.findByText("Não foi possível carregar os contatos agora.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhum contato com esses filtros.")).toBeVisible();
  });
});

describe("Caixa de oração (BR-007)", () => {
  it("pede a caixa de oração, sem filtro de tipo, e leva ao detalhe em /admin/oracao", async () => {
    mockMe(userFixture("ORACAO"));
    const requests = mockList([item(7, { type: "ORACAO", name: null })]);

    renderAdmin("/admin/oracao");

    expect(await screen.findByRole("heading", { name: "1 pedido aberto" })).toBeVisible();
    expect(requests[0]?.searchParams.get("inbox")).toBe("oracao");
    expect(screen.queryByLabelText("Tipo")).not.toBeInTheDocument();
    // a tabela e a lista de cartões do celular repetem o link
    for (const link of screen.getAllByRole("link", { name: "Anônimo" })) {
      expect(link).toHaveAttribute("href", "/admin/oracao/7");
    }
  });

  it.each([
    ["/admin/contatos", "ORACAO"],
    ["/admin/oracao", "SECRETARIA"],
    ["/admin/contatos", "COMUNICACAO"],
    ["/admin/oracao", "TESOURARIA"],
  ])(
    "%s mostra 'Você não tem acesso a esta área' para %s, sem nem pedir a lista",
    async (path, role) => {
      mockMe(userFixture(role));
      let calls = 0;
      server.use(
        http.get("*/api/admin/leads", ({ request }) => {
          // A contagem de novos do menu (per_page=1) é de quem lê a caixa; a lista da tela, não
          if (new URL(request.url).searchParams.get("per_page") !== "1") calls += 1;
          return HttpResponse.json({ data: [], meta: meta() });
        }),
      );

      renderAdmin(path);

      expect(
        await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
      ).toBeVisible();
      expect(calls).toBe(0);
    },
  );

  it("a pastoral lê as duas caixas", async () => {
    mockMe(userFixture("PASTORAL"));
    mockList([item(1)]);

    renderAdmin("/admin/contatos");
    expect(await screen.findByRole("heading", { name: "1 contato aberto" })).toBeVisible();
  });
});

describe("Detalhe do contato", () => {
  function mockLead(id: number, data: Record<string, unknown>) {
    const calls: Array<{ method: string; body: unknown }> = [];
    let current = data;
    server.use(
      http.get(`*/api/admin/leads/${id}`, () => HttpResponse.json({ data: current })),
      http.get("*/api/admin/leads/assignees", () =>
        HttpResponse.json({
          data: [
            { id: 3, name: "Ana Secretaria" },
            { id: 7, name: "Rafael Souza" },
          ],
        }),
      ),
      http.patch(`*/api/admin/leads/${id}`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        calls.push({ method: "PATCH", body });
        current = { ...current, ...("status" in body ? { status: body.status } : {}) };
        return HttpResponse.json({ data: current });
      }),
      http.delete(`*/api/admin/leads/${id}`, async ({ request }) => {
        calls.push({ method: "DELETE", body: await request.json() });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return calls;
  }

  it("mostra os dados do tipo, a mensagem, o WhatsApp, o consentimento e o histórico do mais novo ao mais antigo", async () => {
    mockMe(userFixture("SECRETARIA"));
    mockLead(
      5,
      detail(5, {
        name: "Maria Souza",
        waiting_days: 5,
        activities: [
          {
            id: 1,
            actor: { id: 3, name: "Ana Secretaria" },
            from_status: "NOVO",
            to_status: "EM_ATENDIMENTO",
            assigned_to: 3,
            note: null,
            created_at: "2026-10-16T13:00:00Z",
          },
          {
            id: 2,
            actor: { id: 3, name: "Ana Secretaria" },
            from_status: null,
            to_status: null,
            assigned_to: 3,
            note: "Liguei, retorno na quinta.",
            created_at: "2026-10-17T13:00:00Z",
          },
        ],
      }),
    );

    const { container } = renderAdmin("/admin/contatos/5");

    expect(await screen.findByRole("heading", { level: 1, name: "Maria Souza" })).toBeVisible();
    expect(screen.getByText("Aguardando atendimento há 5 dias")).toBeVisible();
    const whatsapp = screen.getByRole("link", { name: /Responder no WhatsApp/ });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/5531999990000");
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", expect.stringContaining("noopener"));

    const data = screen
      .getByRole("heading", { name: "O que a pessoa enviou" })
      .closest("section") as HTMLElement;
    expect(within(data).getByText("(31) 99999-0000")).toBeVisible();
    expect(within(data).getByText("Centro")).toBeVisible();
    expect(within(data).getByText("Homens (UMHBB)")).toBeVisible();
    expect(within(data).getByText("Gostamos muito do culto.")).toBeVisible();
    expect(within(data).getByText(/aceitou a Política de Privacidade versão 1\.0/)).toBeVisible();

    const history = screen
      .getByRole("heading", { name: "Histórico" })
      .closest("section") as HTMLElement;
    expect(
      within(history)
        .getAllByRole("listitem")
        .map((entry) => entry.textContent),
    ).toEqual([
      expect.stringContaining("Anotação de Ana Secretaria"),
      expect.stringContaining("Atendimento iniciado por Ana Secretaria"),
      expect.stringContaining("Contato recebido pelo site"),
    ]);
    expect(within(history).getByText("Liguei, retorno na quinta.")).toBeVisible();
    await expectNoA11yViolations(container);
  });

  it("os campos mudam com o tipo do contato", () => {
    const base = detail(1) as unknown as LeadDetail;

    expect(
      leadFields({
        ...base,
        type: "MEMBRO",
        from_other_baptist_church: false,
        email: "a@b.co",
      }).map((field) => field.label),
    ).toEqual(["WhatsApp", "E-mail", "É membro de outra igreja batista"]);
    expect(
      leadFields({ ...base, type: "MINISTERIO", ministry: { id: 1, name: "Música" } })[0],
    ).toEqual({
      label: "Ministério procurado",
      value: "Música",
    });
    expect(
      leadFields({ ...base, type: "ORACAO", phone: null, email: null }).map((field) => field.value),
    ).toEqual(["Não informado", "Não informado"]);
  });

  it("descreve o histórico em linguagem de gente", () => {
    const at = (from: string | null, to: string | null, note: string | null) =>
      ({
        id: 1,
        actor: { id: 1, name: "Ana" },
        from_status: from,
        to_status: to,
        assigned_to: null,
        note,
        created_at: "2026-10-16T13:00:00Z",
      }) as never;

    expect(activityLines(at("CONCLUIDO", "EM_ATENDIMENTO", null))).toEqual([
      "Atendimento reaberto por Ana",
    ]);
    expect(activityLines(at("EM_ATENDIMENTO", "CONCLUIDO", "ok"))).toEqual([
      "Marcado como concluído por Ana",
      "Anotação de Ana",
    ]);
    expect(activityLines(at("EM_ATENDIMENTO", "NOVO", null))).toEqual(["Devolvido à fila por Ana"]);
    expect(activityLines(at(null, null, null))).toEqual(["Responsável trocado por Ana"]);
  });

  it.each([
    [
      "NOVO",
      ["Começar atendimento"],
      ["Marcar como concluído", "Devolver à fila", "Reabrir atendimento"],
    ],
    [
      "EM_ATENDIMENTO",
      ["Marcar como concluído", "Devolver à fila"],
      ["Começar atendimento", "Reabrir atendimento"],
    ],
    [
      "CONCLUIDO",
      ["Reabrir atendimento"],
      ["Começar atendimento", "Marcar como concluído", "Devolver à fila"],
    ],
  ])("BR-008 em %s oferece só as transições permitidas", async (status, shown, hidden) => {
    mockMe(userFixture("SECRETARIA"));
    mockLead(
      5,
      detail(5, {
        status,
        assigned_to: status === "NOVO" ? null : { id: 7, name: "Rafael Souza", is_active: true },
      }),
    );

    renderAdmin("/admin/contatos/5");

    await screen.findByRole("heading", { level: 1, name: "Pessoa 5" });
    for (const label of shown) expect(screen.getByRole("button", { name: label })).toBeEnabled();
    for (const label of hidden)
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
  });

  it("começar o atendimento manda o status, com o responsável escolhido se houver, e avisa", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA"));
    const calls = mockLead(5, detail(5));

    renderAdmin("/admin/contatos/5");
    await user.click(await screen.findByRole("button", { name: "Começar atendimento" }));

    await waitFor(() =>
      expect(calls).toEqual([{ method: "PATCH", body: { status: "EM_ATENDIMENTO" } }]),
    );
    expect(await screen.findByText("Atendimento atualizado.")).toBeVisible();
    // a tela já mostra o novo status
    expect(await screen.findByRole("button", { name: "Marcar como concluído" })).toBeVisible();
  });

  it("BR-009 o responsável escolhido antes de começar vai junto; 'Eu' é o primeiro da lista", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA", { id: 7, name: "Rafael Souza" }));
    const calls = mockLead(5, detail(5));

    renderAdmin("/admin/contatos/5");
    const select = await screen.findByLabelText("Responsável");
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBeGreaterThan(2));
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Sem responsável", "Eu — Rafael Souza", "Ana Secretaria"]);

    await user.selectOptions(select, "3");
    await user.click(screen.getByRole("button", { name: "Começar atendimento" }));

    await waitFor(() =>
      expect(calls[0]?.body).toEqual({ status: "EM_ATENDIMENTO", assigned_to: 3 }),
    );
  });

  it("trocar o responsável de um contato em atendimento envia na hora", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA", { id: 7, name: "Rafael Souza" }));
    const calls = mockLead(
      5,
      detail(5, {
        status: "EM_ATENDIMENTO",
        assigned_to: { id: 7, name: "Rafael Souza", is_active: true },
      }),
    );

    renderAdmin("/admin/contatos/5");
    const select = await screen.findByLabelText("Responsável");
    await waitFor(() => expect(within(select).getAllByRole("option").length).toBe(2));
    await user.selectOptions(select, "3");

    await waitFor(() => expect(calls).toEqual([{ method: "PATCH", body: { assigned_to: 3 } }]));
  });

  it("BR-012 responsável inativo aparece com '(inativo)' e o aviso para reatribuir", async () => {
    mockMe(userFixture("SECRETARIA"));
    mockLead(
      5,
      detail(5, {
        status: "EM_ATENDIMENTO",
        assigned_to: { id: 99, name: "Ex Atendente", is_active: false },
      }),
    );

    renderAdmin("/admin/contatos/5");

    expect(
      await screen.findByRole("option", { name: "Ex Atendente (inativo)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Responsável inativo. Reatribua este contato.",
    );
  });

  it("BR-008 mostra a frase da API quando ela recusa a mudança", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA"));
    mockLead(5, detail(5));
    server.use(
      http.patch("*/api/admin/leads/5", () =>
        apiError("INVALID_STATUS_TRANSITION", "Mudança de status não permitida.", 409),
      ),
    );

    renderAdmin("/admin/contatos/5");
    await user.click(await screen.findByRole("button", { name: "Começar atendimento" }));

    expect(await screen.findByText("Mudança de status não permitida.")).toBeVisible();
  });

  it("BR-013 a anotação tem contador de 1.000 caracteres, só envia com texto e limpa depois de salvar", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA"));
    const calls = mockLead(5, detail(5));

    renderAdmin("/admin/contatos/5");
    const note = await screen.findByLabelText(/Só a equipe vê/);
    const save = screen.getByRole("button", { name: "Salvar anotação" });

    expect(note).toHaveAttribute("maxlength", "1000");
    expect(save).toBeDisabled();
    expect(screen.getByText("0 de 1.000 caracteres")).toBeVisible();

    await user.type(note, "Liguei hoje.");
    expect(screen.getByText("12 de 1.000 caracteres")).toBeVisible();
    await user.click(save);

    await waitFor(() =>
      expect(calls).toEqual([{ method: "PATCH", body: { note: "Liguei hoje." } }]),
    );
    expect(await screen.findByText("Anotação salva.")).toBeVisible();
    await waitFor(() => expect(note).toHaveValue(""));
  });

  it("FR-077 não guarda rascunho do contato nem da anotação no navegador", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA"));
    mockLead(5, detail(5));
    window.localStorage.clear();

    renderAdmin("/admin/contatos/5");
    await user.type(await screen.findByLabelText(/Só a equipe vê/), "texto sigiloso");

    expect(JSON.stringify({ ...window.localStorage })).not.toContain("sigiloso");
    expect(window.localStorage.length).toBe(0);
  });

  it("quem só lê (pastoral) vê o contato e o WhatsApp, sem atender nem excluir", async () => {
    mockMe(userFixture("PASTORAL"));
    mockLead(5, detail(5));

    renderAdmin("/admin/contatos/5");

    expect(await screen.findByRole("heading", { level: 1, name: "Pessoa 5" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Responder no WhatsApp/ })).toBeVisible();
    expect(screen.getByText("Você pode ler este contato, mas não atendê-lo.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Começar atendimento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar anotação" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Excluir dados desta pessoa" }),
    ).not.toBeInTheDocument();
  });

  it("sem telefone não há botão do WhatsApp (pedido anônimo)", async () => {
    mockMe(userFixture("ORACAO"));
    mockLead(
      8,
      detail(8, {
        type: "ORACAO",
        name: null,
        phone: null,
        whatsapp_url: null,
        message: "Orem por mim.",
      }),
    );

    renderAdmin("/admin/oracao/8");

    expect(await screen.findByRole("heading", { level: 1, name: "Anônimo" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "Pedidos de oração" }),
    ).toHaveAttribute("href", "/admin/oracao");
  });

  describe("exclusão a pedido do titular (BR-081)", () => {
    it("abre o diálogo, só libera o botão com a caixa marcada e exclui com o motivo", async () => {
      const user = userEvent.setup();
      mockMe(userFixture("SECRETARIA"));
      const calls = mockLead(5, detail(5, { name: "Maria Titular" }));

      renderAdmin("/admin/contatos/5");
      await user.click(await screen.findByRole("button", { name: "Excluir dados desta pessoa" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(
        within(dialog).getByRole("heading", { name: "Excluir os dados de Maria Titular?" }),
      ).toBeVisible();
      expect(within(dialog).getByText(/Isso não pode ser desfeito/)).toBeVisible();
      const confirm = within(dialog).getByRole("button", { name: "Excluir definitivamente" });
      expect(confirm).toBeDisabled();

      await user.click(
        within(dialog).getByRole("checkbox", {
          name: "Confirmo que a própria pessoa pediu a exclusão.",
        }),
      );
      expect(confirm).toBeEnabled();
      await user.click(confirm);

      await waitFor(() =>
        expect(calls).toEqual([{ method: "DELETE", body: { reason: "TITULAR_REQUEST" } }]),
      );
      const done = await screen.findByRole("status");
      expect(within(done).getByRole("heading", { name: "Dados excluídos" })).toBeVisible();
      expect(within(done).getByRole("link", { name: "Voltar para contatos" })).toHaveAttribute(
        "href",
        "/admin/contatos",
      );
      expect(screen.queryByText("Maria Titular")).not.toBeInTheDocument();
    });

    it("cancelar não exclui nada", async () => {
      const user = userEvent.setup();
      mockMe(userFixture("SECRETARIA"));
      const calls = mockLead(5, detail(5));

      renderAdmin("/admin/contatos/5");
      await user.click(await screen.findByRole("button", { name: "Excluir dados desta pessoa" }));
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }),
      );

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(calls).toEqual([]);
      expect(screen.getByRole("heading", { level: 1, name: "Pessoa 5" })).toBeVisible();
    });

    it("a ack é pedida de novo a cada vez que o diálogo abre", async () => {
      const user = userEvent.setup();
      mockMe(userFixture("SECRETARIA"));
      mockLead(5, detail(5));

      renderAdmin("/admin/contatos/5");
      const open = await screen.findByRole("button", { name: "Excluir dados desta pessoa" });
      await user.click(open);
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("checkbox"));
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }),
      );
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

      await user.click(open);
      expect(
        within(await screen.findByRole("alertdialog")).getByRole("checkbox"),
      ).not.toBeChecked();
      expect(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Excluir definitivamente",
        }),
      ).toBeDisabled();
    });
  });

  it("BR-007 contato que a API não deixa ver (404) mostra 'Contato não encontrado.'", async () => {
    mockMe(userFixture("SECRETARIA"));
    server.use(
      http.get("*/api/admin/leads/9", () =>
        apiError("NOT_FOUND", "Não encontramos o que você procurou.", 404),
      ),
    );

    renderAdmin("/admin/contatos/9");

    expect(await screen.findByText("Contato não encontrado.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "Contatos" }),
    ).toHaveAttribute("href", "/admin/contatos");
  });

  it("um endereço com id que não é número cai no 404 do painel", async () => {
    mockMe(userFixture("SECRETARIA"));

    renderAdmin("/admin/contatos/abc");

    expect(
      await screen.findByRole("heading", { name: "Esta página do painel não existe" }),
    ).toBeVisible();
  });

  it("falha ao carregar oferece 'Tentar novamente'", async () => {
    mockMe(userFixture("SECRETARIA"));
    server.use(http.get("*/api/admin/leads/5", () => HttpResponse.error()));

    renderAdmin("/admin/contatos/5");

    expect(await screen.findByText("Não foi possível carregar este contato agora.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });
});
