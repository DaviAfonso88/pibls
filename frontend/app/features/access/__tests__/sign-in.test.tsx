import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import {
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
  server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
});

const envelope = (code: string, message: string, status: number, details: object[] = []) =>
  HttpResponse.json({ error: { code, message, details, traceId: "t-1" } }, { status });

async function fillLogin(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), password);
}

describe("Entrar", () => {
  it("mostra o formulário e o caminho de 'Esqueci minha senha', sem violação de acessibilidade", async () => {
    mockMe(null);

    const { container } = renderAdmin("/admin/entrar");

    expect(await screen.findByRole("form", { name: "Entrar no painel" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute(
      "href",
      "/admin/esqueci-senha",
    );
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    await expectNoA11yViolations(container);
  });

  it("não envia com os campos vazios e aponta o que falta", async () => {
    const user = userEvent.setup();
    mockMe(null);
    let calls = 0;
    server.use(http.post("*/api/auth/login", () => (calls++, envelope("X", "x", 500))));
    renderAdmin("/admin/entrar");

    await user.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe seu e-mail.")).toBeVisible();
    expect(screen.getByText("Informe sua senha.")).toBeVisible();
    expect(screen.getByLabelText("E-mail")).toHaveFocus();
    expect(calls).toBe(0);
  });

  it("entra e vai para o início do painel", async () => {
    const user = userEvent.setup();
    mockMe(null);
    let body: unknown;
    server.use(
      http.post("*/api/auth/login", async ({ request }) => {
        body = await request.json();
        mockMe(userFixture("SECRETARIA"));
        return HttpResponse.json({ data: userFixture("SECRETARIA") });
      }),
    );
    const { router } = renderAdmin("/admin/entrar");

    await fillLogin(user, "rafael@pibls.test", "uma-senha-bem-longa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin"));
    expect(body).toEqual({ email: "rafael@pibls.test", password: "uma-senha-bem-longa" });
    expect(await screen.findByRole("navigation", { name: "Painel" })).toBeVisible();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/, Rafael$/);
  });

  it("depois do login volta à rota pedida em ?voltar", async () => {
    const user = userEvent.setup();
    mockMe(null);
    server.use(
      http.post("*/api/auth/login", () => {
        mockMe(userFixture("ADMIN_TECNICO"));
        return HttpResponse.json({ data: userFixture("ADMIN_TECNICO") });
      }),
    );
    const { router } = renderAdmin("/admin/entrar?voltar=%2Fadmin%2Fusuarios");

    await fillLogin(user, "rafael@pibls.test", "uma-senha-bem-longa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/usuarios"));
  });

  it.each([
    "https://malicioso.example/admin",
    "//malicioso.example",
    "/outra-area",
    "/admin\\..\\x",
  ])("ignora um ?voltar que não é do painel (%s)", async (voltar) => {
    const user = userEvent.setup();
    mockMe(null);
    server.use(
      http.post("*/api/auth/login", () => {
        mockMe(userFixture("SECRETARIA"));
        return HttpResponse.json({ data: userFixture("SECRETARIA") });
      }),
    );
    const { router } = renderAdmin(`/admin/entrar?voltar=${encodeURIComponent(voltar)}`);

    await fillLogin(user, "rafael@pibls.test", "uma-senha-bem-longa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin"));
  });

  it("BR-070 mostra a frase única da API quando e-mail ou senha não conferem", async () => {
    const user = userEvent.setup();
    mockMe(null);
    server.use(
      http.post("*/api/auth/login", () =>
        envelope("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", 422),
      ),
    );
    renderAdmin("/admin/entrar");

    await fillLogin(user, "rafael@pibls.test", "senha-errada-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    // a tela não diz se foi o e-mail ou a senha
    expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("E-mail")).toHaveValue("rafael@pibls.test");
  });

  it("BR-071 mostra o aviso de bloqueio temporário com a frase da API", async () => {
    const user = userEvent.setup();
    mockMe(null);
    server.use(
      http.post("*/api/auth/login", () =>
        envelope(
          "TOO_MANY_REQUESTS",
          "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
          429,
        ),
      ),
    );
    renderAdmin("/admin/entrar");

    await fillLogin(user, "rafael@pibls.test", "senha-errada-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    );
  });

  it("trava o botão e mostra 'Entrando…' enquanto espera", async () => {
    const user = userEvent.setup();
    mockMe(null);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("*/api/auth/login", async () => {
        await gate;
        return envelope("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", 422);
      }),
    );
    renderAdmin("/admin/entrar");

    await fillLogin(user, "rafael@pibls.test", "uma-senha-bem-longa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("button", { name: "Entrando…" })).toBeDisabled();

    release();
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("depois de um 401 no meio do uso, o login mostra 'Sua sessão expirou. Entre novamente.'", async () => {
    mockMe(null);

    renderAdmin("/admin/entrar?motivo=expirou");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sua sessão expirou. Entre novamente.",
    );
  });
});

describe("Esqueci minha senha", () => {
  it("valida o e-mail antes de enviar", async () => {
    const user = userEvent.setup();
    mockMe(null);
    renderAdmin("/admin/esqueci-senha");

    await user.type(await screen.findByLabelText("E-mail"), "isso-nao-e-email");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeVisible();
  });

  it("mostra a mesma confirmação, exista o e-mail ou não, sem revelar nada", async () => {
    const user = userEvent.setup();
    mockMe(null);
    const sent: string[] = [];
    server.use(
      http.post("*/api/auth/forgot-password", async ({ request }) => {
        sent.push(((await request.json()) as { email: string }).email);
        return HttpResponse.json({
          data: {
            message:
              "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
          },
        });
      }),
    );
    const { container } = renderAdmin("/admin/esqueci-senha");

    await user.type(await screen.findByLabelText("E-mail"), "alguem@pibls.test");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    const status = await screen.findByRole("status");
    expect(within(status).getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
    expect(status).toHaveTextContent("Se esse e-mail tiver acesso ao painel");
    expect(status).not.toHaveTextContent("alguem@pibls.test");
    expect(sent).toEqual(["alguem@pibls.test"]);
    expect(within(status).getByRole("link", { name: "Voltar para entrar" })).toHaveAttribute(
      "href",
      "/admin/entrar",
    );
    await expectNoA11yViolations(container);
  });

  it("o limite de pedidos (429) mostra a frase da API e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    mockMe(null);
    server.use(
      http.post("*/api/auth/forgot-password", () =>
        envelope("TOO_MANY_REQUESTS", "Muitas tentativas. Tente novamente em alguns minutos.", 429),
      ),
    );
    renderAdmin("/admin/esqueci-senha");

    await user.type(await screen.findByLabelText("E-mail"), "alguem@pibls.test");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas. Tente novamente em alguns minutos.",
    );
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  });
});

describe("Redefinir senha", () => {
  const link = (token = "tok123", email = "rafael@pibls.test") =>
    window.history.replaceState(
      null,
      "",
      `/admin/redefinir-senha#token=${token}&email=${encodeURIComponent(email)}`,
    );

  beforeEach(() => {
    mockMe(null);
  });

  it("lê o token e o e-mail do fragmento e já os tira da barra de endereço", async () => {
    link();

    renderAdmin("/admin/redefinir-senha");

    expect(await screen.findByRole("form", { name: "Definir nova senha" })).toBeVisible();
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(window.location.pathname).toBe("/admin/redefinir-senha");
  });

  it("troca a senha, manda o token e o e-mail do link, e oferece entrar", async () => {
    const user = userEvent.setup();
    link("tok-abc", "rafael@pibls.test");
    let body: unknown;
    server.use(
      http.post("*/api/auth/reset-password", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { message: "Senha alterada." } });
      }),
    );
    renderAdmin("/admin/redefinir-senha");

    await user.type(await screen.findByLabelText("Nova senha"), "uma-senha-nova-bem-longa");
    await user.type(screen.getByLabelText("Repita a nova senha"), "uma-senha-nova-bem-longa");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    const done = await screen.findByRole("status");
    expect(within(done).getByRole("heading", { name: "Senha alterada" })).toBeVisible();
    expect(within(done).getByRole("link", { name: "Entrar no painel" })).toHaveAttribute(
      "href",
      "/admin/entrar",
    );
    expect(body).toEqual({
      email: "rafael@pibls.test",
      token: "tok-abc",
      password: "uma-senha-nova-bem-longa",
      password_confirmation: "uma-senha-nova-bem-longa",
    });
  });

  it("BR-073 confere no navegador o mínimo de 12 caracteres e a confirmação", async () => {
    const user = userEvent.setup();
    link();
    renderAdmin("/admin/redefinir-senha");

    await user.type(await screen.findByLabelText("Nova senha"), "curta-demai");
    await user.type(screen.getByLabelText("Repita a nova senha"), "outra-coisa");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText("A senha precisa ter pelo menos 12 caracteres.")).toBeVisible();
    expect(screen.getByText("As duas senhas precisam ser iguais.")).toBeVisible();
  });

  it("BR-073 mostra a frase da API no campo (senha vazada, por exemplo)", async () => {
    const user = userEvent.setup();
    link();
    server.use(
      http.post("*/api/auth/reset-password", () =>
        envelope("VALIDATION_ERROR", "Confira os campos destacados.", 422, [
          {
            field: "password",
            code: "strong_password",
            message: "Esta senha apareceu em vazamentos de dados. Escolha outra.",
          },
        ]),
      ),
    );
    renderAdmin("/admin/redefinir-senha");

    await user.type(await screen.findByLabelText("Nova senha"), "uma-senha-bem-longa-1");
    await user.type(screen.getByLabelText("Repita a nova senha"), "uma-senha-bem-longa-1");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(
      await screen.findByText("Esta senha apareceu em vazamentos de dados. Escolha outra."),
    ).toBeVisible();
    expect(screen.getByLabelText("Nova senha")).toHaveAttribute("aria-invalid", "true");
  });

  it("BR-072 token inválido, expirado ou usado leva a 'Link inválido ou expirado' e a pedir outro", async () => {
    const user = userEvent.setup();
    link();
    server.use(
      http.post("*/api/auth/reset-password", () =>
        envelope("INVALID_RESET_TOKEN", "Link inválido ou expirado. Solicite um novo.", 422),
      ),
    );
    renderAdmin("/admin/redefinir-senha");

    await user.type(await screen.findByLabelText("Nova senha"), "uma-senha-bem-longa-1");
    await user.type(screen.getByLabelText("Repita a nova senha"), "uma-senha-bem-longa-1");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
    expect(within(alert).getByRole("link", { name: "Pedir um novo link" })).toHaveAttribute(
      "href",
      "/admin/esqueci-senha",
    );
  });

  it("sem token no endereço, já mostra o link inválido (sem chamar a API)", async () => {
    window.history.replaceState(null, "", "/admin/redefinir-senha");
    let calls = 0;
    server.use(http.post("*/api/auth/reset-password", () => (calls++, envelope("X", "x", 500))));

    renderAdmin("/admin/redefinir-senha");

    expect(await screen.findByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
    expect(calls).toBe(0);
  });
});

describe("401 sem sessão", () => {
  it("o 401 de 'me' é só 'ninguém entrou' (não gera o aviso de sessão expirada)", async () => {
    server.use(
      http.get("*/api/auth/me", () => HttpResponse.json(UNAUTHENTICATED, { status: 401 })),
    );

    renderAdmin("/admin");

    expect(await screen.findByRole("form", { name: "Entrar no painel" })).toBeVisible();
    expect(screen.queryByText("Sua sessão expirou. Entre novamente.")).not.toBeInTheDocument();
  });
});
