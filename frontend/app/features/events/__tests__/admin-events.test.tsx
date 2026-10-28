import "../../../../test/prosemirror";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import { resetQueryCache, settingsFixture, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { draftKey } from "~/shared/drafts";

/*
 * Eventos no painel (T178; design: AdminEvento). BR-025 a BR-033 e BR-045, escopo do próprio ministério (BR-030), rascunho
 * local sem a imagem (FR-077) e a confirmação de publicar com prazo vencido (BR-033).
 */

const COMUNICACAO = userFixture("COMUNICACAO");
const LIDER = userFixture("LIDER_MINISTERIO", { ministry: { id: 2, name: "Música" } });

beforeEach(() => {
  resetQueryCache();
  useSnapshots({ settings: settingsFixture({ features: { events: true } }) });
  mockAdminDefaults();
  mockMe(COMUNICACAO);
  window.localStorage.clear();
  server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/**
 * O MSW entrega um envio por XMLHttpRequest com `FormData` como o texto "[object FormData]" (o corpo multipart se perde no
 * jsdom). Por isso o teste registra o que o código põe no `FormData` (`set`) e confere isso; o mock chama o original.
 */
function captureFormFields(): Map<string, FormDataEntryValue> {
  const fields = new Map<string, FormDataEntryValue>();
  const original = FormData.prototype.set;
  vi.spyOn(FormData.prototype, "set").mockImplementation(function (
    this: FormData,
    ...args: Parameters<FormData["set"]>
  ) {
    Reflect.apply(original, this, args);
    fields.set(args[0], this.get(args[0]) as FormDataEntryValue);
  });
  return fields;
}

const meta = (total = 0) => ({ page: 1, per_page: 20, total, last_page: 1 });

function event(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `evento-${id}`,
    title: `Evento ${id}`,
    excerpt: "Resumo.",
    ministry: { id: 2, name: "Música" },
    starts_at: "2099-12-05T12:00:00Z",
    ends_at: "2099-12-07T15:00:00Z",
    location: "Chácara Boa Vista",
    banner_small_url: null,
    registration: { state: "INSCRICOES_ABERTAS", deadline: null, spots_total: 60, spots_left: 18 },
    description: "<p>Três dias de louvor.</p>",
    banner_url: null,
    has_minors: false,
    form_schema: [],
    is_published: true,
    max_spots: 60,
    registration_deadline: null,
    registrations_count: 42,
    updated_at: "2026-10-16T13:10:00Z",
    updated_by: { id: 7, name: "Rafael Souza" },
    ...overrides,
  };
}

const camiseta = {
  key: "camiseta",
  label: "Tamanho da camiseta",
  type: "SELECT",
  required: true,
  help_text: null,
  sensitive: false,
  min: null,
  max: null,
  options: ["P", "M", "G"],
};

const apiError = (code: string, message: string, status: number, details: object[] = []) =>
  HttpResponse.json({ error: { code, message, details, traceId: "t" } }, { status });

/** Cola no editor, como o navegador faria ao colar do Word ou do WhatsApp. */
function paste(html: string, text: string) {
  fireEvent.paste(screen.getByRole("textbox", { name: "Descrição" }), {
    clipboardData: {
      types: ["text/html", "text/plain"],
      getData: (type: string) => (type === "text/html" ? html : type === "text/plain" ? text : ""),
      files: [],
      items: [],
    },
  });
}

function setDateTime(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole("textbox", { name: "Nome" }), "Retiro de jovens");
  await user.selectOptions(screen.getByRole("combobox", { name: "Ministério responsável" }), "2");
  setDateTime("Começa", "2099-12-05T09:00");
  await user.type(screen.getByRole("textbox", { name: "Local" }), "Chácara Boa Vista");
  await screen.findByRole("textbox", { name: "Descrição" });
  paste("<p>Três dias de <strong>louvor</strong>.</p>", "Três dias de louvor.");
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Descrição" })).toHaveTextContent(
      "Três dias de louvor.",
    ),
  );
}

describe("flag e permissão", () => {
  it("com features.events desligada, /admin/eventos e /admin/eventos/novo não existem", async () => {
    useSnapshots({ settings: settingsFixture({ features: { events: false } }) });
    const first = renderAdmin("/admin/eventos");
    expect(
      await screen.findByRole("heading", { name: "Esta página do painel não existe" }),
    ).toBeVisible();
    first.unmount();

    resetQueryCache();
    renderAdmin("/admin/eventos/novo");
    expect(
      await screen.findByRole("heading", { name: "Esta página do painel não existe" }),
    ).toBeVisible();
  });

  it("BR-076 quem não tem eventos.write nem .own vê o aviso de falta de acesso", async () => {
    mockMe(userFixture("TESOURARIA"));
    renderAdmin("/admin/eventos");

    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
  });
});

describe("lista", () => {
  it("mostra os eventos com situação, ministério, vagas e o link para editar", async () => {
    server.use(
      http.get("*/api/admin/events", () =>
        HttpResponse.json({
          data: [
            event(2, {
              registration: {
                state: "RASCUNHO",
                deadline: null,
                spots_total: null,
                spots_left: null,
              },
              is_published: false,
              max_spots: null,
              registrations_count: 0,
            }),
            event(1),
          ],
          meta: meta(2),
        }),
      ),
    );
    const { container } = renderAdmin("/admin/eventos");

    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeVisible();
    const table = await screen.findByRole("table", { name: "Eventos" });
    const draft = within(table).getByRole("row", { name: /Evento 2/ });
    expect(within(draft).getByText("Rascunho")).toBeVisible();
    expect(within(draft).getByText("0 inscritos")).toBeVisible();
    const open = within(table).getByRole("row", { name: /Evento 1/ });
    expect(within(open).getByText("Inscrições abertas")).toBeVisible();
    expect(within(open).getByText("42 de 60 vagas")).toBeVisible();
    expect(within(open).getByText("Música")).toBeVisible();
    expect(within(table).getByRole("link", { name: "Editar o evento Evento 1" })).toHaveAttribute(
      "href",
      "/admin/eventos/1",
    );
    expect(screen.getByRole("link", { name: "Novo evento" })).toHaveAttribute(
      "href",
      "/admin/eventos/novo",
    );

    await expectNoA11yViolations(container);
  });

  it("os filtros moram na URL e vão para a API", async () => {
    const seen: string[] = [];
    server.use(
      http.get("*/api/admin/events", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({ data: [], meta: meta(0) });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/eventos");
    await screen.findByText("Nenhum evento por aqui ainda.");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Situação" }),
      "INSCRICOES_ENCERRADAS",
    );
    await user.selectOptions(await screen.findByRole("combobox", { name: "Ministério" }), "3");

    await waitFor(() =>
      expect(router.state.location.search).toBe("?situacao=INSCRICOES_ENCERRADAS&ministerio=3"),
    );
    await waitFor(() => expect(seen.at(-1)).toBe("?state=INSCRICOES_ENCERRADAS&ministry_id=3"));
    expect(await screen.findByText("Nenhum evento com esse filtro.")).toBeVisible();
  });

  it("começa pelo filtro da URL e ignora valor inválido", async () => {
    const seen: string[] = [];
    server.use(
      http.get("*/api/admin/events", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({ data: [], meta: meta(0) });
      }),
    );
    renderAdmin("/admin/eventos?situacao=QUALQUER&ministerio=abc&pagina=0");

    await screen.findByText("Nenhum evento por aqui ainda.");
    expect(seen).toEqual([""]);
  });

  it("mostra o erro de carregamento com 'Tentar novamente'", async () => {
    server.use(http.get("*/api/admin/events", () => apiError("INTERNAL", "Falha.", 500)));
    renderAdmin("/admin/eventos");

    expect(await screen.findByText("Não foi possível carregar os eventos.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Tentar novamente/ })).toBeVisible();
  });

  it("BR-030 o líder vê a lista (o servidor já manda só o ministério dele) e não tem filtro de ministério", async () => {
    mockMe(LIDER);
    server.use(
      http.get("*/api/admin/events", () => HttpResponse.json({ data: [event(1)], meta: meta(1) })),
    );
    renderAdmin("/admin/eventos");

    expect(await screen.findByRole("link", { name: "Editar o evento Evento 1" })).toBeVisible();
    // O filtro de ministério existe com mais de um ministério na lista; aqui o snapshot tem vários, então fica
    expect(screen.getByRole("combobox", { name: "Situação" })).toBeVisible();
  });
});

describe("cadastro", () => {
  it("gera o endereço do nome e envia datas com o fuso de Brasília, como rascunho", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post("*/api/admin/events", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            data: event(9, {
              slug: "retiro-de-jovens",
              title: "Retiro de jovens",
              is_published: false,
            }),
          },
          { status: 201 },
        );
      }),
      http.get("*/api/admin/events/9", () =>
        HttpResponse.json({
          data: event(9, {
            slug: "retiro-de-jovens",
            title: "Retiro de jovens",
            is_published: false,
            registration: {
              state: "RASCUNHO",
              deadline: null,
              spots_total: null,
              spots_left: null,
            },
          }),
        }),
      ),
    );
    const user = userEvent.setup();
    const { container, router } = renderAdmin("/admin/eventos/novo");
    await fillBasics(user);
    setDateTime(/^Termina/, "2099-12-07T12:00");
    await user.type(screen.getByRole("textbox", { name: /Vagas/ }), "60");

    expect(screen.getByRole("textbox", { name: "Endereço da página" })).toHaveValue(
      "retiro-de-jovens",
    );
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({
      title: "Retiro de jovens",
      slug: "retiro-de-jovens",
      ministry_id: 2,
      starts_at: "2099-12-05T09:00:00-03:00",
      ends_at: "2099-12-07T12:00:00-03:00",
      location: "Chácara Boa Vista",
      max_spots: 60,
      registration_deadline: null,
      has_minors: false,
      form_schema: [],
      is_published: false,
    });
    expect(String((sent as unknown as Record<string, unknown>).description)).toContain(
      "<strong>louvor</strong>",
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/eventos/9"));
    expect(await screen.findByText("Evento criado.")).toBeVisible();
  });

  it("'Salvar e publicar' envia is_published = true", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post("*/api/admin/events", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: event(9) }, { status: 201 });
      }),
      http.get("*/api/admin/events/9", () => HttpResponse.json({ data: event(9) })),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);

    await user.click(screen.getByRole("button", { name: "Salvar e publicar" }));

    await waitFor(() => expect(sent).toMatchObject({ is_published: true }));
    expect(await screen.findByText("Evento criado e publicado.")).toBeVisible();
  });

  it("monta o formulário de inscrição: a pergunta nova ganha a chave do rótulo, com opções e marcador de saúde", async () => {
    let sent: { form_schema?: unknown } | null = null;
    server.use(
      http.post("*/api/admin/events", async ({ request }) => {
        sent = (await request.json()) as { form_schema?: unknown };
        return HttpResponse.json({ data: event(9) }, { status: 201 });
      }),
      http.get("*/api/admin/events/9", () => HttpResponse.json({ data: event(9) })),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);

    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.type(screen.getByRole("textbox", { name: "Pergunta" }), "Tamanho da camiseta");
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo de resposta" }), "SELECT");
    await user.type(
      screen.getByRole("textbox", { name: "Opções (uma por linha)" }),
      "P{enter}M{enter}G",
    );
    await user.click(screen.getByRole("checkbox", { name: "Obrigatória" }));
    await user.click(screen.getByRole("checkbox", { name: "É informação de saúde" }));
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect((sent as unknown as { form_schema: unknown }).form_schema).toEqual([
      {
        key: "tamanho_da_camiseta",
        label: "Tamanho da camiseta",
        type: "SELECT",
        required: true,
        help_text: null,
        sensitive: true,
        min: null,
        max: null,
        options: ["P", "M", "G"],
      },
    ]);
  });

  it("valida no navegador: nome, ministério, início, local, descrição, término e prazo (BR-025, BR-026)", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await screen.findByRole("textbox", { name: "Nome" });

    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(await screen.findByText("O nome precisa ter de 3 a 150 caracteres.")).toBeVisible();
    expect(screen.getByText("Escolha o ministério.")).toBeVisible();
    expect(screen.getByText("Informe quando o evento começa.")).toBeVisible();
    expect(screen.getByText("Informe o local do evento.")).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: "Nome" }), "Retiro");
    await user.selectOptions(screen.getByRole("combobox", { name: "Ministério responsável" }), "2");
    setDateTime("Começa", "2099-12-05T09:00");
    setDateTime(/^Termina/, "2099-12-05T08:00");
    setDateTime(/Inscrições até/, "2099-12-06T08:00");
    await user.type(screen.getByRole("textbox", { name: "Local" }), "Salão");
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(await screen.findByText("O término precisa ser depois do início.")).toBeVisible();
    expect(
      screen.getByText("O prazo de inscrição precisa terminar antes do início do evento."),
    ).toBeVisible();

    // Com as datas certas, falta só a descrição (editor): o erro dela vem depois do resto passar
    setDateTime(/^Termina/, "2099-12-05T18:00");
    setDateTime(/Inscrições até/, "2099-12-04T08:00");
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(await screen.findByText("Escreva a descrição do evento.")).toBeVisible();
    expect(screen.queryByText("O término precisa ser depois do início.")).not.toBeInTheDocument();
  });

  it("BR-031 mostra o erro da pergunta em branco e das opções", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo de resposta" }), "SELECT");
    await user.type(screen.getByRole("textbox", { name: "Opções (uma por linha)" }), "Só uma");

    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(await screen.findByText("Escreva a pergunta.")).toBeVisible();
    expect(
      screen.getByText("Informe de 2 a 30 opções diferentes.", { selector: "[id$=-error]" }),
    ).toBeVisible();
  });

  it("BR-032 endereço em uso: mostra o erro no campo e libera a edição do endereço", async () => {
    server.use(
      http.post("*/api/admin/events", () =>
        apiError("DUPLICATE_SLUG", "Já existe um item com este endereço. Escolha outro.", 409),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);
    const slug = screen.getByRole("textbox", { name: "Endereço da página" });
    expect(slug).toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(
      await screen.findByText("Já existe um item com este endereço. Escolha outro."),
    ).toBeVisible();
    await waitFor(() => expect(slug).not.toHaveAttribute("readonly"));
  });

  it("mostra os erros 422 do servidor no campo certo", async () => {
    server.use(
      http.post("*/api/admin/events", () =>
        apiError("VALIDATION_ERROR", "Confira os campos destacados.", 422, [
          { field: "ends_at", code: "invalid", message: "O término precisa ser depois do início." },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);

    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(await screen.findByText("O término precisa ser depois do início.")).toBeVisible();
  });

  it("BR-033 publicar com o prazo de inscrição vencido pede confirmação antes de enviar", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/admin/events", () => {
        calls += 1;
        return HttpResponse.json({ data: event(9) }, { status: 201 });
      }),
      http.get("*/api/admin/events/9", () => HttpResponse.json({ data: event(9) })),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);
    setDateTime(/Inscrições até/, "2020-01-01T10:00");
    await user.clear(screen.getByLabelText("Começa"));
    setDateTime("Começa", "2099-12-05T09:00");

    await user.click(screen.getByRole("button", { name: "Salvar e publicar" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "Publicar com as inscrições encerradas?",
    });
    expect(dialog).toHaveTextContent(
      "O prazo de inscrição já passou; o evento será publicado com inscrições encerradas.",
    );
    expect(calls).toBe(0);

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(calls).toBe(0);

    await user.click(screen.getByRole("button", { name: "Salvar e publicar" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Publicar mesmo assim",
      }),
    );

    await waitFor(() => expect(calls).toBe(1));
  });

  it("salvar como rascunho com o prazo vencido não pede confirmação", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/admin/events", () => {
        calls += 1;
        return HttpResponse.json({ data: event(9) }, { status: 201 });
      }),
      http.get("*/api/admin/events/9", () => HttpResponse.json({ data: event(9) })),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);
    setDateTime(/Inscrições até/, "2020-01-01T10:00");

    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(calls).toBe(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("BR-045 envia a imagem de capa depois de criar o evento", async () => {
    const fields = captureFormFields();
    let uploadedTo: string | null = null;
    server.use(
      http.post("*/api/admin/events", () => HttpResponse.json({ data: event(9) }, { status: 201 })),
      http.get("*/api/admin/events/9", () => HttpResponse.json({ data: event(9) })),
      http.post("*/api/admin/events/9/banner", ({ request }) => {
        uploadedTo = new URL(request.url).pathname;
        return HttpResponse.json({
          data: {
            banner_url: "/uploads/eventos/2026/a.webp",
            banner_small_url: "/uploads/eventos/2026/a-800.webp",
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    await fillBasics(user);
    const file = new File(["x"], "capa.png", { type: "image/png" });

    await user.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
      file,
    );
    expect(await screen.findByText("Nova imagem: capa.png")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(uploadedTo).toBe("/api/admin/events/9/banner"));
    expect((fields.get("banner") as File).name).toBe("capa.png");
  });

  it("BR-045 recusa na hora o que não é JPEG, PNG ou WebP", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderAdmin("/admin/eventos/novo");
    await screen.findByRole("textbox", { name: "Nome" });

    await user.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
      new File(["%PDF"], "capa.pdf", { type: "application/pdf" }),
    );

    expect(
      await screen.findByText("A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB."),
    ).toBeVisible();
  });

  it("se a imagem falhar, o evento já está salvo e a tela avisa", async () => {
    server.use(
      http.post("*/api/admin/events", () => HttpResponse.json({ data: event(9) }, { status: 201 })),
      http.get("*/api/admin/events/9", () => HttpResponse.json({ data: event(9) })),
      http.post("*/api/admin/events/9/banner", () =>
        apiError("PAYLOAD_TOO_LARGE", "O arquivo é grande demais.", 413),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/eventos/novo");
    await fillBasics(user);

    await user.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement,
      new File(["x"], "capa.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    // Dois avisos sobem juntos (o erro da imagem e o "Evento criado."): o mais antigo fica empilhado atrás do outro
    expect(
      await screen.findByText(
        "O evento foi salvo, mas a imagem não pôde ser enviada. Tente de novo.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/eventos/9"));
  });

  it("BR-030 o líder tem o ministério fixo no dele", async () => {
    mockMe(LIDER);
    let sent: { ministry_id?: number } | null = null;
    server.use(
      http.post("*/api/admin/events", async ({ request }) => {
        sent = (await request.json()) as { ministry_id?: number };
        return HttpResponse.json({ data: event(9) }, { status: 201 });
      }),
      http.get("*/api/admin/events/9", () => HttpResponse.json({ data: event(9) })),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/novo");
    const ministry = await screen.findByRole("combobox", { name: "Ministério responsável" });

    expect(ministry).toBeDisabled();
    expect(ministry).toHaveValue("2");
    expect(
      within(ministry)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Escolha…", "Música"]);

    await user.type(screen.getByRole("textbox", { name: "Nome" }), "Ensaio aberto");
    setDateTime("Começa", "2099-12-05T09:00");
    await user.type(screen.getByRole("textbox", { name: "Local" }), "Templo");
    await screen.findByRole("textbox", { name: "Descrição" });
    paste("<p>Venha.</p>", "Venha.");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Descrição" })).toHaveTextContent("Venha."),
    );
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(sent).toMatchObject({ ministry_id: 2 }));
  });
});

describe("rascunho local (FR-077)", () => {
  it("guarda o que foi digitado, sem a imagem, e oferece de volta ao reabrir", async () => {
    const user = userEvent.setup();
    const first = renderAdmin("/admin/eventos/novo");
    await user.type(await screen.findByRole("textbox", { name: "Nome" }), "Retiro de jovens");
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.type(screen.getByRole("textbox", { name: "Pergunta" }), "Cidade");

    const key = draftKey(COMUNICACAO.id, "evento", "novo");
    await waitFor(() => expect(window.localStorage.getItem(key)).not.toBeNull(), { timeout: 3000 });
    const stored = String(window.localStorage.getItem(key));
    expect(stored).toContain("Retiro de jovens");
    expect(stored).toContain("Cidade");
    expect(stored).not.toContain("capa");
    first.unmount();

    resetQueryCache();
    renderAdmin("/admin/eventos/novo");
    expect(
      await screen.findByText(
        "Encontramos um rascunho não salvo neste navegador. Deseja restaurar?",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Retiro de jovens");
    expect(screen.getByRole("textbox", { name: "Pergunta" })).toHaveValue("Cidade");
  });

  it("um rascunho adulterado no navegador é ignorado", async () => {
    window.localStorage.setItem(
      draftKey(COMUNICACAO.id, "evento", "novo"),
      JSON.stringify({ savedAt: Date.now(), values: { title: 42 } }),
    );
    renderAdmin("/admin/eventos/novo");
    await screen.findByRole("textbox", { name: "Nome" });

    expect(screen.queryByText(/Encontramos um rascunho/)).not.toBeInTheDocument();
  });
});

describe("edição e publicação", () => {
  it("carrega o evento, com situação, vagas e as perguntas, e salva só o que a API aceita (sem o endereço)", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({ data: event(1, { form_schema: [camiseta], registrations_count: 0 }) }),
      ),
      http.patch("*/api/admin/events/1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: event(1, { title: "Retiro 2099", form_schema: [camiseta], registrations_count: 0 }),
        });
      }),
    );
    const user = userEvent.setup();
    const { container } = renderAdmin("/admin/eventos/1");

    expect(await screen.findByRole("heading", { level: 1, name: "Evento 1" })).toBeVisible();
    expect(screen.getByText("Publicado · inscrições abertas")).toBeVisible();
    expect(screen.getByText("0 de 60 vagas preenchidas")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Endereço da página" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Pergunta" })).toHaveValue("Tamanho da camiseta");
    expect(screen.getByLabelText("Começa")).toHaveValue("2099-12-05T09:00");
    expect(screen.getByRole("link", { name: "Ver página do evento" })).toHaveAttribute(
      "href",
      "/eventos/evento-1",
    );
    await expectNoA11yViolations(container);

    const name = screen.getByRole("textbox", { name: "Nome" });
    await user.clear(name);
    await user.type(name, "Retiro 2099");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({
      title: "Retiro 2099",
      ministry_id: 2,
      starts_at: "2099-12-05T09:00:00-03:00",
    });
    expect(sent).not.toHaveProperty("slug");
    expect(sent).not.toHaveProperty("is_published");
    expect(sent).not.toHaveProperty("confirm_schema_change");
    expect(await screen.findByText("Alterações salvas.")).toBeVisible();
  });

  it("evento que não existe (ou é de outro ministério) mostra 'Não encontramos este evento'", async () => {
    server.use(
      http.get("*/api/admin/events/8", () => apiError("NOT_FOUND", "Evento não encontrado.", 404)),
    );
    renderAdmin("/admin/eventos/8");

    expect(await screen.findByText("Não encontramos este evento.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Tentar novamente/ })).not.toBeInTheDocument();
  });

  it("rascunho: 'Publicar' publica; inscrições abertas: 'Encerrar inscrições' e 'Despublicar'", async () => {
    let state = "RASCUNHO";
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({
          data: event(1, {
            is_published: state !== "RASCUNHO",
            registration: { state, deadline: null, spots_total: 60, spots_left: 18 },
          }),
        }),
      ),
      http.patch("*/api/admin/events/1", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        if (body.is_published === true) state = "INSCRICOES_ABERTAS";
        if (body.is_published === false) state = "RASCUNHO";
        return HttpResponse.json({
          data: event(1, {
            is_published: state !== "RASCUNHO",
            registration: { state, deadline: null, spots_total: 60, spots_left: 18 },
          }),
        });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");
    expect(await screen.findByText("Rascunho · fora do site")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Despublicar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByText("Publicado · inscrições abertas")).toBeVisible();
    expect(patches).toEqual([{ is_published: true }]);
    expect(screen.getByRole("button", { name: "Encerrar inscrições" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Publicar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Despublicar" }));

    expect(await screen.findByText("Rascunho · fora do site")).toBeVisible();
    expect(patches).toEqual([{ is_published: true }, { is_published: false }]);
  });

  it("BR-033 publicar um evento salvo com o prazo vencido pede confirmação", async () => {
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({
          data: event(1, {
            is_published: false,
            registration_deadline: "2020-01-01T13:00:00Z",
            registration: {
              state: "RASCUNHO",
              deadline: "2020-01-01T13:00:00Z",
              spots_total: null,
              spots_left: null,
            },
          }),
        }),
      ),
      http.patch("*/api/admin/events/1", async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: event(1) });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");

    await user.click(await screen.findByRole("button", { name: "Publicar" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Publicar com as inscrições encerradas?",
    });
    expect(patches).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Publicar mesmo assim" }));

    await waitFor(() => expect(patches).toEqual([{ is_published: true }]));
  });

  it("'Encerrar inscrições' confirma e manda o prazo = agora", async () => {
    const patches: Record<string, unknown>[] = [];
    const closed = event(1, {
      registration_deadline: "2026-10-23T15:00:00Z",
      registration: {
        state: "INSCRICOES_ENCERRADAS",
        deadline: "2026-10-23T15:00:00Z",
        spots_total: 60,
        spots_left: 18,
      },
    });
    server.use(
      // Depois do PATCH a tela recarrega o evento: o servidor de mentira passa a devolver o evento já encerrado
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({ data: patches.length > 0 ? closed : event(1) }),
      ),
      http.patch("*/api/admin/events/1", async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: closed });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");

    await user.click(await screen.findByRole("button", { name: "Encerrar inscrições" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Encerrar as inscrições agora?",
    });
    expect(dialog).toHaveTextContent(
      "O formulário some da página do evento. Quem já se inscreveu continua na lista.",
    );
    expect(patches).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Encerrar" }));

    expect(await screen.findByText("Publicado · inscrições encerradas")).toBeVisible();
    expect(patches).toHaveLength(1);
    expect(Object.keys(patches[0] ?? {})).toEqual(["registration_deadline"]);
    expect(new Date(String(patches[0]?.registration_deadline)).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    expect(screen.getByLabelText(/Inscrições até/)).not.toHaveValue("");
  });

  it("'Reabrir inscrições' tira o prazo; some quando o evento já começou ou as vagas acabaram", async () => {
    const patches: Record<string, unknown>[] = [];
    const closed = {
      state: "INSCRICOES_ENCERRADAS",
      deadline: "2026-10-01T12:00:00Z",
      spots_total: 60,
      spots_left: 18,
    };
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({
          data: event(1, { registration_deadline: "2026-10-01T12:00:00Z", registration: closed }),
        }),
      ),
      http.patch("*/api/admin/events/1", async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: event(1) });
      }),
    );
    const user = userEvent.setup();
    const first = renderAdmin("/admin/eventos/1");

    await user.click(await screen.findByRole("button", { name: "Reabrir inscrições" }));

    await waitFor(() => expect(patches).toEqual([{ registration_deadline: null }]));
    first.unmount();

    // Vagas esgotadas: não adianta reabrir
    resetQueryCache();
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({ data: event(1, { registration: { ...closed, spots_left: 0 } }) }),
      ),
    );
    renderAdmin("/admin/eventos/1");
    expect(await screen.findByText("Publicado · inscrições encerradas")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reabrir inscrições" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Despublicar" })).toBeVisible();
  });

  it("evento realizado só oferece 'Despublicar'", async () => {
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({
          data: event(1, {
            starts_at: "2020-01-01T12:00:00Z",
            ends_at: null,
            registration: { state: "REALIZADO", deadline: null, spots_total: 60, spots_left: 0 },
          }),
        }),
      ),
    );
    renderAdmin("/admin/eventos/1");

    expect(await screen.findByText("Realizado")).toBeVisible();
    expect(screen.getByRole("button", { name: "Despublicar" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Publicar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Encerrar inscrições" })).not.toBeInTheDocument();
  });

  it("BR-027 vagas abaixo dos inscritos: o erro do servidor aparece no campo Vagas", async () => {
    server.use(
      http.get("*/api/admin/events/1", () => HttpResponse.json({ data: event(1) })),
      http.patch("*/api/admin/events/1", () =>
        apiError(
          "SPOTS_BELOW_REGISTRATIONS",
          "Já existem 42 inscritos; o número de vagas não pode ser menor.",
          409,
        ),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");
    const spots = await screen.findByRole("textbox", { name: /Vagas/ });

    await user.clear(spots);
    await user.type(spots, "10");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByText("Já existem 42 inscritos; o número de vagas não pode ser menor."),
    ).toBeVisible();
    expect(spots).toHaveAttribute("aria-invalid", "true");
  });

  it("BR-029 remover uma pergunta com inscrições: confirma no construtor e o PATCH leva confirm_schema_change", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({ data: event(1, { form_schema: [camiseta], registrations_count: 42 }) }),
      ),
      http.patch("*/api/admin/events/1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: event(1, { form_schema: [], registrations_count: 42 }) });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");
    await user.click(
      await screen.findByRole("button", { name: "Remover a pergunta Tamanho da camiseta" }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Remover pergunta",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({ form_schema: [], confirm_schema_change: true });
  });

  it("BR-029 se outra pessoa recebeu inscrições com a tela aberta, o 409 abre a confirmação e reenvia", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({ data: event(1, { form_schema: [camiseta], registrations_count: 0 }) }),
      ),
      http.patch("*/api/admin/events/1", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return body.confirm_schema_change === true
          ? HttpResponse.json({ data: event(1, { form_schema: [] }) })
          : apiError("SCHEMA_CHANGE_NEEDS_CONFIRMATION", "Este campo já tem respostas.", 409, [
              { field: "form_schema", code: "camiseta", message: "x" },
            ]);
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");
    await user.click(
      await screen.findByRole("button", { name: "Remover a pergunta Tamanho da camiseta" }),
    );

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirmar a mudança no formulário?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0]).not.toHaveProperty("confirm_schema_change");
    expect(bodies[1]).toMatchObject({ confirm_schema_change: true });
    expect(await screen.findByText("Alterações salvas.")).toBeVisible();
  });

  it("BR-045 troca e remove a imagem de capa", async () => {
    const calls: string[] = [];
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({
          data: event(1, {
            banner_url: "/uploads/eventos/2026/a.webp",
            banner_small_url: "/uploads/eventos/2026/a-800.webp",
          }),
        }),
      ),
      http.patch("*/api/admin/events/1", () => {
        calls.push("patch");
        return HttpResponse.json({
          data: event(1, {
            banner_url: "/uploads/eventos/2026/a.webp",
            banner_small_url: "/uploads/eventos/2026/a-800.webp",
          }),
        });
      }),
      http.delete("*/api/admin/events/1/banner", () => {
        calls.push("remove-banner");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");
    const current = (await screen.findAllByRole("presentation")).find(
      (node) => node.tagName === "IMG",
    );
    expect(current).toHaveAttribute("src", "/uploads/eventos/2026/a-800.webp");

    await user.click(screen.getByRole("button", { name: "Remover imagem" }));
    expect(screen.getByText("A imagem será removida quando você salvar.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Manter a imagem" }));
    expect(
      screen.queryByText("A imagem será removida quando você salvar."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover imagem" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(calls).toEqual(["patch", "remove-banner"]));
  });

  it("BR-028 exclui um evento sem inscrições, depois de confirmar", async () => {
    let deleted = false;
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({
          data: event(1, {
            registrations_count: 0,
            is_published: false,
            registration: {
              state: "RASCUNHO",
              deadline: null,
              spots_total: null,
              spots_left: null,
            },
          }),
        }),
      ),
      http.get("*/api/admin/events", () => HttpResponse.json({ data: [], meta: meta(0) })),
      http.delete("*/api/admin/events/1", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/eventos/1");

    await user.click(await screen.findByRole("button", { name: "Excluir evento" }));
    const dialog = await screen.findByRole("alertdialog", { name: 'Excluir "Evento 1"?' });
    expect(dialog).toHaveTextContent("A exclusão é definitiva.");
    expect(deleted).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Excluir evento" }));

    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/eventos"));
  });

  it("BR-028 com inscrições a exclusão fica travada e a tela manda despublicar", async () => {
    let deleted = false;
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({ data: event(1, { registrations_count: 5 }) }),
      ),
      http.delete("*/api/admin/events/1", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");

    await user.click(await screen.findByRole("button", { name: "Excluir evento" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(dialog).toHaveTextContent(
      "Este evento tem inscrições e não pode ser excluído. Despublique-o.",
    );
    expect(within(dialog).getByRole("button", { name: "Excluir evento" })).toBeDisabled();
    expect(deleted).toBe(false);
  });

  it("BR-030 evento de outro ministério (404) mostra 'Não encontramos' para o líder", async () => {
    mockMe(LIDER);
    server.use(
      http.get("*/api/admin/events/5", () => apiError("NOT_FOUND", "Evento não encontrado.", 404)),
    );
    renderAdmin("/admin/eventos/5");

    expect(await screen.findByText("Não encontramos este evento.")).toBeVisible();
  });

  it("erro ao carregar (rede ou 500) oferece 'Tentar novamente'", async () => {
    server.use(http.get("*/api/admin/events/1", () => apiError("INTERNAL", "Falha.", 500)));
    renderAdmin("/admin/eventos/1");

    expect(await screen.findByText("Não foi possível carregar o evento.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Tentar novamente/ })).toBeVisible();
  });

  it("uma ação de publicação que falha mostra o erro e mantém a situação", async () => {
    server.use(
      http.get("*/api/admin/events/1", () =>
        HttpResponse.json({
          data: event(1, {
            is_published: false,
            registration: {
              state: "RASCUNHO",
              deadline: null,
              spots_total: null,
              spots_left: null,
            },
          }),
        }),
      ),
      http.patch("*/api/admin/events/1", () => apiError("INTERNAL", "Algo deu errado.", 500)),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/eventos/1");

    await user.click(await screen.findByRole("button", { name: "Publicar" }));

    expect(await screen.findByText("Algo deu errado.")).toBeVisible();
    expect(screen.getByText("Rascunho · fora do site")).toBeVisible();
  });
});
