import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import {
  renderRoute,
  resetQueryCache,
  settingsFixture,
  useSnapshots,
} from "../../../../test/fixtures";
import { server } from "../../../../test/server";
import { ruleMessages } from "~/shared/rule-messages";
import { EventPage } from "../components/public/event-page";
import { publicEventMessages as text } from "../public-messages";

/*
 * Formulário de inscrição a partir do `form_schema` (T181; design: Evento e inscrição). Os 7 tipos de pergunta,
 * obrigatoriedade, limites, bloco do responsável legal, consentimento de saúde e erro por campo (BR-001, BR-023,
 * BR-024, BR-083).
 */

const rules = ruleMessages;

const FORM = [
  {
    key: "camiseta",
    label: "Tamanho da camiseta",
    type: "SELECT",
    required: true,
    options: ["P", "M", "G", "GG", "XG"],
  },
  {
    key: "origem",
    label: "Como ficou sabendo do evento?",
    type: "SELECT",
    required: false,
    options: ["No culto", "Pelo WhatsApp", "Por indicação"],
  },
  { key: "idade", label: "Idade", type: "NUMBER", required: true, min: 5, max: 90 },
  { key: "recado", label: "Recado", type: "TEXT", required: false, max: 10 },
  {
    key: "historia",
    label: "Sua história",
    type: "TEXTAREA",
    required: false,
    help_text: "Conte em poucas linhas.",
  },
  { key: "nascimento", label: "Nascimento", type: "DATE", required: false },
  {
    key: "dias",
    label: "Dias que vai",
    type: "MULTISELECT",
    required: false,
    options: ["Sexta", "Sábado", "Domingo"],
  },
  { key: "carona", label: "Preciso de carona", type: "BOOLEAN", required: false },
];

function eventFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    slug: "retiro",
    title: "Retiro de jovens",
    excerpt: "Três dias de louvor.",
    ministry: { id: 2, name: "Jovens (Salt)" },
    starts_at: "2099-12-05T11:00:00Z",
    ends_at: "2099-12-05T20:00:00Z",
    location: "Chácara Boa Vista",
    banner_small_url: null,
    banner_url: null,
    description: "<p>Um dia inteiro de comunhão.</p>",
    has_minors: false,
    form_schema: [],
    registration: { state: "INSCRICOES_ABERTAS", deadline: null, spots_total: 30, spots_left: 22 },
    ...overrides,
  };
}

/** Responde o `GET` do evento e o `POST` da inscrição, guardando os corpos recebidos. */
function mockEvent(
  event: Record<string, unknown>,
  respond: () => Response = () =>
    HttpResponse.json(
      {
        data: {
          id: 845,
          event_title: "Retiro de jovens",
          participant_name: "Ana Souza",
          starts_at: "2099-12-05T11:00:00Z",
          confirmation_email_queued: true,
        },
      },
      { status: 201 },
    ),
) {
  const bodies: Array<Record<string, unknown>> = [];
  server.use(
    http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
    http.get("*/api/public/events/retiro", () => HttpResponse.json({ data: event })),
    http.post("*/api/public/events/retiro/register", async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return respond();
    }),
  );
  return bodies;
}

function renderEvent() {
  return renderRoute(() => <EventPage slug="retiro" />, "/eventos/retiro");
}

const submit = () => screen.getByRole("button", { name: text.confirm });
const consentBox = () => screen.getByRole("checkbox", { name: /Li e concordo/ });

async function fillFixedFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome completo"), "Ana Souza");
  await user.type(screen.getByLabelText("WhatsApp"), "31999998888");
}

beforeEach(() => {
  resetQueryCache();
  useSnapshots({ settings: settingsFixture({ features: { events: true } }) });
});

describe("formulário dinâmico", () => {
  it("mostra os campos fixos e uma pergunta de cada tipo, com o rótulo sempre visível", async () => {
    mockEvent(eventFixture({ form_schema: FORM }));
    renderEvent();

    expect(await screen.findByRole("heading", { name: text.registration })).toBeVisible();
    expect(screen.getByLabelText("Nome completo")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("inputmode", "tel");
    expect(screen.getByLabelText(/^E-mail/)).toHaveAttribute("type", "email");
    // SELECT com mais de 4 opções: lista; com até 4: botões de rádio
    expect(screen.getByRole("combobox", { name: "Tamanho da camiseta" })).toBeVisible();
    const origin = screen.getByRole("group", { name: /Como ficou sabendo/ });
    expect(within(origin).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByLabelText("Idade")).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByLabelText(/Recado/).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/Sua história/).tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText(/Sua história/)).toHaveAccessibleDescription(
      "Conte em poucas linhas.",
    );
    expect(screen.getByLabelText(/Nascimento/)).toHaveAttribute("type", "date");
    expect(
      within(screen.getByRole("group", { name: /Dias que vai/ })).getAllByRole("checkbox"),
    ).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: /Preciso de carona/ })).not.toBeChecked();
    // O opcional diz que é opcional; o obrigatório não
    expect(screen.getByText(/Recado/).closest("label")).toHaveTextContent("(opcional)");
    expect(screen.getByText("Idade").closest("label")).not.toHaveTextContent("(opcional)");
  });

  it("BR-001 e BR-004 sem preencher nada, mostra os erros no lugar e foca o primeiro campo", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(eventFixture({ form_schema: FORM }));
    renderEvent();

    await user.click(await screen.findByRole("button", { name: text.confirm }));

    expect(await screen.findByText(rules.name)).toBeVisible();
    expect(screen.getByText(rules.phone)).toBeVisible();
    expect(screen.getByText(rules.consent)).toBeVisible();
    // camiseta e idade são obrigatórias
    expect(
      screen.getByRole("combobox", { name: "Tamanho da camiseta" }),
    ).toHaveAccessibleDescription(rules.required);
    expect(screen.getByLabelText("Idade")).toHaveAccessibleDescription(rules.required);
    expect(screen.getByLabelText("Nome completo")).toHaveFocus();
    expect(consentBox()).toHaveAttribute("aria-invalid", "true");
    expect(bodies).toHaveLength(0);
  });

  it("BR-024 valida cada resposta contra o tipo: número fora dos limites, texto longo, opção e e-mail", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(eventFixture({ form_schema: FORM }));
    renderEvent();
    await screen.findByLabelText("Idade");
    await fillFixedFields(user);

    await user.type(screen.getByLabelText("Idade"), "4");
    await user.type(screen.getByLabelText(/Recado/), "texto com mais de dez caracteres");
    await user.type(screen.getByLabelText(/^E-mail/), "ana.example.com");
    await user.click(consentBox());
    await user.click(submit());

    expect(await screen.findByText(text.numberBetween(5, 90))).toBeVisible();
    expect(screen.getByText(text.tooLong(10))).toBeVisible();
    expect(screen.getByText(rules.email)).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Tamanho da camiseta" }),
    ).toHaveAccessibleDescription(rules.required);

    await user.clear(screen.getByLabelText("Idade"));
    await user.type(screen.getByLabelText("Idade"), "abc");
    await user.click(submit());
    expect(await screen.findByText(text.invalidNumber)).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  it("envia só o respondido, com o telefone em E.164 e o número como número, e mostra a confirmação", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(eventFixture({ form_schema: FORM }));
    renderEvent();
    await screen.findByLabelText("Idade");

    await fillFixedFields(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Tamanho da camiseta" }), "GG");
    await user.click(screen.getByRole("radio", { name: "No culto" }));
    await user.type(screen.getByLabelText("Idade"), "34,5");
    await user.type(screen.getByLabelText(/Sua história/), "Conheci a igreja em 2020.");
    await user.type(screen.getByLabelText(/Nascimento/), "1992-03-14");
    await user.click(screen.getByRole("checkbox", { name: "Domingo" }));
    await user.click(screen.getByRole("checkbox", { name: "Sexta" }));
    await user.click(screen.getByRole("checkbox", { name: /Preciso de carona/ }));
    await user.click(consentBox());
    await user.click(submit());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      participant_name: "Ana Souza",
      phone: "+5531999998888",
      answers: {
        camiseta: "GG",
        origem: "No culto",
        idade: 34.5,
        historia: "Conheci a igreja em 2020.",
        nascimento: "1992-03-14",
        dias: ["Domingo", "Sexta"],
        carona: true,
      },
      consent: true,
      website: "",
    });

    const done = await screen.findByRole("status");
    expect(within(done).getByRole("heading", { name: text.successTitle })).toHaveFocus();
    expect(done).toHaveTextContent("Retiro de jovens");
    expect(done).toHaveTextContent("Ana Souza");
    expect(screen.queryByRole("heading", { name: text.registration })).not.toBeInTheDocument();
  });

  it("completa a confirmação com o que a pessoa digitou quando o servidor devolve só `received` (honeypot)", async () => {
    const user = userEvent.setup();
    mockEvent(eventFixture(), () =>
      HttpResponse.json({ data: { received: true } }, { status: 201 }),
    );
    renderEvent();
    await screen.findByLabelText("Nome completo");

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    const done = await screen.findByRole("status");
    expect(done).toHaveTextContent("Retiro de jovens");
    expect(done).toHaveTextContent("Ana Souza");
  });

  it("o e-mail, quando informado, vai no envio; em branco, não", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(eventFixture());
    renderEvent();
    await screen.findByLabelText("Nome completo");

    await fillFixedFields(user);
    await user.type(screen.getByLabelText(/^E-mail/), "ana@example.com");
    await user.click(consentBox());
    await user.click(submit());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ email: "ana@example.com" });
  });
});

describe("evento com menores (BR-023)", () => {
  it("mostra o bloco do responsável legal e exige os três campos", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(eventFixture({ has_minors: true }));
    renderEvent();
    await screen.findByLabelText("Nome completo");

    const block = screen.getByRole("group", { name: text.guardianLegend });
    expect(within(block).getByLabelText(text.guardianName)).toBeVisible();

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    expect(await within(block).findAllByText(rules.guardian)).toHaveLength(3);
    expect(bodies).toHaveLength(0);

    await user.type(within(block).getByLabelText(text.guardianName), "Carla Souza");
    await user.type(within(block).getByLabelText(text.guardianPhone), "31988887777");
    await user.click(within(block).getByRole("checkbox", { name: text.guardianConsent }));
    await user.click(submit());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      guardian_name: "Carla Souza",
      guardian_phone: "+5531988887777",
      guardian_consent: true,
    });
  });

  it("sem menores, o bloco não existe e nada do responsável vai no envio", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(eventFixture({ has_minors: false }));
    renderEvent();
    await screen.findByLabelText("Nome completo");

    expect(screen.queryByRole("group", { name: text.guardianLegend })).not.toBeInTheDocument();

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(Object.keys(bodies[0] ?? {})).not.toContain("guardian_name");
  });
});

describe("pergunta de saúde (BR-083, ADR-020)", () => {
  const withHealth = [
    { key: "alergias", label: "Alergias", type: "TEXT", required: false, sensitive: true },
  ];

  it("mostra o segundo consentimento, destacado, e exige marcá-lo", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(eventFixture({ form_schema: withHealth }));
    renderEvent();
    await screen.findByLabelText("Nome completo");

    const block = screen.getByRole("group", { name: text.healthLegend });
    expect(within(block).getByRole("checkbox", { name: text.healthConsent })).not.toBeChecked();

    await fillFixedFields(user);
    await user.type(screen.getByLabelText(/Alergias/), "Amendoim");
    await user.click(consentBox());
    await user.click(submit());

    expect(await within(block).findByText(rules.healthConsent)).toBeVisible();
    expect(bodies).toHaveLength(0);

    await user.click(within(block).getByRole("checkbox", { name: text.healthConsent }));
    await user.click(submit());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ health_consent: true, answers: { alergias: "Amendoim" } });
  });

  it("sem pergunta de saúde, o segundo consentimento não aparece e não vai no envio", async () => {
    const user = userEvent.setup();
    const bodies = mockEvent(
      eventFixture({
        form_schema: [{ key: "camiseta", label: "Camiseta", type: "TEXT", required: false }],
      }),
    );
    renderEvent();
    await screen.findByLabelText("Nome completo");

    expect(screen.queryByRole("group", { name: text.healthLegend })).not.toBeInTheDocument();

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(Object.keys(bodies[0] ?? {})).not.toContain("health_consent");
  });
});

describe("respostas do servidor", () => {
  it("o 422 cai no campo da pergunta e no telefone, com o foco no primeiro", async () => {
    const user = userEvent.setup();
    mockEvent(
      eventFixture({
        form_schema: [{ key: "camiseta", label: "Camiseta", type: "TEXT", required: false }],
      }),
      () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Dados inválidos.",
              details: [
                {
                  field: "phone",
                  code: "valid_phone",
                  message: "Informe um telefone válido com DDD.",
                },
                {
                  field: "answers.camiseta",
                  code: "required",
                  message: "Este campo é obrigatório.",
                },
              ],
              traceId: "t1",
            },
          },
          { status: 422 },
        ),
    );
    renderEvent();
    await screen.findByLabelText("Nome completo");

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    expect(await screen.findByLabelText("WhatsApp")).toHaveAccessibleDescription(
      "Informe um telefone válido com DDD.",
    );
    expect(screen.getByLabelText(/Camiseta/)).toHaveAccessibleDescription(
      "Este campo é obrigatório.",
    );
    expect(screen.getByLabelText("WhatsApp")).toHaveFocus();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza");
  });

  it("BR-022 inscrição repetida mostra a frase do servidor, mantém o que foi digitado e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    mockEvent(eventFixture(), () =>
      HttpResponse.json(
        {
          error: {
            code: "DUPLICATE_REGISTRATION",
            message: "Esta pessoa já está inscrita neste evento com este telefone.",
            details: [],
            traceId: "t2",
          },
        },
        { status: 409 },
      ),
    );
    renderEvent();
    await screen.findByLabelText("Nome completo");

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Esta pessoa já está inscrita neste evento com este telefone.");
    expect(within(alert).getByRole("button", { name: text.retry })).toBeEnabled();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Souza");
  });

  it("BR-021 as vagas acabaram durante o preenchimento: mostra o aviso do servidor e a página passa a mostrar 'As vagas acabaram'", async () => {
    const user = userEvent.setup();
    let full = false;
    server.use(
      http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
      http.get("*/api/public/events/retiro", () =>
        HttpResponse.json({
          data: eventFixture({
            registration: full
              ? { state: "INSCRICOES_ENCERRADAS", deadline: null, spots_total: 30, spots_left: 0 }
              : { state: "INSCRICOES_ABERTAS", deadline: null, spots_total: 30, spots_left: 1 },
          }),
        }),
      ),
      http.post("*/api/public/events/retiro/register", () => {
        full = true;
        return HttpResponse.json(
          {
            error: {
              code: "EVENT_FULL",
              message: "Vagas esgotadas para este evento.",
              details: [],
              traceId: "t3",
            },
          },
          { status: 409 },
        );
      }),
    );
    renderEvent();
    await screen.findByLabelText("Nome completo");

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    expect(await screen.findByRole("heading", { name: text.fullTitle })).toBeVisible();
    expect(screen.queryByRole("heading", { name: text.registration })).not.toBeInTheDocument();
  });

  it("o 429 mostra a mensagem de muitas tentativas", async () => {
    const user = userEvent.setup();
    mockEvent(eventFixture(), () =>
      HttpResponse.json(
        {
          error: {
            code: "TOO_MANY_REQUESTS",
            message: "Muitas tentativas. Tente novamente em alguns minutos.",
            details: [],
            traceId: "t4",
          },
        },
        { status: 429 },
      ),
    );
    renderEvent();
    await screen.findByLabelText("Nome completo");

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas");
  });

  it("o botão fica travado enquanto envia, para não duplicar a inscrição", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    mockEvent(eventFixture(), () => {
      calls += 1;
      return HttpResponse.json({ data: { received: true } }, { status: 201 });
    });
    server.use(
      http.post("*/api/public/events/retiro/register", async () => {
        calls += 1;
        await gate;
        return HttpResponse.json({ data: { received: true } }, { status: 201 });
      }),
    );
    renderEvent();
    await screen.findByLabelText("Nome completo");

    await fillFixedFields(user);
    await user.click(consentBox());
    await user.click(submit());

    const sending = await screen.findByRole("button", { name: text.sending });
    expect(sending).toBeDisabled();
    await user.click(sending);
    release();

    await screen.findByRole("heading", { name: text.successTitle });
    expect(calls).toBe(1);
  });
});

describe("acessibilidade", () => {
  it("o formulário completo não tem violações do axe", async () => {
    mockEvent(
      eventFixture({
        has_minors: true,
        form_schema: [
          ...FORM,
          { key: "alergias", label: "Alergias", type: "TEXT", required: false, sensitive: true },
        ],
      }),
    );
    const { container } = renderEvent();
    await screen.findByRole("heading", { name: text.registration });

    await expectNoA11yViolations(container);
  });
});
