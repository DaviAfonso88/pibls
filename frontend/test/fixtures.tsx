import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ComponentType } from "react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { queryClient } from "~/shared/lib/query-client";
import { server } from "./server";

/** Dados fictícios no formato de `data/*.json` (contracts/snapshots.md). Nada daqui é conteúdo real da igreja. */
export function settingsFixture(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      schedule: [
        {
          day: "Sexta-feira",
          recurrence: "1ª sexta-feira do mês",
          activity: "Culto Salt",
          time: "19:30",
          mode: "Presencial",
        },
        {
          day: "Quinta-feira",
          recurrence: "semanal",
          activity: "Culto de Oração",
          time: "20:00",
          mode: "Presencial e online",
        },
        {
          day: "Domingo",
          recurrence: "semanal",
          activity: "Culto Matinal",
          time: "10:10",
          mode: "Presencial e YouTube",
        },
        {
          day: "Domingo",
          recurrence: "semanal",
          activity: "EBD",
          time: "09:00",
          mode: "Presencial",
        },
      ],
      campaign_notice: {
        active: true,
        title: "Estamos Construindo",
        text: "Ajude a reconstruir o templo.",
      },
      lords_supper_notice: { active: true, text: "Ceia do Senhor neste domingo, nos cultos." },
      address: {
        street: "Rua de Exemplo",
        number: "100",
        complement: null,
        neighborhood: "Centro",
        city: "Lagoa Santa",
        state: "MG",
        zip: "33400000",
      },
      map_links: {
        google_maps_url: "https://maps.example.com/rota",
        waze_url: "https://waze.example.com/rota",
        embed_url: "https://www.google.com/maps/embed?pb=exemplo",
      },
      whatsapp: { phone: "+5531999990000", default_text: "Olá!" },
      youtube_links: {
        channel_url: "https://youtube.example.com/@exemplo",
        live_url: "https://youtube.example.com/live",
      },
      social_links: [],
      pix: null,
      features: { events: false },
      ...overrides,
    },
    generated_at: "2026-10-20T12:00:00Z",
  };
}

export const ministriesFixture = {
  data: [
    {
      id: 1,
      category: "MINISTERIO",
      name: "Comunicação",
      description: "<p>Cuida das <strong>redes</strong> e do site.</p>",
      leaders_text: "Equipe de comunicação",
      schedule_text: null,
      neighborhood: null,
      contact_phone: null,
    },
    {
      id: 2,
      category: "MINISTERIO",
      name: "Música",
      description: null,
      leaders_text: null,
      schedule_text: "Ensaios às quartas",
      neighborhood: null,
      contact_phone: null,
    },
    {
      id: 3,
      category: "GRUPO",
      name: "Homens (UMHBB)",
      description: null,
      leaders_text: null,
      schedule_text: "Último sábado do mês, 20h",
      neighborhood: null,
      contact_phone: null,
    },
    {
      id: 4,
      category: "GRUPO",
      name: "Mulheres (MCM)",
      description: null,
      leaders_text: null,
      schedule_text: "3º sábado do mês, 17h30",
      neighborhood: null,
      contact_phone: null,
    },
    {
      id: 5,
      category: "GRUPO",
      name: "Crianças (Mini PIB)",
      description: null,
      leaders_text: null,
      schedule_text: "Domingos, 9h",
      neighborhood: null,
      contact_phone: null,
    },
    {
      id: 6,
      category: "CELULA",
      name: "Célula de CL Promissão",
      description: null,
      leaders_text: null,
      schedule_text: "Terças, 20h",
      neighborhood: "Promissão",
      contact_phone: null,
    },
    {
      id: 7,
      category: "CELULA",
      name: "Célula de CL Centro",
      description: null,
      leaders_text: null,
      schedule_text: "Quartas, 20h",
      neighborhood: "Centro",
      contact_phone: null,
    },
  ],
  generated_at: "2026-10-20T12:00:00Z",
};

export const homeFixture = {
  data: {
    latest_bulletin: {
      id: 9,
      edition_number: 1234,
      reference_date: "2026-10-18",
      title: "Boletim da semana",
      summary_text: null,
      pdf_url: "/uploads/boletins/2026/a.pdf",
    },
    latest_posts: [
      {
        id: 5,
        title: "Uma palavra de esperança",
        slug: "uma-palavra-de-esperanca",
        excerpt: "Resumo.",
        published_at: "2026-10-16T12:00:00Z",
      },
    ],
    upcoming_events: [] as Array<{ id: number; slug: string; title: string; starts_at: string }>,
  },
  generated_at: "2026-10-20T12:00:00Z",
};

/** Liga os três snapshots estáticos (`/data/*.json`) com os dados fictícios. */
export function useSnapshots(
  options: {
    settings?: ReturnType<typeof settingsFixture>;
    ministries?: typeof ministriesFixture;
    home?: { data: unknown; generated_at: string };
  } = {},
) {
  server.use(
    http.get("*/data/settings.json", () =>
      HttpResponse.json(options.settings ?? settingsFixture()),
    ),
    http.get("*/data/ministries.json", () =>
      HttpResponse.json(options.ministries ?? ministriesFixture),
    ),
    http.get("*/data/home.json", () => HttpResponse.json(options.home ?? homeFixture)),
  );
}

/** Limpa o cache do TanStack Query e tira a espera entre tentativas, para o teste não depender de relógio. */
export function resetQueryCache() {
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 60_000 } });
}

/** Renderiza uma página sozinha (sem o layout do site) num roteador em memória, com o cache de dados. */
export function renderRoute(Page: ComponentType, path = "/") {
  const router = createMemoryRouter(
    [
      { path: path.split("?")[0], Component: Page },
      { path: "*", element: <p>outra rota</p> },
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
