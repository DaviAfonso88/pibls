import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import { resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { draftKey, readDraft } from "~/shared/drafts";

/*
 * Boletins no painel (T122; design: AdminBoletins, AdminBoletim). BR-040 (edição única), BR-041 (PDF verdadeiro até
 * 10 MB), BR-042 (agendado), FR-077 (rascunho local, sem o PDF).
 */

const COMUNICACAO = userFixture("COMUNICACAO");

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
    // Repassa os argumentos como vieram: `set(nome, texto, undefined)` não é a mesma chamada que `set(nome, texto)`
    Reflect.apply(original, this, args);
    fields.set(args[0], this.get(args[0]) as FormDataEntryValue);
  });
  return fields;
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  resetQueryCache();
  useSnapshots();
  mockAdminDefaults();
  mockMe(COMUNICACAO);
  window.localStorage.clear();
  server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
});

const meta = (total = 0, page = 1, lastPage = 1) => ({
  page,
  per_page: 25,
  total,
  last_page: lastPage,
});

function bulletin(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    edition_number: id,
    reference_date: "2026-10-18",
    title: `Semana ${id}`,
    summary_text: "Resumo.",
    pdf_url: `/uploads/boletins/2026/${String(id).padStart(32, "0")}.pdf`,
    pdf_size_bytes: 2_000_000,
    published_at: "2026-10-17T21:10:00Z",
    status: "PUBLICADO",
    updated_at: "2026-10-17T21:10:00Z",
    updated_by: { id: 7, name: "Rafael Souza" },
    ...overrides,
  };
}

const apiError = (code: string, message: string, status: number, details: object[] = []) =>
  HttpResponse.json({ error: { code, message, details, traceId: "t" } }, { status });

/** Um PDF de mentira só no nome e no tipo: o servidor é quem confere o conteúdo (BR-041). */
const pdf = (name = "boletim-1932.pdf", type = "application/pdf") =>
  new File(["%PDF-1.4 conteudo"], name, { type });

describe("lista", () => {
  it("mostra as edições com a situação (publicado ou agendado) e o link para editar", async () => {
    server.use(
      http.get("*/api/admin/bulletins", () =>
        HttpResponse.json({
          data: [
            bulletin(1932, { status: "AGENDADO", published_at: "2026-10-24T23:00:00Z" }),
            bulletin(1931),
          ],
          meta: meta(2),
        }),
      ),
    );
    const { container } = renderAdmin("/admin/boletins");

    expect(await screen.findByRole("heading", { level: 1, name: "Boletins" })).toBeVisible();
    const table = await screen.findByRole("table", { name: "Boletins" });

    const scheduled = within(table).getByRole("row", { name: /1932/ });
    expect(within(scheduled).getByText("Agendado")).toBeVisible();
    expect(within(scheduled).getByText(/Sai em 24\/10\/2026 às 20h00/)).toBeVisible();
    const published = within(table).getByRole("row", { name: /1931/ });
    expect(within(published).getByText("Publicado")).toBeVisible();
    expect(within(published).getByRole("link", { name: /Editar boletim nº 1931/ })).toHaveAttribute(
      "href",
      "/admin/boletins/1931",
    );
    expect(screen.getByRole("link", { name: "Novo boletim" })).toHaveAttribute(
      "href",
      "/admin/boletins/novo",
    );

    await expectNoA11yViolations(container);
  });

  it("filtra por ano na URL", async () => {
    const requests: string[] = [];
    server.use(
      http.get("*/api/admin/bulletins", ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json({ data: [bulletin(1)], meta: meta(1) });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/boletins");
    await screen.findByRole("table", { name: "Boletins" });

    await user.selectOptions(screen.getByLabelText("Ano"), "2025");

    expect(router.state.location.search).toBe("?ano=2025");
    await waitFor(() => expect(requests).toContain("?year=2025"));
  });

  it("estado vazio convida a cadastrar", async () => {
    server.use(
      http.get("*/api/admin/bulletins", () => HttpResponse.json({ data: [], meta: meta(0) })),
    );
    renderAdmin("/admin/boletins");

    expect(await screen.findByText("Nenhum boletim cadastrado ainda.")).toBeVisible();
  });

  it("BR-076 quem não tem boletins.write vê 'sem acesso' e nem consulta a API", async () => {
    mockMe(userFixture("SECRETARIA"));
    let called = false;
    server.use(
      http.get("*/api/admin/bulletins", () => {
        called = true;
        return HttpResponse.json({ data: [], meta: meta(0) });
      }),
    );
    renderAdmin("/admin/boletins");

    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
    expect(called).toBe(false);
  });
});

describe("cadastro", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("Edição nº"), "1932");
    await user.type(screen.getByLabelText("Título"), "Semana da Família");
    await user.type(screen.getByLabelText(/Resumo/), "Programação especial.");
  }

  async function choosePdf(user: ReturnType<typeof userEvent.setup>, file = pdf()) {
    await user.upload(document.querySelector<HTMLInputElement>("#pdf") as HTMLInputElement, file);
  }

  it("envia os dados e o PDF em multipart e mostra 'Boletim publicado!'", async () => {
    const fields = captureFormFields();
    server.use(
      http.post("*/api/admin/bulletins", () =>
        HttpResponse.json({ data: bulletin(1932) }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    const { container } = renderAdmin("/admin/boletins/novo");

    expect(await screen.findByRole("heading", { level: 1, name: "Novo boletim" })).toBeVisible();
    // O domingo de referência já vem sugerido
    expect((screen.getByLabelText("Domingo de referência") as HTMLInputElement).value).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    await fill(user);
    await choosePdf(user);
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("Boletim publicado!")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver no site" })).toHaveAttribute("href", "/boletins");
    expect(fields.get("edition_number")).toBe("1932");
    expect(fields.get("title")).toBe("Semana da Família");
    expect(fields.get("summary_text")).toBe("Programação especial.");
    expect(fields.get("reference_date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fields.has("published_at")).toBe(false);
    expect((fields.get("pdf") as File).name).toBe("boletim-1932.pdf");
  });

  it("BR-042 agendar manda o horário de Brasília com o deslocamento", async () => {
    const fields = captureFormFields();
    server.use(
      http.post("*/api/admin/bulletins", () =>
        HttpResponse.json(
          { data: bulletin(1932, { status: "AGENDADO", published_at: "2030-03-10T12:00:00Z" }) },
          { status: 201 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await fill(user);
    await choosePdf(user);

    await user.click(screen.getByRole("radio", { name: "Agendar para depois" }));
    const when = await screen.findByLabelText("Data e hora");
    await user.type(when, "2030-03-10T09:00");
    await user.click(screen.getByRole("button", { name: "Agendar publicação" }));

    expect(await screen.findByText(/Boletim agendado para 10\/03\/2030 às 09h00/)).toBeVisible();
    expect(fields.get("published_at")).toBe("2030-03-10T09:00:00-03:00");
  });

  it("agendar exige data e hora no futuro", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await fill(user);
    await choosePdf(user);

    await user.click(screen.getByRole("radio", { name: "Agendar para depois" }));
    await user.click(screen.getByRole("button", { name: "Agendar publicação" }));
    expect(await screen.findByText("Informe a data e a hora.")).toBeVisible();

    await user.type(screen.getByLabelText("Data e hora"), "2020-01-01T09:00");
    await user.click(screen.getByRole("button", { name: "Agendar publicação" }));
    expect(await screen.findByText("Escolha um horário no futuro.")).toBeVisible();
  });

  it("sem o PDF não envia: 'Envie o PDF para poder publicar.'", async () => {
    let called = false;
    server.use(
      http.post("*/api/admin/bulletins", () => {
        called = true;
        return HttpResponse.json({ data: bulletin(1) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("Envie o PDF para poder publicar.")).toBeVisible();
    expect(called).toBe(false);
  });

  it("BR-041 recusa na hora o que não é PDF e o que passa de 10 MB", async () => {
    // `applyAccept: false`: o navegador deixaria arrastar o arquivo errado; o FileDrop é quem confere
    const user = userEvent.setup({ applyAccept: false });
    renderAdmin("/admin/boletins/novo");
    await screen.findByLabelText("Edição nº");

    await choosePdf(user, new File(["texto"], "foto.png", { type: "image/png" }));
    expect(await screen.findByText("O arquivo precisa ser um PDF.")).toBeVisible();

    const big = new File(["x"], "enorme.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
    await choosePdf(user, big);
    expect(await screen.findByText("O PDF pode ter no máximo 10 MB.")).toBeVisible();
  });

  it("BR-040 mostra no campo a edição que já existe", async () => {
    server.use(
      http.post("*/api/admin/bulletins", () =>
        apiError("DUPLICATE_EDITION", "Já existe um boletim com a edição 1932.", 409),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await fill(user);
    await choosePdf(user);

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    const field = await screen.findByLabelText("Edição nº");
    expect(await screen.findByText("Já existe um boletim com a edição 1932.")).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Boletim publicado!")).toBeNull();
  });

  it("BR-041 o 422 do servidor para um PDF falso aparece no campo do arquivo", async () => {
    server.use(
      http.post("*/api/admin/bulletins", () =>
        apiError("VALIDATION_ERROR", "Dados inválidos.", 422, [
          { field: "pdf", code: "invalid", message: "O arquivo precisa ser um PDF." },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await fill(user);
    await choosePdf(user);

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    const group = await screen.findByRole("group", { name: "Arquivo do boletim (PDF)" });
    expect(await within(group).findByText("O arquivo precisa ser um PDF.")).toBeVisible();
  });

  it("mostra a barra de progresso enquanto envia e deixa cancelar", async () => {
    server.use(
      http.post("*/api/admin/bulletins", async () => {
        await delay("infinite");
        return HttpResponse.json({ data: bulletin(1) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await fill(user);
    await choosePdf(user);

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    const bar = await screen.findByRole("progressbar", { name: "Enviando boletim-1932.pdf" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    await user.click(screen.getByRole("button", { name: "Cancelar envio" }));

    // Cancelado: volta o seletor de arquivo e o formulário pode ser enviado de novo
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeEnabled();
    expect(screen.queryByText("Boletim publicado!")).toBeNull();
  });

  it("valida os campos antes de enviar", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await screen.findByLabelText("Edição nº");

    await user.type(screen.getByLabelText("Título"), "ab");
    await choosePdf(user);
    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("Informe o número da edição (de 1 a 999999).")).toBeVisible();
    expect(screen.getByText("O título precisa ter de 3 a 150 caracteres.")).toBeVisible();
  });
});

describe("rascunho local (FR-077)", () => {
  const key = draftKey(COMUNICACAO.id, "boletim", "novo");

  it("guarda os campos de texto 1 s depois de digitar, sem o PDF", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");

    await user.type(await screen.findByLabelText("Título"), "Semana da Família");
    await user.upload(document.querySelector<HTMLInputElement>("#pdf") as HTMLInputElement, pdf());

    await waitFor(
      () =>
        expect(readDraft(key, (value) => value)?.value).toMatchObject({
          title: "Semana da Família",
        }),
      {
        timeout: 4000,
      },
    );
    expect(window.localStorage.getItem(key)).not.toContain("boletim-1932.pdf");
    expect(await screen.findByText(/Rascunho guardado neste navegador às/)).toBeVisible();
  });

  it("'Salvar rascunho' grava na hora, sem esperar a pausa da digitação", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");

    const save = await screen.findByRole("button", { name: "Salvar rascunho" });
    // Nada digitado ainda: não há o que guardar
    expect(save).toBeDisabled();

    await user.type(await screen.findByLabelText("Título"), "Semana da Família");
    expect(save).toBeEnabled();
    expect(window.localStorage.getItem(key)).toBeNull();
    await user.click(save);

    expect(readDraft(key, (value) => value)?.value).toMatchObject({ title: "Semana da Família" });
    expect(await screen.findByText(/Rascunho guardado neste navegador às/)).toBeVisible();
  });

  it("não tem 'Salvar rascunho' ao editar um boletim que já está no site", async () => {
    server.use(
      http.get("*/api/admin/bulletins/:id", () => HttpResponse.json({ data: bulletin(1931) })),
    );
    renderAdmin("/admin/boletins/1931");

    await screen.findByLabelText("Edição nº");
    expect(screen.queryByRole("button", { name: "Salvar rascunho" })).toBeNull();
  });

  it("oferece o rascunho ao abrir de novo e o restaura", async () => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        value: {
          edition_number: "1940",
          reference_date: "2026-11-01",
          title: "Rascunho da sessão que expirou",
          summary_text: "",
          when: "now",
          scheduled_at: "",
        },
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");

    expect(
      await screen.findByText(
        "Encontramos um rascunho não salvo neste navegador. Deseja restaurar?",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Restaurar" }));

    expect(screen.getByLabelText("Título")).toHaveValue("Rascunho da sessão que expirou");
    expect(screen.getByLabelText("Edição nº")).toHaveValue("1940");
    expect(screen.queryByRole("button", { name: "Restaurar" })).toBeNull();
  });

  it("descartar apaga o rascunho", async () => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        value: {
          edition_number: "1",
          reference_date: "2026-11-01",
          title: "Descarte",
          summary_text: "",
          when: "now",
          scheduled_at: "",
        },
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");

    await user.click(await screen.findByRole("button", { name: "Descartar" }));

    expect(window.localStorage.getItem(key)).toBeNull();
    expect(screen.getByLabelText("Título")).toHaveValue("");
  });

  it("ignora um rascunho com formato inválido ou vencido", async () => {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: { x: 1 } }));
    renderAdmin("/admin/boletins/novo");

    await screen.findByLabelText("Título");
    expect(screen.queryByText(/Encontramos um rascunho/)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("salvar com sucesso apaga o rascunho", async () => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        value: {
          edition_number: "1932",
          reference_date: "2026-10-25",
          title: "Semana da Família",
          summary_text: "",
          when: "now",
          scheduled_at: "",
        },
      }),
    );
    server.use(
      http.post("*/api/admin/bulletins", () =>
        HttpResponse.json({ data: bulletin(1932) }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");
    await user.click(await screen.findByRole("button", { name: "Restaurar" }));
    await user.upload(document.querySelector<HTMLInputElement>("#pdf") as HTMLInputElement, pdf());

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("Boletim publicado!")).toBeVisible();
    expect(window.localStorage.getItem(key)).toBeNull();
  });
});

describe("edição", () => {
  it("abre com os dados, salva as alterações (PATCH) e volta para a lista", async () => {
    let patch: Record<string, unknown> | null = null;
    server.use(
      http.get("*/api/admin/bulletins/1931", () => HttpResponse.json({ data: bulletin(1931) })),
      http.patch("*/api/admin/bulletins/1931", async ({ request }) => {
        patch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: bulletin(1931, { title: "Título novo" }) });
      }),
      http.get("*/api/admin/bulletins", () =>
        HttpResponse.json({ data: [bulletin(1931)], meta: meta(1) }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/boletins/1931");

    expect(await screen.findByRole("heading", { level: 1, name: "Boletim nº 1931" })).toBeVisible();
    const title = await screen.findByLabelText("Título");
    await waitFor(() => expect(title).toHaveValue("Semana 1931"));
    expect(screen.getByLabelText("Edição nº")).toHaveValue("1931");
    // Já publicado: não há o que reagendar
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(/Publicado em 17\/10\/2026/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Abrir o PDF atual" })).toHaveAttribute(
      "href",
      expect.stringContaining("/uploads/boletins/2026/"),
    );

    await user.clear(title);
    await user.type(title, "Título novo");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/boletins"));
    expect(patch).toMatchObject({ edition_number: 1931, title: "Título novo" });
    expect(patch).not.toHaveProperty("published_at");
  });

  it("trocar o PDF manda o arquivo para POST …/pdf depois de salvar os dados", async () => {
    const calls: string[] = [];
    const fields = captureFormFields();
    server.use(
      http.get("*/api/admin/bulletins/1931", () => HttpResponse.json({ data: bulletin(1931) })),
      http.patch("*/api/admin/bulletins/1931", () => {
        calls.push("patch");
        return HttpResponse.json({ data: bulletin(1931) });
      }),
      http.post("*/api/admin/bulletins/1931/pdf", () => {
        calls.push("pdf");
        return HttpResponse.json({ data: bulletin(1931) });
      }),
      http.get("*/api/admin/bulletins", () =>
        HttpResponse.json({ data: [bulletin(1931)], meta: meta(1) }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/boletins/1931");
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveValue("Semana 1931"));

    await user.upload(
      document.querySelector<HTMLInputElement>("#pdf") as HTMLInputElement,
      pdf("novo.pdf"),
    );
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/boletins"));
    expect(calls).toEqual(["patch", "pdf"]);
    expect((fields.get("pdf") as File).name).toBe("novo.pdf");
  });

  it("exclui com confirmação (exclusão lógica) e volta para a lista", async () => {
    let deleted = false;
    server.use(
      http.get("*/api/admin/bulletins/1931", () => HttpResponse.json({ data: bulletin(1931) })),
      http.delete("*/api/admin/bulletins/1931", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("*/api/admin/bulletins", () => HttpResponse.json({ data: [], meta: meta(0) })),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/boletins/1931");
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveValue("Semana 1931"));

    await user.click(screen.getByRole("button", { name: "Excluir boletim" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Excluir o boletim nº 1931?")).toBeVisible();
    expect(deleted).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Excluir boletim" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/boletins"));
    expect(deleted).toBe(true);
  });

  it("boletim agendado deixa reagendar ou publicar agora", async () => {
    server.use(
      http.get("*/api/admin/bulletins/1932", () =>
        HttpResponse.json({
          data: bulletin(1932, { status: "AGENDADO", published_at: "2030-03-10T12:00:00Z" }),
        }),
      ),
    );
    renderAdmin("/admin/boletins/1932");

    expect(await screen.findByRole("radio", { name: "Agendar para depois" })).toBeChecked();
    expect(screen.getByLabelText("Data e hora")).toHaveValue("2030-03-10T09:00");
  });

  it("boletim inexistente mostra 'não encontramos' e o caminho de volta", async () => {
    server.use(
      http.get("*/api/admin/bulletins/999", () => apiError("NOT_FOUND", "Não encontramos.", 404)),
    );
    renderAdmin("/admin/boletins/999");

    expect(await screen.findByText("Não encontramos este boletim.")).toBeVisible();
    const back = screen.getAllByRole("link", { name: "Boletins" });
    expect(back.map((link) => link.getAttribute("href"))).toContain("/admin/boletins");
  });
});

describe("novo boletim: dica do PDF e prévia", () => {
  it("avisa que falta o PDF enquanto nenhum foi escolhido, e o aviso some com o arquivo", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/boletins/novo");

    expect(await screen.findByText("Envie o PDF para poder publicar.")).toBeVisible();

    await user.upload(document.querySelector<HTMLInputElement>("#pdf") as HTMLInputElement, pdf());

    await waitFor(() =>
      expect(screen.queryByText("Envie o PDF para poder publicar.")).not.toBeInTheDocument(),
    );
  });

  it("a prévia mostra o domingo escolhido (sem recuar um dia pelo fuso) e só põe o número depois de preenchido", async () => {
    const key = draftKey(COMUNICACAO.id, "boletim", "novo");
    const saved = (edition: string) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({
          savedAt: Date.now(),
          value: {
            edition_number: edition,
            reference_date: "2026-10-25",
            title: "",
            summary_text: "",
            when: "now",
            scheduled_at: "",
          },
        }),
      );
    const user = userEvent.setup();

    saved("");
    const { unmount } = renderAdmin("/admin/boletins/novo");
    await user.click(await screen.findByRole("button", { name: "Restaurar" }));
    const preview = screen.getByRole("heading", { name: "Como vai aparecer no site" })
      .parentElement as HTMLElement;
    expect(within(preview).getByText("Domingo, 25 de outubro")).toBeVisible();
    expect(within(preview).queryByText(/nº/)).not.toBeInTheDocument();
    unmount();

    saved("1932");
    renderAdmin("/admin/boletins/novo");
    await user.click(await screen.findByRole("button", { name: "Restaurar" }));
    expect(screen.getByText("Domingo, 25 de outubro · nº 1932")).toBeVisible();
  });
});
