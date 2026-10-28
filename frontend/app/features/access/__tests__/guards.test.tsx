import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { visibleMenu } from "../components/admin-nav";
import {
  ROLE_PERMISSIONS,
  UNAUTHENTICATED,
  mockAdminDefaults,
  mockMe,
  renderAdmin,
  userFixture,
} from "../../../../test/admin";

beforeEach(() => {
  resetQueryCache();
  useSnapshots();
  mockAdminDefaults();
});

const loginHeading = () => screen.findByRole("heading", { level: 1, name: "Painel da equipe" });

describe("RequireAuth", () => {
  it("sem sessão, manda para /admin/entrar com a rota pedida em ?voltar", async () => {
    mockMe(null);

    const { router } = renderAdmin("/admin/usuarios?x=1");

    await loginHeading();
    expect(router.state.location.pathname).toBe("/admin/entrar");
    expect(new URLSearchParams(router.state.location.search).get("voltar")).toBe(
      "/admin/usuarios?x=1",
    );
    // quem nunca entrou não vê o aviso de sessão expirada
    expect(screen.queryByText("Sua sessão expirou. Entre novamente.")).not.toBeInTheDocument();
  });

  it("enquanto pergunta ao servidor, mostra um indicador acessível, sem piscar o login", async () => {
    server.use(
      http.get("*/api/auth/me", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ data: userFixture("SECRETARIA") });
      }),
    );

    renderAdmin("/admin");

    expect(screen.getByRole("status")).toHaveTextContent("Verificando sua sessão");
    expect(screen.queryByRole("form", { name: "Entrar no painel" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/Rafael/);
  });

  it("com sessão, mostra a tela pedida dentro do menu", async () => {
    mockMe(userFixture("PASTORAL"));

    renderAdmin("/admin/usuarios");

    expect(await screen.findByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Painel" })).toBeVisible();
  });

  it("a rota de entrada, com sessão aberta, leva ao painel (ou à rota de ?voltar)", async () => {
    mockMe(userFixture("PASTORAL"));

    const { router } = renderAdmin("/admin/entrar?voltar=%2Fadmin%2Fusuarios");

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/usuarios"));
  });

  it("erro de rede ao perguntar a sessão oferece 'Tentar novamente', sem jogar no login", async () => {
    server.use(http.get("*/api/auth/me", () => HttpResponse.error()));

    const { router } = renderAdmin("/admin");

    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/admin");
  });
});

describe("401 no meio do uso", () => {
  it("limpa a sessão, volta ao login e avisa 'Sua sessão expirou. Entre novamente.'", async () => {
    mockMe(userFixture("PASTORAL"));
    server.use(
      http.get("*/api/admin/users", () => HttpResponse.json(UNAUTHENTICATED, { status: 401 })),
    );

    const { router } = renderAdmin("/admin/usuarios");

    await loginHeading();
    expect(router.state.location.pathname).toBe("/admin/entrar");
    expect(new URLSearchParams(router.state.location.search).get("voltar")).toBe("/admin/usuarios");
    expect(screen.getByRole("status")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
  });
});

describe("RequirePermission", () => {
  it("sem a permissão da tela, mostra 'Você não tem acesso a esta área' com o caminho de volta", async () => {
    mockMe(userFixture("COMUNICACAO"));

    renderAdmin("/admin/usuarios");

    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar ao início do painel" })).toHaveAttribute(
      "href",
      "/admin",
    );
    // a lista nem é pedida ao servidor
    expect(screen.queryByText(/pessoas? com acesso/)).not.toBeInTheDocument();
    // WCAG 2.4.2: a página tem título próprio (o axe acusa `document-title` sem ele)
    await waitFor(() => expect(document.title).toBe("Sem acesso — Painel PIBLS"));
  });

  it("com a permissão, mostra a tela", async () => {
    mockMe(userFixture("ADMIN_TECNICO"));
    server.use(
      http.get("*/api/admin/users", () =>
        HttpResponse.json({
          data: [{ ...userFixture("ADMIN_TECNICO"), is_active: true, last_login_at: null }],
          meta: { page: 1, per_page: 100, total: 1, last_page: 1 },
        }),
      ),
    );

    renderAdmin("/admin/usuarios");

    expect(await screen.findByText("1 pessoa com acesso")).toBeVisible();
  });

  it("mesmo com o guard liberando por engano, a API é quem recusa (403 mostra o erro)", async () => {
    mockMe(userFixture("PASTORAL"));
    server.use(
      http.get("*/api/admin/users", () =>
        HttpResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Você não tem permissão para esta ação.",
              details: [],
              traceId: "t-403",
            },
          },
          { status: 403 },
        ),
      ),
    );

    renderAdmin("/admin/usuarios");

    expect(await screen.findByText("Você não tem permissão para esta ação.")).toBeVisible();
  });
});

describe("menu por permissão", () => {
  const labels = async () => {
    const nav = await screen.findByRole("navigation", { name: "Painel" });
    return within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
  };

  it.each([
    [
      "COMUNICACAO",
      ["Início", "Boletins", "Palavra Viva", "Ministérios e grupos", "Configurações"],
    ],
    ["SECRETARIA", ["Início", "Contatos", "Ministérios e grupos", "Configurações"]],
    ["TESOURARIA", ["Início", "PIX"]],
    ["ORACAO", ["Início", "Pedidos de oração"]],
    ["PASTORAL", ["Início", "Contatos", "Pedidos de oração", "Palavra Viva", "Usuários"]],
    ["LIDER_MINISTERIO", ["Início"]],
    ["ADMIN_TECNICO", ["Início", "Usuários"]],
  ])(
    "%s vê só o que a permissão abre (Eventos fica escondido com a flag desligada)",
    async (role, expected) => {
      mockMe(userFixture(role));

      renderAdmin("/admin");

      expect(await labels()).toEqual(expected);
    },
  );

  it("Eventos aparece quando a funcionalidade está ligada e a pessoa tem a permissão (.own inclusive)", () => {
    const can = (permission: string | readonly string[]) =>
      (Array.isArray(permission) ? permission : [permission]).some((key: string) =>
        (ROLE_PERMISSIONS.LIDER_MINISTERIO ?? []).includes(key),
      );

    const on = visibleMenu(can, { events: true }).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    const off = visibleMenu(can, { events: false }).flatMap((group) =>
      group.items.map((item) => item.label),
    );

    expect(on).toEqual(["Início", "Eventos"]);
    expect(off).toEqual(["Início"]);
  });

  it("grupo sem nenhum item visível some do menu", async () => {
    mockMe(userFixture("TESOURARIA"));

    renderAdmin("/admin");

    const nav = await screen.findByRole("navigation", { name: "Painel" });
    expect(within(nav).queryByText("Equipe")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Conteúdo")).not.toBeInTheDocument();
    expect(within(nav).getByText("Igreja")).toBeVisible();
  });

  it("marca a página atual no menu", async () => {
    mockMe(userFixture("ADMIN_TECNICO"));
    server.use(
      http.get("*/api/admin/users", () =>
        HttpResponse.json({ data: [], meta: { page: 1, per_page: 100, total: 0, last_page: 1 } }),
      ),
    );

    renderAdmin("/admin/usuarios");

    const nav = await screen.findByRole("navigation", { name: "Painel" });
    expect(within(nav).getByRole("link", { name: "Usuários" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("mostra o nome, os papéis e o ministério de quem está logado", async () => {
    mockMe(userFixture("LIDER_MINISTERIO", { name: "Bruno Líder" }));

    renderAdmin("/admin");

    const nav = await screen.findByRole("navigation", { name: "Painel" });
    const footer = nav.parentElement as HTMLElement;
    expect(within(footer).getByText("Bruno Líder")).toBeVisible();
    expect(within(footer).getByText("Liderança de ministério · Juventude")).toBeVisible();
  });
});

describe("sair", () => {
  it("encerra a sessão na API, limpa o painel e volta ao login", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("SECRETARIA"));
    let loggedOut = false;
    server.use(
      http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
      http.post("*/api/auth/logout", () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { router } = renderAdmin("/admin");
    await user.click(await screen.findByRole("button", { name: "Sair" }));

    await loginHeading();
    expect(loggedOut).toBe(true);
    expect(router.state.location.pathname).toBe("/admin/entrar");
  });

  it("FR-077 o logout explícito apaga os rascunhos de conteúdo do usuário, e só os dele", async () => {
    const user = userEvent.setup();
    mockMe(userFixture("COMUNICACAO"));
    // O módulo de rascunho é exclusivo de features/content e features/events: aqui só se usam as chaves
    window.localStorage.setItem("pibls:draft:7:boletim:novo", "{}");
    window.localStorage.setItem("pibls:draft:7:mensagem:12", "{}");
    window.localStorage.setItem("pibls:draft:70:boletim:novo", "{}");
    server.use(
      http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
      http.post("*/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
    );

    renderAdmin("/admin");
    await user.click(await screen.findByRole("button", { name: "Sair" }));
    await loginHeading();

    expect(window.localStorage.getItem("pibls:draft:7:boletim:novo")).toBeNull();
    expect(window.localStorage.getItem("pibls:draft:7:mensagem:12")).toBeNull();
    expect(window.localStorage.getItem("pibls:draft:70:boletim:novo")).not.toBeNull();
    window.localStorage.clear();
  });

  it("FR-077 a sessão que expira NÃO apaga o rascunho: ele é oferecido depois de entrar de novo", async () => {
    mockMe(userFixture("PASTORAL")); // quem abre /admin/usuarios
    window.localStorage.setItem("pibls:draft:7:boletim:novo", "{}");
    server.use(
      http.get("*/api/admin/users", () => HttpResponse.json(UNAUTHENTICATED, { status: 401 })),
    );

    renderAdmin("/admin/usuarios");
    await loginHeading();

    expect(window.localStorage.getItem("pibls:draft:7:boletim:novo")).not.toBeNull();
    window.localStorage.clear();
  });
});

describe("admin: página inexistente", () => {
  it("mostra o 404 do painel dentro do menu", async () => {
    mockMe(userFixture("SECRETARIA"));

    renderAdmin("/admin/nao-existe");

    expect(
      await screen.findByRole("heading", { name: "Esta página do painel não existe" }),
    ).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Painel" })).toBeVisible();
  });
});
