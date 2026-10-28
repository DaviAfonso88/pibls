import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { queryClient } from "~/shared/lib/query-client";
import { expectNoA11yViolations } from "../../../../test/axe";
import { renderRoute, resetQueryCache } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import Boletins, { meta as boletinsMeta } from "~/routes/public/boletins";
import PalavraViva, { meta as palavraVivaMeta } from "~/routes/public/palavra-viva";
import MensagemPalavraViva from "~/routes/public/palavra-viva-mensagem";

/*
 * Páginas públicas de Boletins e Palavra Viva (T121; design: Boletins, PalavraViva, Mensagem). Dados fictícios.
 */

beforeEach(() => {
  resetQueryCache();
});

const meta = { page: 1, per_page: 12, total: 1, last_page: 1 };

function bulletin(edition: number, overrides: Record<string, unknown> = {}) {
  return {
    id: edition,
    edition_number: edition,
    reference_date: "2026-10-18",
    title: `Semana ${edition}`,
    summary_text: `Resumo do boletim ${edition}.`,
    pdf_url: `/uploads/boletins/2026/${String(edition).padStart(32, "0")}.pdf`,
    pdf_size_bytes: 1_843_200,
    ...overrides,
  };
}

function post(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: [...slug].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) % 100_000,
    title: `Título ${slug}`,
    slug,
    excerpt: `Trecho de ${slug}.`,
    author_display: "Pr. Fulano",
    youtube_video_id: null,
    published_at: "2026-10-16T13:10:00Z",
    ...overrides,
  };
}

describe("Boletins", () => {
  it("lista os boletins com 'Ler boletim' em nova aba e 'Baixar PDF'", async () => {
    server.use(
      http.get("*/api/public/bulletins", () =>
        HttpResponse.json({ data: [bulletin(1932), bulletin(1931)], meta: { ...meta, total: 2 } }),
      ),
    );
    const { container } = renderRoute(Boletins, "/boletins");

    expect(screen.getByRole("heading", { level: 1, name: "Boletins" })).toBeVisible();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);

    const first = items[0] as HTMLElement;
    expect(within(first).getByText("Boletim nº 1932 · 18/10/2026")).toBeVisible();
    expect(within(first).getByRole("heading", { level: 2, name: "Semana 1932" })).toBeVisible();
    expect(within(first).getByText("Resumo do boletim 1932.")).toBeVisible();

    const read = within(first).getByRole("link", { name: /Ler boletim/ });
    expect(read).toHaveAttribute("target", "_blank");
    expect(read).toHaveAttribute("rel", "noopener");
    expect(read).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/uploads\/boletins\/2026\/.*\.pdf$/),
    );
    expect(read).toHaveAccessibleName(/abre em nova aba/);

    const download = within(first).getByRole("link", { name: /Baixar PDF/ });
    expect(download).toHaveAttribute("download");
    // O tamanho vem formatado com espaço sem quebra (1,8 MB)
    expect(download).toHaveAccessibleName(/1,8\sMB/);

    await expectNoA11yViolations(container);
  });

  it("filtra por ano e mês, e o filtro mora na URL", async () => {
    const requested: string[] = [];
    server.use(
      http.get("*/api/public/bulletins", ({ request }) => {
        requested.push(new URL(request.url).search);
        return HttpResponse.json({ data: [bulletin(1900)], meta });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderRoute(Boletins, "/boletins");
    await screen.findByRole("heading", { level: 2, name: "Semana 1900" });

    // O mês só vale com o ano
    expect(screen.getByLabelText("Mês")).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Ano"), "2025");
    expect(router.state.location.search).toBe("?ano=2025");
    expect(screen.getByLabelText("Mês")).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("Mês"), "Março");
    expect(router.state.location.search).toBe("?ano=2025&mes=3");
    await screen.findByRole("heading", { level: 2, name: "Semana 1900" });

    expect(requested).toContain("?year=2025&month=3");
  });

  it("lê o filtro da URL e ignora valores inválidos", async () => {
    const requested: string[] = [];
    server.use(
      http.get("*/api/public/bulletins", ({ request }) => {
        requested.push(new URL(request.url).search);
        return HttpResponse.json({ data: [], meta: { ...meta, total: 0 } });
      }),
    );
    renderRoute(Boletins, "/boletins?ano=abc&mes=99&pagina=-4");
    await screen.findByText("Nenhum boletim publicado ainda.");

    expect(requested).toEqual([""]);
  });

  it("estado vazio com filtro oferece ver todos os boletins", async () => {
    server.use(
      http.get("*/api/public/bulletins", () =>
        HttpResponse.json({ data: [], meta: { ...meta, total: 0 } }),
      ),
    );
    renderRoute(Boletins, "/boletins?ano=2025&mes=3");

    expect(await screen.findByText("Nenhum boletim publicado neste período.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver todos os boletins" })).toHaveAttribute(
      "href",
      "/boletins",
    );
  });

  it("pagina: Anterior, Próxima e 'Página X de Y' são links com a página na URL", async () => {
    server.use(
      http.get("*/api/public/bulletins", () =>
        HttpResponse.json({
          data: [bulletin(1)],
          meta: { page: 2, per_page: 12, total: 40, last_page: 4 },
        }),
      ),
    );
    renderRoute(Boletins, "/boletins?pagina=2&ano=2026");

    const nav = await screen.findByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByText("Página 2 de 4")).toBeVisible();
    expect(within(nav).getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/boletins?ano=2026",
    );
    expect(within(nav).getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/boletins?ano=2026&pagina=3",
    );
  });

  it("mostra erro com 'Tentar novamente' quando a API falha", async () => {
    server.use(
      http.get("*/api/public/bulletins", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "x", details: [], traceId: "t" } },
          { status: 500 },
        ),
      ),
    );
    renderRoute(Boletins, "/boletins");

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  it("tem título, descrição e Open Graph próprios (FR-008)", () => {
    const entries = boletinsMeta() as ReadonlyArray<Record<string, string>>;

    expect(entries.find((entry) => entry.title)?.title).toBe("Boletins — PIBLS");
    expect(entries.find((entry) => entry.property === "og:url")?.content).toMatch(/\/boletins$/);
  });
});

describe("Palavra Viva", () => {
  it("destaca a mais recente (com a miniatura do vídeo) e lista as anteriores", async () => {
    server.use(
      http.get("*/api/public/palavra-viva", () =>
        HttpResponse.json({
          data: [
            post("graca", { youtube_video_id: "dQw4w9WgXcQ" }),
            post("paz", { published_at: "2026-10-09T13:10:00Z" }),
            post("esperanca", {
              youtube_video_id: "abcdefghijk",
              published_at: "2026-10-02T13:10:00Z",
            }),
          ],
          meta: { page: 1, per_page: 10, total: 3, last_page: 1 },
        }),
      ),
    );
    const { container } = renderRoute(PalavraViva, "/palavra-viva");

    const featured = await screen.findByRole("link", { name: /Título graca/ });
    expect(featured).toHaveAttribute("href", "/palavra-viva/graca");
    expect(within(featured).getByText("Mais recente · 16/10/2026")).toBeVisible();
    expect(featured.querySelector("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );

    const previous = screen.getByRole("heading", { level: 2, name: "Mensagens anteriores" });
    const list = previous.parentElement?.querySelector("ul");
    expect(within(list as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list as HTMLElement).getByText("Com vídeo")).toBeVisible();

    await expectNoA11yViolations(container);
  });

  it("na segunda página não há destaque: todas as mensagens vão para a lista", async () => {
    server.use(
      http.get("*/api/public/palavra-viva", () =>
        HttpResponse.json({
          data: [post("a"), post("b")],
          meta: { page: 2, per_page: 10, total: 12, last_page: 2 },
        }),
      ),
    );
    renderRoute(PalavraViva, "/palavra-viva?pagina=2");

    await screen.findByRole("heading", { level: 2, name: "Mensagens anteriores" });
    expect(screen.queryByText(/Mais recente/)).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2 + 0);
  });

  it("estado vazio", async () => {
    server.use(
      http.get("*/api/public/palavra-viva", () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, per_page: 10, total: 0, last_page: 1 },
        }),
      ),
    );
    renderRoute(PalavraViva, "/palavra-viva");

    expect(await screen.findByText("Nenhuma mensagem publicada ainda.")).toBeVisible();
  });

  it("tem título, descrição e Open Graph próprios (FR-008)", () => {
    const entries = palavraVivaMeta() as ReadonlyArray<Record<string, string>>;

    expect(entries.find((entry) => entry.title)?.title).toBe("Palavra Viva — PIBLS");
  });
});

describe("Mensagem", () => {
  const detail = (overrides: Record<string, unknown> = {}) => ({
    ...post("graca", { youtube_video_id: "dQw4w9WgXcQ" }),
    body: "<h2>Subtítulo</h2><p>Primeiro <strong>parágrafo</strong>.</p><blockquote><p>Citação</p></blockquote>",
    ...overrides,
  });

  /** A rota real tem o parâmetro `:slug`; o `renderRoute` dos outros testes não o fornece. */
  function renderMessage(slug: string) {
    const router = createMemoryRouter(
      [
        { path: "/palavra-viva/:slug", Component: MensagemPalavraViva },
        { path: "*", element: <p>outra rota</p> },
      ],
      { initialEntries: [`/palavra-viva/${slug}`] },
    );
    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  const others = () =>
    http.get("*/api/public/palavra-viva", () =>
      HttpResponse.json({
        data: [post("graca"), post("paz"), post("esperanca"), post("fe")],
        meta: { page: 1, per_page: 10, total: 4, last_page: 1 },
      }),
    );

  it("mostra título, autor, vídeo sob toque, o texto e o atalho do WhatsApp", async () => {
    server.use(
      http.get("*/api/public/palavra-viva/graca", () => HttpResponse.json({ data: detail() })),
      others(),
    );
    const { container } = renderMessage("graca");

    expect(await screen.findByRole("heading", { level: 1, name: "Título graca" })).toBeVisible();
    expect(screen.getByText("Por Pr. Fulano")).toBeVisible();
    expect(screen.getByText(/^Palavra Viva · /)).toBeVisible();
    // O texto é o HTML sanitizado do servidor, dentro de `prose`
    expect(screen.getByRole("heading", { level: 2, name: "Subtítulo" })).toBeVisible();
    expect(container.querySelector(".prose strong")).toHaveTextContent("parágrafo");

    const share = screen.getByRole("link", { name: /Enviar pelo WhatsApp/ });
    expect(share).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/\?text=/));
    expect(share).toHaveAttribute("rel", "noopener");
    expect(share).toHaveAttribute("target", "_blank");

    // O axe antes do toque: o iframe do YouTube (outra janela) ele não consegue inspecionar
    await expectNoA11yViolations(container);

    // O vídeo só carrega depois do toque
    expect(container.querySelector("iframe")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: /Assistir ao vídeo/ }));
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    );
  });

  it("sem vídeo não mostra o player", async () => {
    server.use(
      http.get("*/api/public/palavra-viva/paz", () =>
        HttpResponse.json({ data: detail({ slug: "paz", title: "Paz", youtube_video_id: null }) }),
      ),
      others(),
    );
    renderMessage("paz");

    await screen.findByRole("heading", { level: 1, name: "Paz" });
    expect(screen.queryByRole("button", { name: /Assistir ao vídeo/ })).toBeNull();
  });

  it("sugere outras duas mensagens, sem repetir a que está aberta", async () => {
    server.use(
      http.get("*/api/public/palavra-viva/graca", () => HttpResponse.json({ data: detail() })),
      others(),
    );
    renderMessage("graca");

    const more = await screen.findByRole("heading", { level: 2, name: "Mais mensagens" });
    const links = within(more.parentElement as HTMLElement).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/palavra-viva/paz",
      "/palavra-viva/esperanca",
    ]);
  });

  it("BR-042 mensagem agendada, excluída ou inexistente mostra 'não encontrada' e leva às mensagens", async () => {
    server.use(
      http.get("*/api/public/palavra-viva/agendada", () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Não encontramos.", details: [], traceId: "t" } },
          { status: 404 },
        ),
      ),
    );
    renderMessage("agendada");

    expect(await screen.findByRole("heading", { name: "Mensagem não encontrada" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Todas as mensagens" })).toHaveAttribute(
      "href",
      "/palavra-viva",
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });

  it("um erro de servidor não vira 'não encontrada': oferece tentar de novo", async () => {
    server.use(
      http.get("*/api/public/palavra-viva/graca", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "x", details: [], traceId: "t" } },
          { status: 500 },
        ),
      ),
    );
    renderMessage("graca");

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Mensagem não encontrada" })).toBeNull();
  });
});
