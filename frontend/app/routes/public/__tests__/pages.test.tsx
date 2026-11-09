import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import {
  homeFixture,
  ministriesFixture,
  renderRoute,
  resetQueryCache,
  settingsFixture,
  useSnapshots,
} from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { photos } from "~/content/photos";
import { churchAge } from "~/content/quem-somos";
import ComoChegar, { meta as comoChegarMeta } from "../como-chegar";
import Grupos, { meta as gruposMeta } from "../grupos";
import Home, { meta as homeMeta } from "../home";
import Ministerios from "../ministerios";
import PedidoDeOracao from "../pedido-de-oracao";
import QuemSomos, { meta as quemSomosMeta } from "../quem-somos";

beforeEach(() => {
  resetQueryCache();
});

const metaContent = (meta: ReadonlyArray<Record<string, string>>, key: string) =>
  meta.find((entry) => entry.property === key || entry.name === key)?.content;

describe("Início", () => {
  it("mostra boas-vindas, horários em ordem, avisos, transmissões e destaques", async () => {
    useSnapshots();
    const { container } = renderRoute(Home);

    expect(
      screen.getByRole("heading", { level: 1, name: "Seja bem-vindo. Aqui as pessoas importam." }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Planeje sua visita" })).toHaveAttribute(
      "href",
      "/como-chegar",
    );

    const schedule = await screen.findByRole("region", { name: "Horários" });
    const items = await within(schedule).findAllByRole("listitem");
    // Domingo primeiro, e dentro do dia por horário; Sexta é recorrência mensal
    expect(items.map((item) => item.textContent)).toEqual([
      "Dom09h00EBDPresencial",
      "Dom10h10Culto MatinalPresencial e YouTube",
      "Qui20h00Culto de OraçãoPresencial e online",
      "Sex19h30Culto Salt1ª sexta-feira do mês · Presencial",
    ]);
    expect(within(schedule).getByText("09h00")).toBeVisible();
    expect(within(schedule).getByText("1ª sexta-feira do mês · Presencial")).toBeVisible();

    expect(await screen.findByRole("heading", { name: "Estamos Construindo" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Contribuir via PIX/ })).toHaveAttribute(
      "href",
      "/contribua",
    );
    expect(screen.getByRole("heading", { name: "Ceia do Senhor" })).toBeVisible();
    expect(screen.getByText("Ceia do Senhor neste domingo, nos cultos.")).toBeVisible();

    expect(screen.getByRole("link", { name: /^Ao vivo/ })).toHaveAttribute(
      "href",
      "https://youtube.example.com/live",
    );
    expect(screen.getByRole("link", { name: /Canal no YouTube/ })).toHaveAttribute(
      "href",
      "https://youtube.example.com/@exemplo",
    );
    expect(screen.getByRole("link", { name: /Chamar no WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/5531999990000?text=Ol%C3%A1!",
    );

    expect(await screen.findByText("Boletim nº 1234 · 18/10/2026")).toBeVisible();
    expect(screen.getByRole("link", { name: /Ler mensagem/ })).toHaveAttribute(
      "href",
      "/palavra-viva/uma-palavra-de-esperanca",
    );
    expect(screen.queryByText(/Próximo evento/)).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("convida para a Ficha de Visitante logo depois dos horários, com link para o formulário", async () => {
    useSnapshots();
    const { container } = renderRoute(Home);

    const visitor = await screen.findByRole("region", {
      name: "É visitante? A gente quer conhecer você.",
    });
    expect(
      within(visitor).getByRole("link", { name: /Preencher a Ficha de Visitante/ }),
    ).toHaveAttribute("href", "/sou-visitante");
    expect(within(visitor).getByRole("img", { name: photos.visitor.alt })).toBeVisible();
    // As opções são as que o formulário oferece
    expect(
      within(visitor)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Receber uma visita", "Conhecer uma Célula de CL", "Participar de um grupo"]);
    expect(
      within(visitor).getByText(
        "Seus dados ficam só com a equipe da igreja e são usados apenas para falar com você.",
      ),
    ).toBeVisible();

    const schedule = screen.getByRole("region", { name: "Horários" });
    const live = screen.getByRole("region", { name: "Transmissões e atendimento" });
    expect(
      schedule.compareDocumentPosition(visitor) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(visitor.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("tem a seção do pedido de oração, com link para a página, antes de 'Para ler nesta semana'", async () => {
    useSnapshots();
    renderRoute(Home);

    const prayer = (await screen.findByRole("heading", { name: "Pedido de oração" })).closest(
      "section",
    ) as HTMLElement;
    expect(within(prayer).getByRole("link", { name: /Fazer um pedido de oração/ })).toHaveAttribute(
      "href",
      "/pedido-de-oracao",
    );
    expect(
      within(prayer).getByText(
        "Seu pedido é lido apenas pela equipe de oração. Ele não aparece no site.",
      ),
    ).toBeVisible();

    // "Para ler nesta semana" fecha a página
    const reading = await screen.findByRole("heading", { name: "Para ler nesta semana" });
    expect(prayer.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("divulga a Juventude Salt com o Culto Salt do quadro e o site deles em nova aba", async () => {
    useSnapshots();
    renderRoute(Home);

    const youth = await screen.findByRole("region", { name: "Juventude Salt" });
    const site = within(youth).getByRole("link", { name: /Conhecer o site da Juventude/ });
    expect(site).toHaveAttribute("href", "https://juventude-salt.vercel.app/");
    expect(site).toHaveAttribute("target", "_blank");
    expect(site).toHaveAttribute("rel", "noopener noreferrer");
    expect(site).toHaveTextContent("(abre em nova aba)");
    expect(within(youth).getByRole("list", { name: "Pilares da Juventude" })).toHaveTextContent(
      "FéComunidadeMissão",
    );
    // O dia e a hora vêm do quadro de horários, não de um texto fixo
    expect(await within(youth).findByText("Culto Salt")).toBeVisible();
    expect(within(youth).getByText("19h30")).toBeVisible();
    expect(within(youth).getByText("1ª sexta-feira do mês · Presencial")).toBeVisible();

    // Fica depois do pedido de oração e antes de "Para ler nesta semana"
    const prayer = screen.getByRole("heading", { name: "Pedido de oração" });
    const reading = await screen.findByRole("heading", { name: "Para ler nesta semana" });
    expect(prayer.compareDocumentPosition(youth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(youth.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sem o Culto Salt no quadro, a seção da Juventude fica só com o convite para o site", async () => {
    useSnapshots({
      settings: settingsFixture({
        schedule: [
          {
            day: "Domingo",
            recurrence: "semanal",
            activity: "EBD",
            time: "09:00",
            mode: "Presencial",
          },
        ],
      }),
    });
    renderRoute(Home);

    await screen.findByText("EBD");
    const youth = screen.getByRole("region", { name: "Juventude Salt" });
    expect(within(youth).getByRole("link", { name: /Conhecer o site da Juventude/ })).toBeVisible();
    expect(within(youth).queryByText(/Culto Salt|sexta-feira/)).not.toBeInTheDocument();
  });

  it("convida para o Instagram da igreja, com o endereço das configurações, em nova aba", async () => {
    useSnapshots({
      settings: settingsFixture({
        social_links: [
          { network: "Facebook", url: "https://facebook.example.com/igreja" },
          { network: "instagram", url: "https://www.instagram.com/pib_ls/" },
        ],
      }),
    });
    const { container } = renderRoute(Home);

    const section = await screen.findByRole("region", { name: "Acompanhe a igreja no Instagram" });
    const link = within(section).getByRole("link", { name: /Visitar o Instagram/ });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/pib_ls/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("(abre em nova aba)");
    expect(within(section).getByText("@pib_ls")).toHaveAttribute("translate", "no");

    // Fica depois da Juventude e antes de "Para ler nesta semana", que fecha a página
    const youth = screen.getByRole("region", { name: "Juventude Salt" });
    const reading = await screen.findByRole("heading", { name: "Para ler nesta semana" });
    expect(youth.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      section.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it.each([
    ["sem rede nenhuma cadastrada", []],
    ["só com outra rede", [{ network: "Facebook", url: "https://facebook.example.com/igreja" }]],
    ["com um endereço inseguro", [{ network: "Instagram", url: "javascript:alert(1)" }]],
  ])("não mostra a seção do Instagram %s", async (_case, socialLinks) => {
    useSnapshots({ settings: settingsFixture({ social_links: socialLinks }) });
    renderRoute(Home);

    await screen.findByText("EBD");
    expect(
      screen.queryByRole("heading", { name: "Acompanhe a igreja no Instagram" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["usa o primeiro endereço válido", "javascript:alert(1)", "https://instagram.com/a/", "@a"],
    ["não repete o @ do endereço", "https://instagram.com/@a", "", "@a"],
    ["sem perfil no endereço, não mostra o @", "https://instagram.com/", "", null],
    ["num endereço de publicação, não mostra o @", "https://instagram.com/p/abc/", "", null],
  ])("Instagram: %s", async (_case, first, second, handle) => {
    useSnapshots({
      settings: settingsFixture({
        social_links: [
          { network: "Instagram", url: first },
          { network: "Instagram", url: second },
        ],
      }),
    });
    renderRoute(Home);

    const section = await screen.findByRole("region", { name: "Acompanhe a igreja no Instagram" });
    expect(within(section).getByRole("link", { name: /Visitar o Instagram/ })).toHaveAttribute(
      "href",
      first.startsWith("https") ? first : second,
    );
    if (handle) expect(within(section).getByText(handle)).toBeVisible();
    else expect(within(section).queryByText(/^@/)).not.toBeInTheDocument();
  });

  it("oferece o formulário de contato ao lado do WhatsApp", async () => {
    useSnapshots();
    renderRoute(Home);

    expect(await screen.findByRole("link", { name: /Use o formulário/ })).toHaveAttribute(
      "href",
      "/contato",
    );
  });

  it("'Para ler nesta semana' sem nada publicado ainda leva às listas de boletins e mensagens", async () => {
    useSnapshots({
      home: {
        ...homeFixture,
        data: { latest_bulletin: null, latest_posts: [], upcoming_events: [] },
      },
    });
    renderRoute(Home);

    expect(await screen.findByRole("link", { name: /Ver boletins/ })).toHaveAttribute(
      "href",
      "/boletins",
    );
    expect(screen.getByRole("link", { name: /Ver mensagens/ })).toHaveAttribute(
      "href",
      "/palavra-viva",
    );
  });

  it("só mostra os avisos ativos", async () => {
    useSnapshots({
      settings: settingsFixture({
        campaign_notice: { active: false, title: "Estamos Construindo", text: "x" },
        lords_supper_notice: { active: false, text: "y" },
      }),
    });
    renderRoute(Home);

    await screen.findByText("Culto Matinal");
    expect(screen.queryByRole("heading", { name: "Avisos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Estamos Construindo" })).not.toBeInTheDocument();
  });

  it("mostra o próximo evento só com a flag de eventos ligada (R2)", async () => {
    const home = {
      ...homeFixture,
      data: {
        ...homeFixture.data,
        upcoming_events: [
          { id: 3, slug: "retiro", title: "Retiro de jovens", starts_at: "2026-11-14T13:00:00Z" },
        ],
      },
    };
    useSnapshots({ settings: settingsFixture({ features: { events: true } }), home });
    renderRoute(Home);

    const link = await screen.findByRole("link", { name: /Ver e se inscrever/ });
    expect(link).toHaveAttribute("href", "/eventos/retiro");
    expect(link).toHaveTextContent("Próximo evento · 14/11/2026");
  });

  it("some o botão do YouTube e o do WhatsApp quando a configuração não existe (cai para Contato)", async () => {
    useSnapshots({
      settings: settingsFixture({
        youtube_links: { channel_url: null, live_url: null },
        whatsapp: null,
      }),
    });
    renderRoute(Home);

    await screen.findByRole("region", { name: "Horários" });
    await screen.findByRole("heading", { name: "Fale com a gente" });
    // Sem nenhum link do YouTube, o banner do canal some inteiro, em vez de ficar sem botões
    expect(screen.queryByRole("heading", { name: "Assista aos cultos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Canal no YouTube/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contato" })).toHaveAttribute("href", "/contato");
  });

  it("não deixa um link javascript: das configurações virar href", async () => {
    useSnapshots({
      settings: settingsFixture({
        youtube_links: {
          channel_url: "javascript:alert(1)",
          live_url: "https://youtube.example.com/live",
        },
      }),
    });
    renderRoute(Home);

    await screen.findByRole("link", { name: /^Ao vivo/ });
    expect(screen.queryByRole("link", { name: /Canal no YouTube/ })).not.toBeInTheDocument();
  });

  it("FR-011 mostra o erro com 'Tentar novamente' quando nenhuma fonte responde", async () => {
    server.use(
      http.get("*/data/settings.json", () => new HttpResponse(null, { status: 503 })),
      http.get("*/api/public/settings", () => new HttpResponse(null, { status: 503 })),
      http.get("*/data/home.json", () => new HttpResponse(null, { status: 503 })),
    );
    renderRoute(Home);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo deu errado. Tente novamente em instantes.",
    );
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    // Os destaques são complemento: a falta deles não vira erro
    expect(
      screen.queryByRole("heading", { name: "Para ler nesta semana" }),
    ).not.toBeInTheDocument();
  });

  it("tem título, descrição e Open Graph próprios", () => {
    const meta = homeMeta() as ReadonlyArray<Record<string, string>>;

    expect(metaContent(meta, "og:url")).toBe("https://pibls.com/");
    expect(metaContent(meta, "description")).toContain("horários dos cultos");
  });
});

describe("Como chegar", () => {
  it("mostra o endereço, os botões de rota e o mapa só depois do toque", async () => {
    useSnapshots();
    const { container } = renderRoute(ComoChegar);

    expect(screen.getByRole("heading", { level: 1, name: "Como chegar" })).toBeVisible();
    expect(await screen.findByText("Rua de Exemplo, 100 — Centro")).toBeVisible();
    expect(screen.getByText("Lagoa Santa — MG")).toBeVisible();
    expect(screen.getByText("CEP 33400-000")).toBeVisible();
    expect(screen.getByRole("link", { name: /Abrir no Google Maps/ })).toHaveAttribute(
      "href",
      "https://maps.example.com/rota",
    );
    expect(screen.getByRole("link", { name: /Abrir no Waze/ })).toHaveAttribute(
      "href",
      "https://waze.example.com/rota",
    );

    // O mapa só carrega depois do toque (o axe roda antes: ele não atravessa o iframe no jsdom)
    expect(container.querySelector("iframe")).toBeNull();
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole("button", { name: "Mostrar o mapa" }));
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.google.com/maps/embed?pb=exemplo",
    );

    expect(screen.getByText("Domingo", { selector: "strong" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Preencher a Ficha de Visitante" })).toHaveAttribute(
      "href",
      "/sou-visitante",
    );
    const firstVisit = screen.getByRole("region", { name: "Primeira visita?" });
    expect(within(firstVisit).getByRole("img", { name: photos.firstVisit.alt })).toHaveAttribute(
      "src",
      "/images/oracao-800.webp",
    );
  });

  it("não mostra mapa nem botões de rota quando as configurações não os têm", async () => {
    useSnapshots({
      settings: settingsFixture({
        map_links: { google_maps_url: null, waze_url: null, embed_url: null },
      }),
    });
    renderRoute(ComoChegar);

    await screen.findByText("Rua de Exemplo, 100 — Centro");
    expect(screen.queryByRole("button", { name: "Mostrar o mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Google Maps/ })).not.toBeInTheDocument();
  });

  it("tem meta própria", () => {
    const meta = comoChegarMeta() as ReadonlyArray<Record<string, string>>;

    expect(metaContent(meta, "og:title")).toBe("Como chegar — PIBLS");
    expect(metaContent(meta, "og:url")).toBe("https://pibls.com/como-chegar");
  });
});

describe("Pedido de oração", () => {
  it("abre com a foto dos jovens em adoração", async () => {
    renderRoute(PedidoDeOracao);

    expect(await screen.findByRole("img", { name: photos.prayer.alt })).toHaveAttribute(
      "src",
      "/images/adoracao-jovens-800.webp",
    );
  });
});

describe("Ministérios", () => {
  it("lista só os ministérios, abre o item e leva ao contato com o ministério escolhido", async () => {
    useSnapshots();
    const { container } = renderRoute(Ministerios);

    expect(screen.getByRole("heading", { level: 1, name: "Ministérios" })).toBeVisible();
    // A foto da abertura é só desta página; a do culto continua no banner do YouTube, na Início
    expect(screen.getByRole("img", { name: photos.ministries.alt })).toHaveAttribute(
      "src",
      "/images/ministerios-800.webp",
    );
    const list = await screen.findByRole("list");
    const names = within(list)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("summary")?.textContent);
    expect(names).toEqual(["Comunicação", "Música"]);
    // O selo da abertura conta só os ministérios (grupos e células ficam de fora)
    expect(screen.getByText("ministérios em atividade").previousElementSibling).toHaveTextContent(
      /^2$/,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Conheça cada ministério" }),
    ).toBeVisible();

    const first = within(list).getAllByRole("listitem")[0] as HTMLElement;
    await userEvent.click(within(first).getByText("Comunicação"));
    expect(within(first).getByText("redes", { selector: "strong" })).toBeVisible();
    expect(within(first).getByText("Equipe de comunicação")).toBeVisible();
    expect(within(first).getByRole("link", { name: /Falar com este ministério/ })).toHaveAttribute(
      "href",
      "/contato?ministerio=1",
    );
    expect(screen.getByRole("link", { name: "Falar com um ministério" })).toHaveAttribute(
      "href",
      "/contato",
    );
    await expectNoA11yViolations(container);
  });

  it("mostra erro com 'Tentar novamente' quando o catálogo não carrega", async () => {
    server.use(
      http.get("*/data/ministries.json", () => new HttpResponse(null, { status: 500 })),
      http.get("*/api/public/ministries", () => new HttpResponse(null, { status: 500 })),
    );
    renderRoute(Ministerios);

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });
});

describe("Grupos", () => {
  const cards = () =>
    screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

  it("mostra o lema, os grupos e as células, sem endereço residencial", async () => {
    useSnapshots();
    const { container } = renderRoute(Grupos);

    expect(screen.getByRole("heading", { level: 1, name: "Para você" })).toBeVisible();
    expect(screen.getByText(/Cada um exerça o dom que recebeu/)).toBeVisible();
    expect(screen.getByText("1 Pedro 4:10")).toBeVisible();

    await screen.findByRole("heading", { name: "Homens (UMHBB)" });
    expect(cards()).toEqual([
      "Homens (UMHBB)",
      "Mulheres (MCM)",
      "Crianças (Mini PIB)",
      "Célula de CL Promissão",
      "Célula de CL Centro",
    ]);
    expect(screen.getByText("Terças, 20h")).toBeVisible();
    expect(screen.getByText("Bairro Promissão")).toBeVisible();
    expect(container.textContent).not.toMatch(/private_address|Rua Secreta/);
    await expectNoA11yViolations(container);
  });

  it("filtra por perfil, guarda o filtro na URL e limpa em 'Todos'", async () => {
    useSnapshots();
    const { router } = renderRoute(Grupos);
    await screen.findByRole("heading", { name: "Homens (UMHBB)" });

    await userEvent.click(screen.getByRole("button", { name: "Mulheres" }));

    expect(cards()).toEqual(["Mulheres (MCM)"]);
    expect(screen.getByRole("button", { name: "Mulheres" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false");
    expect(router.state.location.search).toBe("?perfil=mulheres");

    await userEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(cards()).toHaveLength(5);
    expect(router.state.location.search).toBe("");
  });

  it("filtra as células por bairro", async () => {
    useSnapshots();
    renderRoute(Grupos, "/grupos?perfil=celulas");
    await screen.findByRole("heading", { name: "Célula de CL Promissão" });
    expect(cards()).toEqual(["Célula de CL Promissão", "Célula de CL Centro"]);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Bairro das Células de CL" }),
      "Centro",
    );

    expect(cards()).toEqual(["Célula de CL Centro"]);
  });

  it("começa já filtrada pela URL e ignora valores que não conhece", async () => {
    useSnapshots();
    renderRoute(Grupos, "/grupos?perfil=homens&bairro=Inexistente");

    await screen.findByRole("heading", { name: "Homens (UMHBB)" });
    expect(cards()).toEqual(["Homens (UMHBB)"]);

    expect(screen.getByRole("button", { name: "Homens" })).toHaveAttribute("aria-pressed", "true");
  });

  it("'Quero participar' leva à Ficha de Visitante com o grupo escolhido", async () => {
    useSnapshots();
    renderRoute(Grupos, "/grupos?perfil=celulas");
    await screen.findByRole("heading", { name: "Célula de CL Promissão" });

    expect(
      screen.getByRole("link", { name: "Quero participar: Célula de CL Promissão" }),
    ).toHaveAttribute("href", "/sou-visitante?grupo=6");
  });

  it("mostra o estado vazio quando o filtro não casa nada", async () => {
    useSnapshots({
      ministries: {
        ...ministriesFixture,
        data: ministriesFixture.data.filter((item) => item.category !== "GRUPO"),
      },
    });
    renderRoute(Grupos, "/grupos?perfil=homens");

    expect(
      await screen.findByRole("heading", {
        name: "Nenhum grupo neste filtro. Escolha outro perfil ou bairro.",
      }),
    ).toBeVisible();
  });

  it("tem meta própria", () => {
    expect(metaContent(gruposMeta() as ReadonlyArray<Record<string, string>>, "og:url")).toBe(
      "https://pibls.com/grupos",
    );
  });
});

describe("Quem somos", () => {
  it("mostra a idade, a linha do tempo, o pastor, os 8 ex-pastores e a Declaração de Fé", async () => {
    const { container } = renderRoute(QuemSomos);

    expect(screen.getByRole("heading", { level: 1, name: "Quem somos" })).toBeVisible();
    expect(screen.getByRole("img", { name: photos.about.alt })).toHaveAttribute(
      "src",
      "/images/igreja-em-oracao-800.webp",
    );
    expect(screen.getByText(String(churchAge()), { selector: "span" })).toBeVisible();
    expect(screen.getByText("anos de fé e serviço")).toBeVisible();

    const shortcuts = screen.getByRole("navigation", { name: "Nesta página" });
    expect(within(shortcuts).getByRole("link", { name: "Nossa história" })).toHaveAttribute(
      "href",
      "#historia",
    );

    const timeline = screen.getByRole("region", { name: "Nossa história" });
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(6);
    expect(within(timeline).getByText("A fundação")).toBeVisible();
    expect(within(timeline).getByText("O novo pastor")).toBeVisible();

    expect(screen.getByText("Pr. Alan Gefferson de Assunção Taques")).toBeVisible();
    expect(screen.getByText("À frente da igreja desde outubro de 2026.")).toBeVisible();
    expect(screen.getByText("Formação")).toBeVisible();
    const pastors = screen.getByRole("region", { name: "Pastores que serviram a igreja" });
    expect(within(pastors).getAllByRole("listitem")).toHaveLength(9);
    expect(within(pastors).getAllByRole("listitem")[0]).toHaveTextContent(
      "Pr. Vanduídes Cristovam dos Santos",
    );

    expect(screen.getByRole("heading", { level: 2, name: "Como somos" })).toBeVisible();
    expect(screen.getByText("As pessoas, de fato, importam para nós!")).toBeVisible();
    const pillars = within(screen.getByRole("region", { name: "Como somos" }));
    for (const pillar of ["A Bíblia", "O amor", "A missão"]) {
      expect(pillars.getByRole("heading", { level: 3, name: pillar })).toBeVisible();
    }
    expect(screen.getByRole("heading", { level: 3, name: "Ceia do Senhor" })).toBeVisible();
    expect(screen.getByText(/ceia é realizada todo primeiro domingo do mês/)).toBeVisible();

    const creed = screen.getByRole("link", { name: /Ler a Declaração de Fé/ });
    expect(creed).toHaveAttribute(
      "href",
      "https://convencaobatista.com.br/site/pagina.php?MEN_ID=22",
    );
    expect(creed).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Apoie a reconstrução do templo" })).toHaveAttribute(
      "href",
      "/contribua",
    );

    const member = screen.getByRole("region", { name: "Quer ser membro da igreja?" });
    expect(within(member).getByRole("link", { name: "Quero ser membro" })).toHaveAttribute(
      "href",
      "/quero-ser-membro",
    );
    await expectNoA11yViolations(container);
  });

  it("tem meta própria", () => {
    const meta = quemSomosMeta() as ReadonlyArray<Record<string, string>>;

    expect(metaContent(meta, "og:title")).toBe("Quem somos — PIBLS");
    expect(metaContent(meta, "og:image")).toBe("https://pibls.com/og-default.png");
  });
});
