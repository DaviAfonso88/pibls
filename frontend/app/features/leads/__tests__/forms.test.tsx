import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { renderRoute, resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { ruleMessages } from "~/shared/rule-messages";
import ContactForm from "../components/contact-form";
import MemberForm from "../components/member-form";
import PrayerForm from "../components/prayer-form";
import VisitorForm from "../components/visitor-form";
import { leadMessages } from "../messages";

const leads = leadMessages;
const rules = ruleMessages;

const groups = [
  { id: 3, name: "Homens (UMHBB)" },
  { id: 6, name: "Célula de CL Promissão" },
];
const ministries = [
  { id: 1, name: "Comunicação" },
  { id: 2, name: "Música" },
];

/** Registra a rota de envio e guarda os corpos recebidos. */
function captureSubmissions(
  respond: () => Response = () => HttpResponse.json({ data: { received: true } }, { status: 201 }),
) {
  const bodies: Array<Record<string, unknown>> = [];
  server.use(
    http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
    http.post("*/api/public/leads", async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return respond();
    }),
  );
  return bodies;
}

function renderForm(Form: ComponentType) {
  useSnapshots();
  return renderRoute(Form);
}

const consentBox = () => screen.getByRole("checkbox", { name: /Li e concordo/ });
const submitButton = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  resetQueryCache();
});

describe("Ficha de Visitante", () => {
  it("BR-001 não envia sem o consentimento e mostra o aviso no campo", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(() => <VisitorForm groups={groups} initialGroupId={null} />);

    await user.type(screen.getByLabelText("Nome"), "Maria da Silva");
    await user.type(screen.getByLabelText("WhatsApp"), "31999998888");
    await user.type(screen.getByLabelText("Bairro onde mora"), "Centro");
    await user.click(
      within(screen.getByRole("group", { name: leads.wantsVisit })).getByLabelText("Sim"),
    );
    await user.click(
      within(screen.getByRole("group", { name: leads.wantsCellGroup })).getByLabelText("Não"),
    );
    expect(consentBox()).not.toBeChecked();

    await user.click(submitButton(leads.send));

    expect(await screen.findByText(rules.consent)).toBeVisible();
    expect(consentBox()).toHaveAttribute("aria-invalid", "true");
    expect(bodies).toHaveLength(0);
  });

  it("BR-004 mostra os erros de nome, telefone e bairro, com o foco no primeiro campo inválido", async () => {
    const user = userEvent.setup();
    renderForm(() => <VisitorForm groups={groups} initialGroupId={null} />);

    await user.click(submitButton(leads.send));

    expect(await screen.findByText(rules.name)).toBeVisible();
    expect(screen.getByText(rules.phone)).toBeVisible();
    expect(screen.getByText(rules.neighborhoodRequired)).toBeVisible();
    expect(screen.getAllByText(rules.required)).toHaveLength(2);
    expect(screen.getByLabelText("Nome")).toHaveFocus();
    expect(screen.getByLabelText("Nome")).toHaveAccessibleDescription(rules.name);
  });

  it("envia o formulário completo, com telefone em E.164, e mostra a confirmação", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(() => <VisitorForm groups={groups} initialGroupId={null} />);

    await user.type(screen.getByLabelText("Nome"), "Maria da Silva");
    await user.type(screen.getByLabelText("WhatsApp"), "31999998888");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(31) 99999-8888");
    await user.type(screen.getByLabelText("Bairro onde mora"), "Centro");
    await user.click(
      within(screen.getByRole("group", { name: leads.wantsVisit })).getByLabelText("Sim"),
    );
    await user.click(
      within(screen.getByRole("group", { name: leads.wantsCellGroup })).getByLabelText("Não"),
    );
    await user.selectOptions(screen.getByLabelText(/Grupo de interesse/), "6");
    await user.click(consentBox());
    await user.click(submitButton(leads.send));

    const status = await screen.findByRole("status");
    expect(within(status).getByRole("heading", { name: leads.successTitle })).toHaveFocus();
    expect(bodies).toEqual([
      {
        type: "VISITANTE",
        name: "Maria da Silva",
        phone: "+5531999998888",
        neighborhood: "Centro",
        wants_visit: true,
        wants_cell_group: false,
        group_id: 6,
        consent: true,
        website: "",
      },
    ]);
  });

  it("traz o grupo da URL já escolhido", () => {
    renderForm(() => <VisitorForm groups={groups} initialGroupId={3} />);

    expect(screen.getByLabelText(/Grupo de interesse/)).toHaveValue("3");
  });

  it("BR-002 esconde o campo-armadilha de leitores de tela e do teclado", () => {
    renderForm(() => <VisitorForm groups={groups} initialGroupId={null} />);

    const trap = document.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap).not.toBeNull();
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(
      screen.queryByRole("textbox", { name: "Deixe este campo vazio" }),
    ).not.toBeInTheDocument();
  });

  it("passa na verificação de acessibilidade", async () => {
    const { container } = renderForm(() => <VisitorForm groups={groups} initialGroupId={null} />);

    await expectNoA11yViolations(container);
  });
});

describe("Erros do servidor e envio", () => {
  async function fillAndSubmitMember(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Nome"), "Pedro Alves");
    await user.type(screen.getByLabelText("WhatsApp"), "31988887777");
    await user.click(
      within(screen.getByRole("group", { name: leads.fromOtherBaptistChurch })).getByLabelText(
        "Sim",
      ),
    );
    await user.click(consentBox());
    await user.click(submitButton(leads.send));
  }

  it("coloca o 422 do servidor no campo certo", async () => {
    const user = userEvent.setup();
    captureSubmissions(() =>
      HttpResponse.json(
        {
          error: {
            code: "validation_failed",
            message: "Dados inválidos.",
            details: [{ field: "phone", code: "invalid_phone", message: rules.phone }],
            traceId: "t-1",
          },
        },
        { status: 422 },
      ),
    );
    renderForm(MemberForm);

    await fillAndSubmitMember(user);

    expect(await screen.findByText(rules.phone)).toBeVisible();
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("aria-invalid", "true");
    // erro de campo não vira o alerta geral com "Tentar novamente"
    expect(screen.queryByRole("button", { name: leads.retry })).not.toBeInTheDocument();
  });

  it("mostra o alerta com 'Tentar novamente' e 'Falar no WhatsApp' quando o servidor recusa", async () => {
    const user = userEvent.setup();
    captureSubmissions(() =>
      HttpResponse.json(
        {
          error: {
            code: "rate_limited",
            message: "Muitos envios. Tente de novo em alguns minutos.",
            details: [],
            traceId: "t-2",
          },
        },
        { status: 429 },
      ),
    );
    renderForm(MemberForm);

    await fillAndSubmitMember(user);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("Muitos envios. Tente de novo em alguns minutos."),
    ).toBeVisible();
    expect(within(alert).getByRole("button", { name: leads.retry })).toBeEnabled();
    expect(within(alert).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me/5531999990000"),
    );
    // o formulário continua com o que a pessoa digitou
    expect(screen.getByLabelText("Nome")).toHaveValue("Pedro Alves");
  });

  it("trava o botão e mostra 'Enviando…' enquanto espera a resposta", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
      http.post("*/api/public/leads", async () => {
        await gate;
        return HttpResponse.json({ data: { received: true } }, { status: 201 });
      }),
    );
    renderForm(MemberForm);

    await fillAndSubmitMember(user);

    const sending = await screen.findByRole("button", { name: leads.sending });
    expect(sending).toBeDisabled();

    release();
    expect(await screen.findByRole("status")).toBeVisible();
  });

  it("uma falha de rede também vira o alerta geral", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
      http.post("*/api/public/leads", () => HttpResponse.error()),
    );
    renderForm(MemberForm);

    await fillAndSubmitMember(user);

    expect(await screen.findByRole("alert")).toBeVisible();
  });
});

describe("Quero ser membro", () => {
  it("envia o e-mail opcional só quando preenchido e valida o formato", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(MemberForm);

    await user.type(screen.getByLabelText("Nome"), "Pedro Alves");
    await user.type(screen.getByLabelText("WhatsApp"), "31988887777");
    await user.click(
      within(screen.getByRole("group", { name: leads.fromOtherBaptistChurch })).getByLabelText(
        "Não",
      ),
    );
    await user.type(screen.getByLabelText(/E-mail/), "isso-nao-e-email");
    await user.click(consentBox());
    await user.click(submitButton(leads.send));

    expect(await screen.findByText(rules.email)).toBeVisible();
    expect(bodies).toHaveLength(0);

    await user.clear(screen.getByLabelText(/E-mail/));
    await user.type(screen.getByLabelText(/E-mail/), "pedro@example.com");
    await user.click(submitButton(leads.send));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      type: "MEMBRO",
      from_other_baptist_church: false,
      email: "pedro@example.com",
    });
  });
});

describe("Pedido de oração", () => {
  it("RF-D03 envia só o pedido e o consentimento, sem se identificar", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(PrayerForm);

    expect(screen.queryByLabelText(/WhatsApp ou e-mail/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(leads.prayerRequest), "Orem pela minha família");
    await user.click(consentBox());
    await user.click(submitButton(leads.prayerSend));

    expect(await screen.findByRole("heading", { name: leads.prayerSuccessTitle })).toBeVisible();
    expect(bodies).toEqual([
      { type: "ORACAO", message: "Orem pela minha família", consent: true, website: "" },
    ]);
  });

  it("abre nome e contato ao marcar 'Quero me identificar' e manda o e-mail como e-mail", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(PrayerForm);

    await user.type(screen.getByLabelText(leads.prayerRequest), "Orem pela minha família");
    await user.click(screen.getByRole("checkbox", { name: leads.identifyMe }));
    await user.type(screen.getByLabelText(/^Nome/), "Ana Souza");
    await user.type(screen.getByLabelText(/WhatsApp ou e-mail/), "ana@example.com");
    await user.click(consentBox());
    await user.click(submitButton(leads.prayerSend));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      type: "ORACAO",
      name: "Ana Souza",
      email: "ana@example.com",
    });
    expect(bodies[0]).not.toHaveProperty("phone");
  });

  it("recusa pedido curto e contato inválido de quem se identifica", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(PrayerForm);

    await user.type(screen.getByLabelText(leads.prayerRequest), "oi");
    await user.click(screen.getByRole("checkbox", { name: leads.identifyMe }));
    await user.type(screen.getByLabelText(/WhatsApp ou e-mail/), "nada a ver");
    await user.click(consentBox());
    await user.click(submitButton(leads.prayerSend));

    expect(await screen.findByText(rules.message)).toBeVisible();
    expect(screen.getByText(leads.phoneOrEmailInvalid)).toBeVisible();
    expect(bodies).toHaveLength(0);
  });
});

describe("Contato", () => {
  it("BR-005 pede telefone ou e-mail", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(() => <ContactForm ministries={ministries} initialMinistryId={null} />);

    await user.type(screen.getByLabelText(/^Nome/), "João Pereira");
    await user.type(screen.getByLabelText(/^Mensagem/), "Gostaria de uma informação");
    await user.click(consentBox());
    await user.click(submitButton(leads.contactSend));

    expect(await screen.findByText(rules.phoneOrEmail)).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  it("BR-006 exige o ministério quando o contato é com um ministério", async () => {
    const user = userEvent.setup();
    const bodies = captureSubmissions();
    renderForm(() => <ContactForm ministries={ministries} initialMinistryId={null} />);

    await user.click(screen.getByRole("radio", { name: leads.toMinistry }));
    await user.type(screen.getByLabelText(/^Nome/), "João Pereira");
    await user.type(screen.getByLabelText(/E-mail/), "joao@example.com");
    await user.type(screen.getByLabelText(/^Mensagem/), "Gostaria de uma informação");
    await user.click(consentBox());
    await user.click(submitButton(leads.contactSend));

    expect(await screen.findByText(rules.invalidMinistry)).toBeVisible();
    expect(bodies).toHaveLength(0);

    await user.selectOptions(screen.getByLabelText(leads.ministry), "2");
    await user.click(submitButton(leads.contactSend));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ type: "MINISTERIO", ministry_id: 2 });
  });

  it("abre já no ministério escolhido pela URL", () => {
    renderForm(() => <ContactForm ministries={ministries} initialMinistryId={1} />);

    expect(screen.getByRole("radio", { name: leads.toMinistry })).toBeChecked();
    expect(screen.getByLabelText(leads.ministry)).toHaveValue("1");
  });
});
