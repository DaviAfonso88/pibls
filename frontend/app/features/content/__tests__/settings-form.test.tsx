import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import { resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";

/*
 * Configurações do site no painel (CAP-17; design: AdminConfiguracoes). Aqui se confere o que a tela mostra, valida e
 * manda; as regras (BR-011, BR-051…) valem no servidor e têm os testes de feature do backend.
 */

const SETTINGS = {
  schedule: [
    {
      day: "Domingo",
      recurrence: "semanal",
      activity: "Culto Matinal",
      time: "10:10",
      mode: "Presencial e YouTube",
    },
    {
      day: "Quinta-feira",
      recurrence: "semanal",
      activity: "Culto de Oração",
      time: "20:00",
      mode: null,
    },
  ],
  campaign_notice: { active: true, title: "Estamos Construindo", text: "Ajude a erguer o templo." },
  lords_supper_notice: { active: false, text: "Ceia neste domingo." },
  address: {
    street: "Rua das Flores",
    number: "100",
    complement: null,
    neighborhood: "Centro",
    city: "Lagoa Santa",
    state: "MG",
    zip: "33400000",
  },
  map_links: { google_maps_url: null, waze_url: null, embed_url: null },
  whatsapp: { phone: "+5531991234567", default_text: "Olá!" },
  youtube_links: { channel_url: null, live_url: null },
  social_links: [{ network: "instagram", url: "https://www.instagram.com/pib_ls/" }],
  notification_recipients: {
    VISITANTE: ["visitas@example.com"],
    MEMBRO: ["secretaria@example.com", "pastor@example.com"],
    ORACAO: ["oracao@example.com"],
    CONTATO: ["contato@example.com"],
    MINISTERIO: ["ministerios@example.com"],
  },
};

type Settings = Record<string, unknown>;

const SECRETARIA = userFixture("SECRETARIA");

function mockSettings(
  overrides: Partial<Settings> = {},
  warnings: { code: string; lead_type: string; message: string }[] = [],
) {
  server.use(
    http.get("*/api/admin/settings", () =>
      HttpResponse.json({ data: { ...SETTINGS, ...overrides }, warnings }),
    ),
  );
}

/** Captura o corpo do PATCH e responde com as configurações já atualizadas. */
function capturePatch(warnings: unknown[] = []) {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.patch("*/api/admin/settings", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      sent.push(body);
      return HttpResponse.json({ data: { ...SETTINGS, ...body }, warnings });
    }),
  );
  return sent;
}

beforeEach(() => {
  resetQueryCache();
  window.localStorage.clear();
  useSnapshots();
  mockAdminDefaults();
  mockMe(SECRETARIA);
  server.use(http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })));
});

async function openForm() {
  const view = renderAdmin("/admin/configuracoes");
  await screen.findByRole("heading", { level: 1, name: "Configurações do site" });
  await waitFor(() =>
    expect(screen.getByLabelText("Atividade do horário 1")).toHaveValue("Culto Matinal"),
  );
  return view;
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Salvar alterações" }));

describe("/admin/configuracoes", () => {
  it("mostra cada seção com os valores salvos, sem violação de acessibilidade", async () => {
    mockSettings();
    const { container } = await openForm();

    expect(screen.getByText("2 de 20 horários")).toBeVisible();
    expect(screen.getByLabelText("Dia do horário 2")).toHaveValue("Quinta-feira");
    expect(screen.getByLabelText("Hora do horário 1")).toHaveValue("10:10");
    expect(screen.getByRole("switch", { name: "Aviso de campanha" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Aviso da Ceia" })).not.toBeChecked();
    expect(screen.getByLabelText("CEP")).toHaveValue("33400-000");
    expect(screen.getByLabelText("WhatsApp da secretaria")).toHaveValue("(31) 99123-4567");
    expect(screen.getByLabelText("Endereço do perfil")).toHaveValue(
      "https://www.instagram.com/pib_ls/",
    );
    expect(screen.getByText("secretaria@example.com")).toBeVisible();

    await expectNoA11yViolations(container);
  });

  it("sem sessão com settings.write mostra a tela de sem acesso", async () => {
    mockMe(userFixture("TESOURARIA"));
    renderAdmin("/admin/configuracoes");

    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
  });

  it("não guarda nada no navegador (nem rascunho): tem e-mails e endereço de contato", async () => {
    mockSettings();
    const user = userEvent.setup();
    await openForm();

    await user.type(screen.getByLabelText("Complemento (opcional)"), "Sala 2");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  describe("horários", () => {
    it("adiciona um horário, que nasce vazio e pede hora e atividade", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.click(screen.getByRole("button", { name: "Adicionar horário" }));
      expect(screen.getByText("3 de 20 horários")).toBeVisible();
      await save(user);

      expect(
        await screen.findByText("Informe o horário no formato HH:MM, por exemplo 10:10."),
      ).toBeVisible();
      expect(screen.getByText("Informe o nome da atividade.")).toBeVisible();
      expect(sent).toHaveLength(0);
    });

    it("manda só a seção que mudou, com o horário novo no formato HH:MM", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.click(screen.getByRole("button", { name: "Adicionar horário" }));
      await user.selectOptions(screen.getByLabelText("Dia do horário 3"), "Quarta-feira");
      fireEvent.change(screen.getByLabelText("Hora do horário 3"), { target: { value: "19:30" } });
      await user.type(screen.getByLabelText("Atividade do horário 3"), "Estudo bíblico");
      await save(user);

      expect(
        await screen.findByText("Alterações salvas. O site atualiza em seguida."),
      ).toBeVisible();
      expect(sent).toHaveLength(1);
      expect(Object.keys(sent[0] ?? {})).toEqual(["schedule"]);
      expect((sent[0]?.schedule as unknown[])[2]).toEqual({
        day: "Quarta-feira",
        time: "19:30",
        activity: "Estudo bíblico",
        recurrence: "",
        mode: "",
      });
    });

    it("remove um horário", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.click(screen.getByRole("button", { name: "Remover Culto Matinal" }));
      expect(screen.getByText("1 de 20 horários")).toBeVisible();
      await save(user);

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]?.schedule).toEqual([
        {
          day: "Quinta-feira",
          time: "20:00",
          activity: "Culto de Oração",
          recurrence: "semanal",
          mode: "",
        },
      ]);
    });

    it("trava o botão de adicionar em 20 horários", async () => {
      const twenty = Array.from({ length: 20 }, (_, index) => ({
        day: "Domingo",
        recurrence: null,
        activity: `Horário ${index + 1}`,
        time: "10:00",
        mode: null,
      }));
      mockSettings({ schedule: twenty });
      renderAdmin("/admin/configuracoes");

      expect(await screen.findByText("20 de 20 horários")).toBeVisible();
      expect(screen.getByRole("button", { name: "Adicionar horário" })).toBeDisabled();
    });
  });

  describe("avisos", () => {
    it("liga e desliga o aviso da Ceia e manda só ele", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.click(screen.getByRole("switch", { name: "Aviso da Ceia" }));
      await save(user);

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toEqual({
        lords_supper_notice: { active: true, text: "Ceia neste domingo." },
      });
    });

    it("não deixa ligar um aviso sem texto", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.clear(screen.getByLabelText("Texto do aviso", { selector: "#supper-text" }));
      await user.click(screen.getByRole("switch", { name: "Aviso da Ceia" }));
      await save(user);

      expect(await screen.findByText("Escreva o texto do aviso ou desligue-o.")).toBeVisible();
      expect(sent).toHaveLength(0);
    });
  });

  describe("salvar", () => {
    it("sem nenhuma mudança não chama a API e avisa", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await save(user);

      expect(await screen.findByText("Nada mudou desde o último salvamento.")).toBeVisible();
      expect(sent).toHaveLength(0);
    });

    it("um valor provisório numa seção que não mudou não impede de salvar as outras", async () => {
      mockSettings({
        address: { ...SETTINGS.address, zip: "TODO(TBD-11)", street: "TODO(TBD-11)" },
      });
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.click(screen.getByRole("switch", { name: "Aviso da Ceia" }));
      await save(user);

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(Object.keys(sent[0] ?? {})).toEqual(["lords_supper_notice"]);
    });

    it("valida só a seção que mudou: CEP, UF, links https e telefone", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.clear(screen.getByLabelText("CEP"));
      await user.type(screen.getByLabelText("CEP"), "123");
      await user.clear(screen.getByLabelText("UF"));
      await user.type(screen.getByLabelText("UF"), "M");
      await user.type(screen.getByLabelText("Link do Waze"), "http://waze.com/ul/x");
      await user.clear(screen.getByLabelText("WhatsApp da secretaria"));
      await user.type(screen.getByLabelText("WhatsApp da secretaria"), "123");
      await save(user);

      expect(await screen.findByText("Informe o CEP com 8 dígitos.")).toBeVisible();
      expect(screen.getByText("Informe a sigla do estado, com 2 letras.")).toBeVisible();
      expect(screen.getByText("Informe um endereço que comece com https://.")).toBeVisible();
      expect(screen.getByText("Informe um telefone válido com DDD.")).toBeVisible();
      expect(sent).toHaveLength(0);
    });

    it("manda o CEP só com dígitos, a UF em maiúsculas e o telefone como digitado", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.clear(screen.getByLabelText("CEP"));
      await user.type(screen.getByLabelText("CEP"), "33400100");
      await user.clear(screen.getByLabelText("UF"));
      await user.type(screen.getByLabelText("UF"), "sp");
      await save(user);

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]?.address).toMatchObject({ zip: "33400100", state: "SP" });
    });

    it("mostra no campo o erro 422 do servidor", async () => {
      mockSettings();
      server.use(
        http.patch("*/api/admin/settings", () =>
          HttpResponse.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Confira os campos destacados.",
                details: [
                  {
                    field: "schedule.0.activity",
                    code: "max",
                    message: "O campo não pode ter mais de 80 caracteres.",
                  },
                ],
                traceId: "t",
              },
            },
            { status: 422 },
          ),
        ),
      );
      const user = userEvent.setup();
      await openForm();

      await user.type(screen.getByLabelText("Atividade do horário 1"), " extra");
      await save(user);

      expect(await screen.findByText("O campo não pode ter mais de 80 caracteres.")).toBeVisible();
    });

    it("mostra a falha do servidor sem perder o que foi digitado", async () => {
      mockSettings();
      server.use(
        http.patch("*/api/admin/settings", () =>
          HttpResponse.json(
            { error: { code: "INTERNAL", message: "Algo deu errado.", details: [], traceId: "t" } },
            { status: 500 },
          ),
        ),
      );
      const user = userEvent.setup();
      await openForm();

      await user.type(screen.getByLabelText("Atividade do horário 1"), " extra");
      await save(user);

      expect(await screen.findByText(/Algo deu errado/)).toBeVisible();
      expect(screen.getByLabelText("Atividade do horário 1")).toHaveValue("Culto Matinal extra");
    });
  });

  describe("destinatários", () => {
    it("BR-011 mostra o banner de cada tipo sem destinatário, com o atalho", async () => {
      mockSettings(
        {
          notification_recipients: { ...SETTINGS.notification_recipients, CONTATO: [] },
        },
        [
          {
            code: "NO_RECIPIENTS",
            lead_type: "CONTATO",
            message:
              "O tipo CONTATO não tem destinatário de e-mail. Os contatos chegam só pelo painel.",
          },
        ],
      );
      renderAdmin("/admin/configuracoes");

      const banner = await screen.findByRole("alert");
      expect(within(banner).getByText("“Fale conosco” está sem destinatário.")).toBeVisible();
      expect(within(banner).getByRole("link", { name: "Resolver agora" })).toHaveAttribute(
        "href",
        "#destinatarios",
      );
      expect(screen.getByText("Sem destinatário")).toBeVisible();
    });

    it("sem tipos pendentes não há banner", async () => {
      mockSettings();
      await openForm();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("Sem destinatário")).not.toBeInTheDocument();
    });

    it("inclui um e-mail com Enter, sem enviar o formulário", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.click(screen.getByRole("button", { name: "Adicionar e-mail para Sou visitante" }));
      await user.type(
        screen.getByLabelText("Novo e-mail para Sou visitante"),
        "Nova@Example.com{Enter}",
      );

      expect(screen.getByText("nova@example.com")).toBeVisible();
      expect(sent).toHaveLength(0);
      await save(user);
      await waitFor(() => expect(sent).toHaveLength(1));
      expect((sent[0]?.notification_recipients as Record<string, string[]>).VISITANTE).toEqual([
        "visitas@example.com",
        "nova@example.com",
      ]);
    });

    it("BR-051 recusa e-mail inválido e repetido", async () => {
      mockSettings();
      const user = userEvent.setup();
      await openForm();

      await user.click(screen.getByRole("button", { name: "Adicionar e-mail para Fale conosco" }));
      const input = screen.getByLabelText("Novo e-mail para Fale conosco");
      await user.type(input, "sem-arroba{Enter}");
      expect(await screen.findByText("Informe até 10 e-mails válidos.")).toBeVisible();

      await user.clear(input);
      await user.type(input, "contato@example.com{Enter}");
      expect(await screen.findByText("Este e-mail já está na lista.")).toBeVisible();
    });

    it("BR-051 trava em 10 e-mails por tipo", async () => {
      const ten = Array.from({ length: 10 }, (_, index) => `pessoa${index}@example.com`);
      mockSettings({
        notification_recipients: { ...SETTINGS.notification_recipients, MEMBRO: ten },
      });
      renderAdmin("/admin/configuracoes");

      expect(
        await screen.findByRole("button", { name: "Adicionar e-mail para Quero ser membro" }),
      ).toBeDisabled();
    });

    it("remove um e-mail e manda a lista sem ele", async () => {
      mockSettings();
      const sent = capturePatch();
      const user = userEvent.setup();
      await openForm();

      await user.click(
        screen.getByRole("button", { name: "Remover pastor@example.com de Quero ser membro" }),
      );
      await save(user);

      await waitFor(() => expect(sent).toHaveLength(1));
      expect((sent[0]?.notification_recipients as Record<string, string[]>).MEMBRO).toEqual([
        "secretaria@example.com",
      ]);
    });

    it("depois de salvar mostra os avisos que o servidor devolveu", async () => {
      mockSettings();
      capturePatch([
        {
          code: "NO_RECIPIENTS",
          lead_type: "ORACAO",
          message:
            "O tipo ORACAO não tem destinatário de e-mail. Os contatos chegam só pelo painel.",
        },
      ]);
      const user = userEvent.setup();
      await openForm();

      await user.click(
        screen.getByRole("button", { name: "Remover oracao@example.com de Pedido de oração" }),
      );
      await save(user);

      expect(await screen.findByText("“Pedido de oração” está sem destinatário.")).toBeVisible();
    });
  });
});
