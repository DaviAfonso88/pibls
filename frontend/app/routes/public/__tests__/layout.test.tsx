import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../../../test/server";
import { expectNoA11yViolations } from "../../../../test/axe";
import { setBuildSnapshotLoader } from "~/shared/http/snapshots";
import { createQueryClient, queryClient } from "~/shared/lib/query-client";
import Home from "../home";
import PublicLayout from "../layout";
import NaoEncontrado, { meta } from "../not-found";

const settings = (events: boolean) => ({
  data: {
    schedule: [
      {
        day: "Domingo",
        recurrence: "semanal",
        activity: "Culto Matinal",
        time: "10:10",
        mode: "Presencial",
      },
      {
        day: "Domingo",
        recurrence: "semanal",
        activity: "Culto Noturno",
        time: "19:30",
        mode: "Presencial",
      },
      {
        day: "Quinta-feira",
        recurrence: "semanal",
        activity: "Culto de Oração",
        time: "20:00",
        mode: "Presencial",
      },
    ],
    address: {
      street: "Rua das Flores",
      number: "100",
      complement: null,
      neighborhood: "Centro",
      city: "Lagoa Santa",
      state: "MG",
      zip: "33400000",
    },
    whatsapp: { phone: "+5531999998888", default_text: "Olá! Vim pelo site." },
    youtube_links: { channel_url: "https://youtube.com/@pibls", live_url: null },
    social_links: [
      { network: "Instagram", url: "https://instagram.com/pibls" },
      { network: "Malicioso", url: "javascript:alert(1)" },
    ],
    features: { events },
  },
  generated_at: "2026-11-08T13:10:00Z",
});

function renderSite(path = "/") {
  const router = createMemoryRouter(
    [
      {
        Component: PublicLayout,
        children: [
          { index: true, Component: Home },
          { path: "*", Component: NaoEncontrado },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...view };
}

beforeEach(() => {
  queryClient.clear();
  // Sem a espera de 1 s e 2 s entre as novas tentativas de um 5xx
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 60_000 } });
});

describe("layout público", () => {
  it("monta pular-para-o-conteúdo, cabeçalho, conteúdo e rodapé", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(false))));
    const { container } = renderSite();

    expect(screen.getByRole("link", { name: "Ir para o conteúdo" })).toHaveAttribute(
      "href",
      "#conteudo",
    );
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
    expect(screen.getByRole("main")).toHaveAttribute("id", "conteudo");
    expect(
      screen.getByRole("heading", { level: 1, name: "Seja bem-vindo. Aqui as pessoas importam." }),
    ).toBeVisible();
    expect(screen.getByRole("contentinfo", { name: "Rodapé" })).toBeVisible();
    await screen.findByText("Rua das Flores, 100 — Centro");
    await expectNoA11yViolations(container);
  });

  it("mostra o símbolo e a sigla no cabeçalho, sem o nome por extenso, e o canal do YouTube em destaque", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(false))));
    const { container } = renderSite();

    const home = screen.getByRole("link", {
      name: /^PIBLS\s*,\s*Primeira Igreja Batista em Lagoa Santa,\s*página inicial$/,
    });
    expect(home.querySelector("img")).toHaveAttribute("src", "/logos/simbolo-96.png");
    expect(within(home).getByText("PIBLS")).toBeVisible();
    // O nome por extenso fica só para leitores de tela
    expect(within(home).getByText(/Primeira Igreja Batista em Lagoa Santa/)).toHaveClass("sr-only");

    // O canal está no cabeçalho e, em destaque, no rodapé (que não repete o nome da igreja nem a frase de efeito)
    const footer = screen.getByRole("contentinfo", { name: "Rodapé" });
    await waitFor(() =>
      expect(within(footer).getByRole("link", { name: /Ver o canal/ })).toHaveAttribute(
        "href",
        "https://youtube.com/@pibls",
      ),
    );
    const header = container.querySelector("header") as HTMLElement;
    expect(within(header).getByRole("link", { name: /YouTube/ })).toHaveAttribute(
      "href",
      "https://youtube.com/@pibls",
    );
    expect(footer.querySelector("img")).toHaveAttribute("src", "/logos/simbolo-96.png");
    expect(within(footer).queryByText("Aqui as pessoas importam.")).not.toBeInTheDocument();
    expect(
      within(footer).queryByText("Primeira Igreja Batista em Lagoa Santa"),
    ).not.toBeInTheDocument();
  });

  it("marca a página atual no menu", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(false))));
    renderSite("/");

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).getByRole("link", { name: "Início" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Quem somos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("esconde Eventos enquanto a flag estiver desligada, inclusive antes de as configurações chegarem", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(false))));
    renderSite();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });

    expect(within(nav).queryByRole("link", { name: "Eventos" })).not.toBeInTheDocument();
    await screen.findByText("Rua das Flores, 100 — Centro");
    expect(within(nav).queryByRole("link", { name: "Eventos" })).not.toBeInTheDocument();
    expect(within(nav).getAllByRole("link")).toHaveLength(9);
  });

  it("mostra Eventos quando a flag está ligada (R2)", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(true))));
    renderSite();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });

    expect(await within(nav).findByRole("link", { name: "Eventos" })).toHaveAttribute(
      "href",
      "/eventos",
    );
    expect(within(nav).getAllByRole("link")).toHaveLength(10);
  });

  it("preenche o rodapé com as configurações, ignorando link que não é http(s)", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(false))));
    renderSite();
    const footer = screen.getByRole("contentinfo");

    expect(await within(footer).findByText("Rua das Flores, 100 — Centro")).toBeVisible();
    expect(within(footer).getByText("Lagoa Santa — MG")).toBeVisible();
    expect(within(footer).getByText("Domingo · 10h10 e 19h30")).toBeVisible();
    expect(within(footer).getByText("Quinta · 20h00")).toBeVisible();
    expect(
      within(footer).getByRole("link", { name: /WhatsApp \(31\) 99999-8888/ }),
    ).toHaveAttribute("href", "https://wa.me/5531999998888?text=Ol%C3%A1!%20Vim%20pelo%20site.");
    expect(within(footer).getByRole("link", { name: /Ver o canal/ })).toHaveAttribute(
      "href",
      "https://youtube.com/@pibls",
    );
    expect(within(footer).getByRole("link", { name: /Instagram/ })).toBeVisible();
    expect(within(footer).queryByText(/Malicioso/)).not.toBeInTheDocument();
    expect(within(footer).getByText(/CNPJ 20\.969\.119\/0001-84/)).toBeVisible();
    expect(within(footer).getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute(
      "href",
      "/privacidade",
    );
    expect(within(footer).getByRole("link", { name: "Acesso da equipe" })).toHaveAttribute(
      "href",
      "/admin/entrar",
    );
  });

  it("FR-011 segue de pé sem nenhuma fonte de configurações, só com os links fixos", async () => {
    server.use(
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 503 })),
      http.get("*/api/public/settings", () => new HttpResponse(null, { status: 503 })),
    );
    const { container } = renderSite();
    const footer = screen.getByRole("contentinfo");

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(within(footer).getByRole("link", { name: "Como chegar" })).toBeVisible();
    expect(within(footer).getByRole("link", { name: "Contato" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Eventos" })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("FR-011 avisa que as informações podem estar desatualizadas quando só o snapshot do build responde", async () => {
    server.use(
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 503 })),
      http.get("*/api/public/settings", () => new HttpResponse(null, { status: 503 })),
    );
    setBuildSnapshotLoader(() => Promise.resolve(settings(false)));
    renderSite();

    const notice = await screen.findByText("Algumas informações podem estar desatualizadas.");
    expect(notice.closest("[role=status]")).not.toBeNull();
    // O rodapé usa o dado do build, que ainda é melhor do que nenhum
    expect(await screen.findByText("Rua das Flores, 100 — Centro")).toBeVisible();
  });

  it("leva o foco ao título da nova página depois de navegar", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(false))));
    renderSite("/");

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    await userEvent.click(within(nav).getByRole("link", { name: "Contato" }));

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Não encontramos esta página",
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});

describe("404", () => {
  it("oferece os três atalhos e fica fora do índice de busca", async () => {
    server.use(http.get("*/data/settings.json", () => HttpResponse.json(settings(false))));
    const { container } = renderSite("/pagina-que-nao-existe");

    expect(screen.getByText("Erro 404")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Não encontramos esta página" }),
    ).toBeVisible();
    const shortcuts = screen.getByRole("navigation", { name: "Atalhos" });
    expect(within(shortcuts).getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(within(shortcuts).getByRole("link", { name: "Horários dos cultos" })).toHaveAttribute(
      "href",
      "/#horarios",
    );
    expect(within(shortcuts).getByRole("link", { name: "Contato" })).toHaveAttribute(
      "href",
      "/contato",
    );
    expect(meta()).toContainEqual({ name: "robots", content: "noindex" });
    expect(meta()).toContainEqual({ title: "Não encontramos esta página — PIBLS" });
    await expectNoA11yViolations(container);
  });
});

describe("cache do site", () => {
  it("usa o cliente único da aplicação", () => {
    expect(createQueryClient()).not.toBe(queryClient);
  });
});
