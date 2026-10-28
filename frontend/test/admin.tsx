import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router";
import AdminApp from "~/routes/admin/app";
import { queryClient } from "~/shared/lib/query-client";
import { server } from "./server";
import type { AuthUser } from "~/features/access/api";

/** O que cada papel de referência recebe (espelho de `role_templates`, no seed do backend). */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  COMUNICACAO: [
    "boletins.write",
    "eventos.inscricoes.read",
    "eventos.write",
    "mensagens.write",
    "ministerios.write",
    "settings.write",
  ],
  SECRETARIA: [
    "eventos.inscricoes.read",
    "leads.manage",
    "leads.read",
    "ministerios.write",
    "settings.write",
  ],
  TESOURARIA: ["pix.write"],
  ORACAO: ["leads.oracao.manage", "leads.oracao.read"],
  PASTORAL: ["leads.oracao.read", "leads.read", "mensagens.write", "users.read"],
  LIDER_MINISTERIO: ["eventos.inscricoes.read.own", "eventos.write.own"],
  ADMIN_TECNICO: ["users.read"],
};

export function userFixture(role: string, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 7,
    name: "Rafael Souza",
    email: "rafael@pibls.test",
    ministry: role === "LIDER_MINISTERIO" ? { id: 2, name: "Juventude" } : null,
    roles: [role],
    permissions: ROLE_PERMISSIONS[role] ?? [],
    ...overrides,
  };
}

export const UNAUTHENTICATED = {
  error: {
    code: "UNAUTHENTICATED",
    message: "Sua sessão expirou. Entre novamente.",
    details: [],
    traceId: "t-401",
  },
};

/** `GET /api/auth/me`: o usuário da sessão, ou 401 se `null`. */
export function mockMe(user: AuthUser | null) {
  server.use(
    http.get("*/api/auth/me", () =>
      user === null
        ? HttpResponse.json(UNAUTHENTICATED, { status: 401 })
        : HttpResponse.json({ data: user }),
    ),
  );
}

/**
 * Respostas padrão do que o painel pede sozinho (a lista de usuários, os contatos e o resumo do Início). Chame no `beforeEach`: o
 * teste que precisa de outra resposta registra a sua depois, e a mais nova vale.
 */
export function mockAdminDefaults() {
  const notFound = () =>
    HttpResponse.json(
      { error: { code: "NOT_FOUND", message: "Não encontramos.", details: [], traceId: "t-404" } },
      { status: 404 },
    );

  server.use(
    http.get("*/api/admin/users", () =>
      HttpResponse.json({ data: [], meta: { page: 1, per_page: 100, total: 0, last_page: 1 } }),
    ),
    http.get("*/api/admin/leads", notFound),
    // O que o Início pede para o resumo, as inscrições de hoje e "Nesta semana"
    http.get("*/api/admin/registrations/today", notFound),
    http.get("*/api/admin/events", notFound),
    http.get("*/api/admin/bulletins", notFound),
    http.get("*/api/admin/palavra-viva", notFound),
  );
}

/** O painel inteiro, com o roteamento real (`admin/*`), num roteador em memória. O resto do site cai num marcador. */
export function renderAdmin(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/admin/*", Component: AdminApp },
      { path: "*", element: <p>site público</p> },
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
