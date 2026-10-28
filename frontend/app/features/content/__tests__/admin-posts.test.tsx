import "../../../../test/prosemirror";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import { resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { draftKey } from "~/shared/drafts";
import { slugify } from "../slug";
import { youtubeVideoId } from "../youtube";

/*
 * Palavra Viva no painel (T122; design: AdminPalavraViva). BR-032 (endereço único), BR-044 (só YouTube), BR-046
 * (formatação removida e aviso), BR-042 (agendada), FR-077 (rascunho local).
 */

const COMUNICACAO = userFixture("COMUNICACAO");

beforeEach(() => {
  resetQueryCache();
  useSnapshots();
  mockAdminDefaults();
  mockMe(COMUNICACAO);
  window.localStorage.clear();
  server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
});

const meta = (total = 0) => ({ page: 1, per_page: 25, total, last_page: 1 });

function post(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Mensagem ${id}`,
    slug: `mensagem-${id}`,
    excerpt: "Resumo.",
    author_display: "Pr. Fulano",
    youtube_video_id: null,
    youtube_url: null,
    published_at: "2026-10-16T13:10:00Z",
    body: "<p>Texto da mensagem.</p>",
    status: "PUBLICADO",
    updated_at: "2026-10-16T13:10:00Z",
    updated_by: { id: 7, name: "Rafael Souza" },
    ...overrides,
  };
}

const apiError = (code: string, message: string, status: number, details: object[] = []) =>
  HttpResponse.json({ error: { code, message, details, traceId: "t" } }, { status });

/** Cola no editor, como o navegador faria ao colar do Word ou do WhatsApp. */
function paste(html: string, text: string) {
  fireEvent.paste(screen.getByRole("textbox", { name: "Texto da mensagem" }), {
    clipboardData: {
      types: ["text/html", "text/plain"],
      getData: (type: string) => (type === "text/html" ? html : type === "text/plain" ? text : ""),
      files: [],
      items: [],
    },
  });
}

describe("endereço e link do YouTube", () => {
  it.each([
    ["A graça que sustenta", "a-graca-que-sustenta"],
    ["  Ação & Reação — Parte 2!  ", "acao-reacao-parte-2"],
    ["Nº 10: Fé e obras", "n-10-fe-e-obras"],
    ["!!!", ""],
  ])("slugify(%j) → %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("limita o endereço a 160 caracteres sem terminar em hífen", () => {
    const slug = slugify(`${"palavra ".repeat(40)}fim`);

    expect(slug.length).toBeLessThanOrEqual(160);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://vimeo.com/123456789", null],
    ["https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", null],
    ["www.youtube.com/watch?v=dQw4w9WgXcQ", null],
    ["https://www.youtube.com/@pibls", null],
    ["https://youtu.be/abc", null],
    ["https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ", null],
    ["javascript:alert(1)", null],
  ])("BR-044 youtubeVideoId(%j) → %j", (link, id) => {
    expect(youtubeVideoId(link)).toBe(id);
  });
});

describe("lista", () => {
  it("mostra as mensagens com a situação e o link para editar", async () => {
    server.use(
      http.get("*/api/admin/palavra-viva", () =>
        HttpResponse.json({
          data: [post(2, { status: "AGENDADO", published_at: "2026-10-24T23:00:00Z" }), post(1)],
          meta: meta(2),
        }),
      ),
    );
    const { container } = renderAdmin("/admin/palavra-viva");

    expect(await screen.findByRole("heading", { level: 1, name: "Palavra Viva" })).toBeVisible();
    const table = await screen.findByRole("table", { name: "Palavra Viva" });
    expect(
      within(within(table).getByRole("row", { name: /Mensagem 2/ })).getByText("Agendado"),
    ).toBeVisible();
    expect(
      within(within(table).getByRole("row", { name: /Mensagem 1/ })).getByText("Publicado"),
    ).toBeVisible();
    expect(within(table).getByRole("link", { name: "Editar mensagem Mensagem 1" })).toHaveAttribute(
      "href",
      "/admin/palavra-viva/1",
    );
    expect(screen.getByRole("link", { name: "Nova mensagem" })).toHaveAttribute(
      "href",
      "/admin/palavra-viva/nova",
    );

    await expectNoA11yViolations(container);
  });

  it("BR-076 a Pastoral também publica mensagens, mas a Secretaria não", async () => {
    server.use(
      http.get("*/api/admin/palavra-viva", () => HttpResponse.json({ data: [], meta: meta(0) })),
    );
    mockMe(userFixture("PASTORAL"));
    const first = renderAdmin("/admin/palavra-viva");
    expect(await screen.findByText("Nenhuma mensagem cadastrada ainda.")).toBeVisible();
    first.unmount();

    resetQueryCache();
    mockMe(userFixture("SECRETARIA"));
    renderAdmin("/admin/palavra-viva");
    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
  });
});

describe("cadastro", () => {
  async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByRole("textbox", { name: "Título" }), "A graça que sustenta");
    await screen.findByRole("textbox", { name: "Texto da mensagem" });
    paste("<p>Texto da <strong>mensagem</strong>.</p>", "Texto da mensagem.");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Texto da mensagem" })).toHaveTextContent(
        "Texto da mensagem.",
      ),
    );
  }

  it("gera o endereço do título, envia o texto formatado e mostra 'Mensagem publicada!'", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post("*/api/admin/palavra-viva", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { data: post(5, { slug: "a-graca-que-sustenta", title: "A graça que sustenta" }) },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    const { container } = renderAdmin("/admin/palavra-viva/nova");

    expect(await screen.findByRole("heading", { level: 1, name: "Nova mensagem" })).toBeVisible();
    await fillBasics(user);

    // O endereço acompanha o título e não se digita (design)
    const slug = screen.getByLabelText("Endereço da página");
    expect(slug).toHaveValue("a-graca-que-sustenta");
    expect(slug).toHaveAttribute("readonly");
    await user.type(screen.getByLabelText(/Pregador/), "Pr. Fulano");
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("Mensagem publicada!")).toBeVisible();
    expect(screen.getByText("Endereço: /palavra-viva/a-graca-que-sustenta")).toBeVisible();
    expect(screen.getByRole("link", { name: "Abrir a mensagem no site" })).toHaveAttribute(
      "href",
      "/palavra-viva/a-graca-que-sustenta",
    );
    expect(sent).toMatchObject({
      title: "A graça que sustenta",
      slug: "a-graca-que-sustenta",
      author_display: "Pr. Fulano",
      youtube_url: null,
    });
    expect((sent as unknown as { body: string }).body).toContain("<strong>mensagem</strong>");
    expect(sent).not.toHaveProperty("published_at");
  });

  it("BR-042 agendar manda o horário de Brasília com o deslocamento", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post("*/api/admin/palavra-viva", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { data: post(5, { status: "AGENDADO", published_at: "2030-03-10T12:00:00Z" }) },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");
    await fillBasics(user);

    await user.click(screen.getByRole("radio", { name: "Agendar para depois" }));
    await user.type(await screen.findByLabelText("Data e hora"), "2030-03-10T09:00");
    await user.click(screen.getByRole("button", { name: "Agendar publicação" }));

    expect(await screen.findByText(/Mensagem agendada para 10\/03\/2030 às 09h00/)).toBeVisible();
    expect(sent).toMatchObject({ published_at: "2030-03-10T09:00:00-03:00" });
  });

  it("BR-044 reconhece o vídeo e avisa quando o link não é do YouTube", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");
    const field = await screen.findByLabelText(/Link do YouTube/);

    await user.type(field, "https://vimeo.com/123456789");
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe um link do YouTube.");

    await user.clear(field);
    await user.type(field, "https://youtu.be/dQw4w9WgXcQ");
    expect(await screen.findByText("Vídeo reconhecido. A capa aparece na página.")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("BR-044 não envia um link que não é do YouTube", async () => {
    let called = false;
    server.use(
      http.post("*/api/admin/palavra-viva", () => {
        called = true;
        return HttpResponse.json({ data: post(1) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");
    await fillBasics(user);

    await user.type(screen.getByLabelText(/Link do YouTube/), "https://vimeo.com/123456789");
    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findAllByText("Informe um link do YouTube.")).not.toHaveLength(0);
    expect(called).toBe(false);
  });

  it("exige o texto da mensagem", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");
    await user.type(await screen.findByRole("textbox", { name: "Título" }), "Só o título");

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("Escreva o texto da mensagem.")).toBeVisible();
  });

  it("BR-032 num conflito de endereço, destrava o campo para ajustar", async () => {
    server.use(
      http.post("*/api/admin/palavra-viva", () =>
        apiError("DUPLICATE_SLUG", "Já existe um item com este endereço. Escolha outro.", 409),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");
    await fillBasics(user);
    expect(screen.getByLabelText("Endereço da página")).toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(
      await screen.findByText("Já existe um item com este endereço. Escolha outro."),
    ).toBeVisible();
    const slug = screen.getByLabelText("Endereço da página");
    await waitFor(() => expect(slug).not.toHaveAttribute("readonly"));
    expect(screen.getByText("Este endereço já está em uso. Ajuste-o para publicar.")).toBeVisible();

    await user.type(slug, "-2");
    expect(slug).toHaveValue("a-graca-que-sustenta-2");
  });

  it("valida o título antes de enviar", async () => {
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");
    await user.type(await screen.findByRole("textbox", { name: "Título" }), "ab");

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("O título precisa ter de 3 a 150 caracteres.")).toBeVisible();
  });
});

describe("edição", () => {
  it("abre com os dados, trava o endereço e salva as alterações", async () => {
    let patch: Record<string, unknown> | null = null;
    server.use(
      http.get("*/api/admin/palavra-viva/3", () =>
        HttpResponse.json({
          data: post(3, {
            youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            youtube_video_id: "dQw4w9WgXcQ",
          }),
        }),
      ),
      http.patch("*/api/admin/palavra-viva/3", async ({ request }) => {
        patch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: post(3, { title: "Título novo" }) });
      }),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/3");

    expect(await screen.findByRole("heading", { level: 1, name: "Editar mensagem" })).toBeVisible();
    const title = screen.getByRole("textbox", { name: "Título" });
    await waitFor(() => expect(title).toHaveValue("Mensagem 3"));
    expect(screen.getByLabelText("Endereço da página")).toHaveValue("mensagem-3");
    expect(screen.getByLabelText("Endereço da página")).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Link do YouTube/)).toHaveValue(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Texto da mensagem" })).toHaveTextContent(
        "Texto da mensagem.",
      ),
    );
    // Já publicada: não há o que reagendar
    expect(screen.queryByRole("radio")).toBeNull();

    await user.clear(title);
    await user.type(title, "Título novo");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(patch).not.toBeNull());
    expect(patch).toMatchObject({
      title: "Título novo",
      slug: "mensagem-3",
      youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(patch).not.toHaveProperty("published_at");
  });

  it("BR-046 avisa quando o servidor removeu formatação do texto", async () => {
    server.use(
      http.get("*/api/admin/palavra-viva/3", () => HttpResponse.json({ data: post(3) })),
      http.patch("*/api/admin/palavra-viva/3", () =>
        HttpResponse.json({ data: post(3), sanitization_warning: true }),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/3");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Mensagem 3"),
    );

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByText("Parte da formatação não é permitida e foi removida."),
    ).toBeVisible();
  });

  it("exclui com confirmação e volta para a lista", async () => {
    let deleted = false;
    server.use(
      http.get("*/api/admin/palavra-viva/3", () => HttpResponse.json({ data: post(3) })),
      http.delete("*/api/admin/palavra-viva/3", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("*/api/admin/palavra-viva", () => HttpResponse.json({ data: [], meta: meta(0) })),
    );
    const user = userEvent.setup();
    const { router } = renderAdmin("/admin/palavra-viva/3");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Mensagem 3"),
    );

    await user.click(screen.getByRole("button", { name: "Excluir mensagem" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Excluir "Mensagem 3"?')).toBeVisible();
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Excluir mensagem" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/palavra-viva"));
    expect(deleted).toBe(true);
  });

  it("mensagem inexistente mostra 'não encontramos'", async () => {
    server.use(
      http.get("*/api/admin/palavra-viva/999", () =>
        apiError("NOT_FOUND", "Não encontramos.", 404),
      ),
    );
    renderAdmin("/admin/palavra-viva/999");

    expect(await screen.findByText("Não encontramos esta mensagem.")).toBeVisible();
  });
});

describe("rascunho local (FR-077)", () => {
  const key = draftKey(COMUNICACAO.id, "mensagem", "novo");
  const saved = {
    title: "Rascunho que sobreviveu",
    slug: "rascunho-que-sobreviveu",
    body: "<p>Texto guardado</p>",
    author_display: "",
    youtube_url: "",
    when: "now",
    scheduled_at: "",
  };

  it("'Salvar rascunho' grava na hora e só existe no cadastro", async () => {
    const user = userEvent.setup();
    const first = renderAdmin("/admin/palavra-viva/nova");

    const save = await screen.findByRole("button", { name: "Salvar rascunho" });
    expect(save).toBeDisabled();

    await user.type(await screen.findByRole("textbox", { name: "Título" }), "Já");
    expect(window.localStorage.getItem(key)).toBeNull();
    await user.click(save);

    expect(JSON.parse(window.localStorage.getItem(key) ?? "{}")).toMatchObject({
      value: { title: "Já" },
    });
    expect(await screen.findByText(/Rascunho guardado neste navegador às/)).toBeVisible();
    first.unmount();
  });

  it("guarda o texto 1 s depois de digitar e oferece de volta depois que a sessão expira", async () => {
    const user = userEvent.setup();
    const first = renderAdmin("/admin/palavra-viva/nova");
    await user.type(
      await screen.findByRole("textbox", { name: "Título" }),
      "Mensagem em andamento",
    );

    await waitFor(() => expect(window.localStorage.getItem(key)).not.toBeNull(), { timeout: 4000 });
    expect(JSON.parse(window.localStorage.getItem(key) ?? "{}")).toMatchObject({
      value: { title: "Mensagem em andamento" },
    });
    first.unmount();

    // Outra abertura do formulário (depois de entrar de novo)
    resetQueryCache();
    renderAdmin("/admin/palavra-viva/nova");
    expect(
      await screen.findByText(
        "Encontramos um rascunho não salvo neste navegador. Deseja restaurar?",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Mensagem em andamento");
  });

  it("restaura título, texto formatado e endereço", async () => {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: saved }));
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");

    await user.click(await screen.findByRole("button", { name: "Restaurar" }));

    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("Rascunho que sobreviveu");
    expect(screen.getByLabelText("Endereço da página")).toHaveValue("rascunho-que-sobreviveu");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Texto da mensagem" })).toHaveTextContent(
        "Texto guardado",
      ),
    );
  });

  it("publicar com sucesso apaga o rascunho", async () => {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: saved }));
    server.use(
      http.post("*/api/admin/palavra-viva", () =>
        HttpResponse.json({ data: post(9, { slug: "rascunho-que-sobreviveu" }) }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");
    await user.click(await screen.findByRole("button", { name: "Restaurar" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Texto da mensagem" })).toHaveTextContent(
        "Texto guardado",
      ),
    );

    await user.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByText("Mensagem publicada!")).toBeVisible();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("descartar apaga o rascunho", async () => {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: saved }));
    const user = userEvent.setup();
    renderAdmin("/admin/palavra-viva/nova");

    await user.click(await screen.findByRole("button", { name: "Descartar" }));

    expect(window.localStorage.getItem(key)).toBeNull();
    expect(screen.getByRole("textbox", { name: "Título" })).toHaveValue("");
  });
});
