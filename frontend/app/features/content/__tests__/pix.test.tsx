import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import {
  renderRoute,
  resetQueryCache,
  settingsFixture,
  useSnapshots,
} from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import Contribua, { meta as contribuaMeta } from "~/routes/public/contribua";

/*
 * PIX: a página pública Contribua (CAP-04) e a tela do painel (CAP-18; design: Contribua, AdminPix). BR-060 a BR-063 e
 * BR-045 valem no servidor; aqui se confere o que a tela mostra e manda.
 */

const PIX = {
  pix_key: "20969119000184",
  beneficiary_name: "Primeira Igreja Batista em Lagoa Santa",
  qr_image_url: "/uploads/pix/2026/0123456789abcdef0123456789abcdef.png",
  copy_paste_code:
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
};

beforeEach(() => {
  resetQueryCache();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

/** Registra o que o código põe no `FormData` (`set`); o mock chama o original. */
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

function setClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("Contribua (público)", () => {
  it("mostra QR Code, favorecido, a chave formatada, o Copia e Cola, os 3 passos e o versículo", async () => {
    useSnapshots({ settings: settingsFixture({ pix: PIX }) });
    const { container } = renderRoute(Contribua, "/contribua");

    expect(screen.getByRole("heading", { level: 1, name: "Contribua" })).toBeVisible();
    expect(await screen.findByRole("heading", { level: 2, name: "PIX da igreja" })).toBeVisible();
    expect(screen.getByAltText("QR Code do PIX da igreja")).toHaveAttribute(
      "src",
      PIX.qr_image_url,
    );
    expect(
      screen.getByText("Primeira Igreja Batista em Lagoa Santa", { selector: "span" }),
    ).toBeVisible();
    expect(screen.getByText("20.969.119/0001-84")).toBeVisible();
    expect(screen.getByText(/^00020126580014/)).toBeVisible();

    const steps = screen.getByRole("heading", { level: 2, name: "Como contribuir" }).parentElement;
    expect(within(steps as HTMLElement).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("2 Coríntios 9:7")).toBeVisible();
    expect(screen.getByText(/Deus ama a quem contribui com alegria/)).toBeVisible();

    await expectNoA11yViolations(container);
  });

  it("copia a chave sem máscara e confirma com 'Chave copiada!'", async () => {
    useSnapshots({ settings: settingsFixture({ pix: PIX }) });
    const writeText = vi.fn().mockResolvedValue(undefined);
    renderRoute(Contribua, "/contribua");
    setClipboard(writeText);

    fireEvent.click(await screen.findByRole("button", { name: "Copiar chave" }));

    expect(await screen.findByRole("button", { name: "Chave copiada!" })).toBeVisible();
    expect(writeText).toHaveBeenCalledWith("20969119000184");
  });

  it("copia o Copia e Cola inteiro, à parte da chave", async () => {
    useSnapshots({ settings: settingsFixture({ pix: PIX }) });
    const writeText = vi.fn().mockResolvedValue(undefined);
    renderRoute(Contribua, "/contribua");
    setClipboard(writeText);

    fireEvent.click(await screen.findByRole("button", { name: "Copiar código" }));

    expect(await screen.findByRole("button", { name: "Código copiado!" })).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(PIX.copy_paste_code);
  });

  it("sem Clipboard API cai no 'toque e segure para copiar'", async () => {
    useSnapshots({ settings: settingsFixture({ pix: PIX }) });
    renderRoute(Contribua, "/contribua");

    fireEvent.click(await screen.findByRole("button", { name: "Copiar chave" }));

    expect(
      await screen.findByText("Não foi possível copiar. Toque e segure a chave para copiar."),
    ).toBeVisible();
  });

  it("sem QR Code e sem Copia e Cola mostra só o que existe", async () => {
    useSnapshots({
      settings: settingsFixture({ pix: { ...PIX, qr_image_url: null, copy_paste_code: null } }),
    });
    renderRoute(Contribua, "/contribua");

    await screen.findByRole("button", { name: "Copiar chave" });
    expect(screen.queryByAltText("QR Code do PIX da igreja")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar código" })).toBeNull();
  });

  it("a campanha aparece só enquanto está ativa", async () => {
    useSnapshots({
      settings: settingsFixture({
        pix: PIX,
        campaign_notice: {
          active: true,
          title: "Estamos Construindo",
          text: "Ajude a reconstruir o templo.",
        },
      }),
    });
    renderRoute(Contribua, "/contribua");
    expect(
      await screen.findByRole("heading", { level: 2, name: "Estamos Construindo" }),
    ).toBeVisible();
    expect(screen.getByText("Ajude a reconstruir o templo.")).toBeVisible();
  });

  it("sem campanha ativa não mostra o bloco", async () => {
    useSnapshots({
      settings: settingsFixture({
        pix: PIX,
        campaign_notice: { active: false, title: "Estamos Construindo", text: "x" },
      }),
    });
    renderRoute(Contribua, "/contribua");

    await screen.findByRole("button", { name: "Copiar chave" });
    expect(screen.queryByRole("heading", { name: "Estamos Construindo" })).toBeNull();
  });

  it("sem dados do PIX avisa e não mostra botão de copiar", async () => {
    useSnapshots({ settings: settingsFixture({ pix: null }) });
    renderRoute(Contribua, "/contribua");

    expect(await screen.findByText(/Os dados do PIX não estão disponíveis agora/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Copiar chave" })).toBeNull();
  });

  it("tem título, descrição e Open Graph próprios (FR-008)", () => {
    const entries = contribuaMeta() as ReadonlyArray<Record<string, string>>;

    expect(entries.find((entry) => entry.title)?.title).toBe("Contribua — PIBLS");
    expect(entries.find((entry) => entry.property === "og:url")?.content).toMatch(/\/contribua$/);
  });
});

describe("/admin/pix", () => {
  const TESOURARIA = userFixture("TESOURARIA");

  function current(overrides: Record<string, unknown> = {}) {
    return { ...PIX, ...overrides };
  }

  function mockPix(
    data: Record<string, unknown> = current(),
    history: unknown[] = [
      {
        id: 3,
        occurred_at: "2026-10-20T17:30:00Z",
        actor: { id: 7, name: "Teresa Tesoureira" },
        fields: ["pix_key", "qr_image"],
      },
    ],
  ) {
    server.use(http.get("*/api/admin/settings/pix", () => HttpResponse.json({ data, history })));
  }

  const apiError = (code: string, message: string, status: number, details: object[] = []) =>
    HttpResponse.json({ error: { code, message, details, traceId: "t" } }, { status });

  beforeEach(() => {
    useSnapshots();
    mockAdminDefaults();
    mockMe(TESOURARIA);
    server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
  });

  async function openForm() {
    const view = renderAdmin("/admin/pix");
    const key = await screen.findByLabelText("Chave");
    await waitFor(() => expect(key).toHaveValue("20.969.119/0001-84"));
    return view;
  }

  /** Clica em "Salvar alteração" e devolve o diálogo da senha. */
  async function askPassword(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Salvar alteração" }));
    return screen.findByRole("dialog", { name: "Confirme sua senha" });
  }

  it("mostra os dados vigentes, o aviso de segurança e o histórico das alterações", async () => {
    mockPix();
    const { container } = await openForm();

    expect(screen.getByRole("heading", { level: 1, name: "Chave PIX" })).toBeVisible();
    expect(screen.getByLabelText("Nome do favorecido")).toHaveValue(
      "Primeira Igreja Batista em Lagoa Santa",
    );
    expect(screen.getByLabelText(/Pix Copia e Cola/)).toHaveValue(PIX.copy_paste_code);
    expect(screen.getByAltText("QR atual")).toHaveAttribute("src", PIX.qr_image_url);
    expect(screen.getByText(/Para mudar a chave, você confirma sua senha/)).toBeVisible();

    const site = screen.getByRole("region", { name: "No site agora" });
    expect(within(site).getByText("20.969.119/0001-84")).toBeVisible();
    expect(within(site).getByRole("link", { name: "Ver a página Contribua" })).toHaveAttribute(
      "href",
      "/contribua",
    );

    const history = screen.getByRole("region", { name: "Alterações" });
    expect(
      within(history).getByText("Alterou a chave e o QR Code por Teresa Tesoureira"),
    ).toBeVisible();
    expect(within(history).getByText(/20\/10\/2026 às 14h30/)).toBeVisible();

    await expectNoA11yViolations(container);
  });

  it("não guarda nada no navegador: nem rascunho, nem a senha", async () => {
    mockPix();
    const user = userEvent.setup();
    await openForm();

    await user.clear(screen.getByLabelText("Nome do favorecido"));
    await user.type(screen.getByLabelText("Nome do favorecido"), "Outro nome");
    await user.click(screen.getByRole("button", { name: "Salvar alteração" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirme sua senha" });
    await user.type(within(dialog).getByLabelText("Senha"), "segredo-123456");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain("segredo");
  });

  it("pede a senha em um diálogo antes de enviar e manda tudo em multipart, sem QR se não houve troca", async () => {
    mockPix();
    // O jsdom monta o multipart de um jeito que o MSW não lê: confere-se o que o código põe no FormData
    const fields = captureFormFields();
    let received = 0;
    server.use(
      http.post("*/api/admin/settings/pix", () => {
        received += 1;
        return HttpResponse.json({ data: current({ beneficiary_name: "Novo favorecido" }) });
      }),
    );
    const user = userEvent.setup();
    await openForm();

    await user.clear(screen.getByLabelText("Nome do favorecido"));
    await user.type(screen.getByLabelText("Nome do favorecido"), "Novo favorecido");
    const dialog = await askPassword(user);
    // Nada foi enviado ainda: o diálogo vem antes
    expect(received).toBe(0);
    expect(within(dialog).getByText(/A chave PIX aparece para quem vai contribuir/)).toBeVisible();
    expect(within(dialog).getByLabelText("Senha")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );

    await user.type(within(dialog).getByLabelText("Senha"), "minha-senha-forte");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar e salvar" }));

    expect(await screen.findByText("Chave PIX atualizada.")).toBeVisible();
    expect(screen.getByText(/O aviso para os responsáveis entrou na fila de envio/)).toBeVisible();
    expect(received).toBe(1);
    expect(fields.get("pix_key")).toBe("20969119000184");
    expect(fields.get("beneficiary_name")).toBe("Novo favorecido");
    expect(fields.get("current_password")).toBe("minha-senha-forte");
    expect(fields.has("qr_image")).toBe(false);
    // A senha some junto com o diálogo
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("BR-060 senha errada: o diálogo continua aberto com a frase da regra e o campo limpo", async () => {
    mockPix();
    server.use(
      http.post("*/api/admin/settings/pix", () =>
        apiError(
          "PASSWORD_CONFIRMATION_FAILED",
          "Senha incorreta. Os dados PIX não foram alterados.",
          422,
          [
            {
              field: "current_password",
              code: "password_confirmation_failed",
              message: "Senha incorreta. Os dados PIX não foram alterados.",
            },
          ],
        ),
      ),
    );
    const user = userEvent.setup();
    await openForm();

    const dialog = await askPassword(user);
    await user.type(within(dialog).getByLabelText("Senha"), "errada");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar e salvar" }));

    expect(
      await within(dialog).findByText("Senha incorreta. Os dados PIX não foram alterados."),
    ).toBeVisible();
    expect(within(dialog).getByLabelText("Senha")).toHaveValue("");
    expect(within(dialog).getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Chave PIX atualizada.")).toBeNull();
  });

  it("BR-060 depois de muitas senhas erradas o servidor bloqueia (429) e a tela mostra a mensagem", async () => {
    mockPix();
    server.use(
      http.post("*/api/admin/settings/pix", () =>
        apiError("TOO_MANY_REQUESTS", "Muitas tentativas. Tente novamente em alguns minutos.", 429),
      ),
    );
    const user = userEvent.setup();
    await openForm();

    const dialog = await askPassword(user);
    await user.type(within(dialog).getByLabelText("Senha"), "qualquer");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar e salvar" }));

    expect(
      await within(dialog).findByText("Muitas tentativas. Tente novamente em alguns minutos."),
    ).toBeVisible();
  });

  it("BR-063 sem destinatários do alerta no servidor, mostra a frase da regra e fecha o diálogo", async () => {
    mockPix();
    server.use(
      http.post("*/api/admin/settings/pix", () =>
        apiError(
          "PIX_ALERT_NOT_CONFIGURED",
          "Alteração bloqueada: os destinatários do alerta de PIX não estão configurados no servidor. Fale com o administrador técnico.",
          409,
        ),
      ),
    );
    const user = userEvent.setup();
    await openForm();

    const dialog = await askPassword(user);
    await user.type(within(dialog).getByLabelText("Senha"), "minha-senha");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar e salvar" }));

    expect(
      await screen.findByText(/Alteração bloqueada: os destinatários do alerta de PIX/),
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Chave PIX atualizada.")).toBeNull();
  });

  it("BR-061 um CNPJ inválido nem chega ao diálogo da senha", async () => {
    mockPix();
    let called = false;
    server.use(
      http.post("*/api/admin/settings/pix", () => {
        called = true;
        return HttpResponse.json({ data: current() });
      }),
    );
    const user = userEvent.setup();
    await openForm();

    const key = screen.getByLabelText("Chave");
    await user.clear(key);
    await user.type(key, "11222333000182");
    await user.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(await screen.findByText("Informe um CNPJ válido.")).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(called).toBe(false);
  });

  it("aplica a máscara do CNPJ enquanto digita", async () => {
    mockPix();
    const user = userEvent.setup();
    await openForm();

    const key = screen.getByLabelText("Chave");
    await user.clear(key);
    await user.type(key, "11222333000181");

    expect(key).toHaveValue("11.222.333/0001-81");
  });

  it("BR-062 o 422 do Copia e Cola aparece no campo, e o diálogo fecha", async () => {
    mockPix();
    server.use(
      http.post("*/api/admin/settings/pix", () =>
        apiError("VALIDATION_ERROR", "Dados inválidos.", 422, [
          {
            field: "copy_paste_code",
            code: "invalid",
            message:
              "O código Pix Copia e Cola é inválido. Copie-o novamente do aplicativo do banco.",
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    await openForm();

    const dialog = await askPassword(user);
    await user.type(within(dialog).getByLabelText("Senha"), "minha-senha");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar e salvar" }));

    expect(
      await screen.findByText(
        "O código Pix Copia e Cola é inválido. Copie-o novamente do aplicativo do banco.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("BR-045 recusa na hora um QR que não é PNG ou JPEG", async () => {
    mockPix();
    const user = userEvent.setup({ applyAccept: false });
    await openForm();

    await user.upload(
      document.querySelector<HTMLInputElement>("#qr") as HTMLInputElement,
      new File(["gif"], "qr.gif", { type: "image/gif" }),
    );

    expect(
      await screen.findByText("O QR Code precisa ser PNG ou JPEG, com até 1 MB."),
    ).toBeVisible();
  });

  it("sem QR atual exige que se envie um antes de pedir a senha", async () => {
    mockPix(current({ qr_image_url: null }));
    const user = userEvent.setup();
    await openForm();

    await user.click(screen.getByRole("button", { name: "Salvar alteração" }));

    expect(await screen.findByText("Envie o QR Code do PIX.")).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancelar fecha o diálogo sem enviar", async () => {
    mockPix();
    let called = false;
    server.use(
      http.post("*/api/admin/settings/pix", () => {
        called = true;
        return HttpResponse.json({ data: current() });
      }),
    );
    const user = userEvent.setup();
    await openForm();

    const dialog = await askPassword(user);
    await user.type(within(dialog).getByLabelText("Senha"), "minha-senha");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(called).toBe(false);
  });

  it("BR-076 quem não é da Tesouraria vê 'sem acesso'", async () => {
    mockMe(userFixture("COMUNICACAO"));
    let called = false;
    server.use(
      http.get("*/api/admin/settings/pix", () => {
        called = true;
        return HttpResponse.json({ data: current(), history: [] });
      }),
    );
    renderAdmin("/admin/pix");

    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
    expect(called).toBe(false);
  });

  it("a Tesouraria vê o item PIX no menu", async () => {
    mockPix();
    renderAdmin("/admin");

    expect(await screen.findByRole("link", { name: "PIX" })).toHaveAttribute("href", "/admin/pix");
  });
});
