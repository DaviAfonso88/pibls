import { describe, expect, it } from "vitest";
import { ruleMessages } from "~/shared/rule-messages";
import {
  contactSchema,
  memberSchema,
  prayerSchema,
  toContactPayload,
  toMemberPayload,
  toPrayerPayload,
  toVisitorPayload,
  visitorSchema,
} from "../schemas";
import { leadMessages } from "../messages";

const rules = ruleMessages;

function firstMessage(
  result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } },
  field: string,
): string | undefined {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

const visitor = {
  name: "Maria da Silva",
  phone: "(31) 99999-8888",
  neighborhood: "Centro",
  wants_visit: "sim",
  wants_cell_group: "nao",
  group_id: "",
  message: "",
  consent: true,
  website: "",
} as const;

describe("Esquemas dos formulários de contato", () => {
  it("BR-001 recusa o envio sem o consentimento marcado", () => {
    for (const schema of [visitorSchema, memberSchema, prayerSchema, contactSchema]) {
      const result = schema.safeParse({
        ...visitor,
        from_other_baptist_church: "nao",
        identify: false,
        audience: "geral",
        ministry_id: "",
        email: "a@b.co",
        message: "Uma mensagem qualquer",
        consent: false,
      });
      expect(result.success).toBe(false);
      expect(firstMessage(result, "consent")).toBe(rules.consent);
    }
  });

  it("BR-004 exige nome e telefone válidos na Ficha de Visitante", () => {
    expect(visitorSchema.safeParse(visitor).success).toBe(true);

    const bad = visitorSchema.safeParse({ ...visitor, name: "1", phone: "123" });
    expect(firstMessage(bad, "name")).toBe(rules.name);
    expect(firstMessage(bad, "phone")).toBe(rules.phone);
  });

  it("BR-004 exige bairro e as duas respostas de sim ou não", () => {
    const result = visitorSchema.safeParse({
      ...visitor,
      neighborhood: " ",
      wants_visit: undefined,
      wants_cell_group: undefined,
    });
    expect(firstMessage(result, "neighborhood")).toBe(rules.neighborhoodRequired);
    expect(firstMessage(result, "wants_visit")).toBe(rules.required);
    expect(firstMessage(result, "wants_cell_group")).toBe(rules.required);
  });

  it("limita a mensagem a 2.000 caracteres nos formulários comuns e a 4.000 no pedido de oração", () => {
    const longVisitor = visitorSchema.safeParse({ ...visitor, message: "a".repeat(2001) });
    expect(firstMessage(longVisitor, "message")).toBe(leadMessages.messageTooLong(2000));

    const okPrayer = prayerSchema.safeParse({
      message: "a".repeat(4000),
      identify: false,
      name: "",
      contact: "",
      consent: true,
      website: "",
    });
    expect(okPrayer.success).toBe(true);

    const longPrayer = prayerSchema.safeParse({
      message: "a".repeat(4001),
      identify: false,
      name: "",
      contact: "",
      consent: true,
      website: "",
    });
    expect(firstMessage(longPrayer, "message")).toBe(leadMessages.messageTooLong(4000));
  });

  it("o pedido de oração é anônimo por padrão e só valida o contato quando a pessoa se identifica", () => {
    const base = {
      message: "Orem pela minha família",
      name: "x",
      contact: "isto não é contato",
      consent: true,
      website: "",
    };

    expect(prayerSchema.safeParse({ ...base, identify: false }).success).toBe(true);

    const identified = prayerSchema.safeParse({ ...base, identify: true });
    expect(firstMessage(identified, "name")).toBe(rules.name);
    expect(firstMessage(identified, "contact")).toBe(leadMessages.phoneOrEmailInvalid);

    expect(
      prayerSchema.safeParse({
        ...base,
        identify: true,
        name: "Ana Souza",
        contact: "ana@example.com",
      }).success,
    ).toBe(true);
  });

  it("BR-005 pede telefone ou e-mail no Fale conosco", () => {
    const contact = {
      audience: "geral",
      ministry_id: "",
      name: "João Pereira",
      phone: "",
      email: "",
      message: "Gostaria de uma informação",
      consent: true,
      website: "",
    } as const;

    expect(firstMessage(contactSchema.safeParse(contact), "phone")).toBe(rules.phoneOrEmail);
    expect(contactSchema.safeParse({ ...contact, email: "joao@example.com" }).success).toBe(true);
    expect(contactSchema.safeParse({ ...contact, phone: "(31) 99999-8888" }).success).toBe(true);
  });

  it("BR-006 exige o ministério quando o contato é com um ministério", () => {
    const contact = {
      audience: "ministerio",
      ministry_id: "",
      name: "João Pereira",
      phone: "(31) 99999-8888",
      email: "",
      message: "Gostaria de uma informação",
      consent: true,
      website: "",
    } as const;

    expect(firstMessage(contactSchema.safeParse(contact), "ministry_id")).toBe(
      rules.invalidMinistry,
    );
    expect(contactSchema.safeParse({ ...contact, ministry_id: "2" }).success).toBe(true);
  });
});

describe("Corpo do envio (LeadInput)", () => {
  it("monta a Ficha de Visitante com telefone em E.164 e grupo numérico", () => {
    const parsed = visitorSchema.parse({ ...visitor, group_id: "3", message: " Oi " });
    expect(toVisitorPayload(parsed)).toEqual({
      type: "VISITANTE",
      name: "Maria da Silva",
      phone: "+5531999998888",
      neighborhood: "Centro",
      wants_visit: true,
      wants_cell_group: false,
      group_id: 3,
      message: "Oi",
      consent: true,
      website: "",
    });
  });

  it("omite o grupo e a mensagem quando vazios", () => {
    const payload = toVisitorPayload(visitorSchema.parse(visitor));
    expect(payload).toMatchObject({ group_id: undefined, message: undefined });
  });

  it("monta o 'Quero ser membro'", () => {
    const parsed = memberSchema.parse({
      name: "Pedro Alves",
      phone: "(31) 98888-7777",
      from_other_baptist_church: "sim",
      email: "",
      message: "",
      consent: true,
      website: "",
    });
    expect(toMemberPayload(parsed)).toMatchObject({
      type: "MEMBRO",
      phone: "+5531988887777",
      from_other_baptist_church: true,
      email: undefined,
    });
  });

  it("RF-D03 o pedido anônimo não leva nome nem contato, mesmo que tenham sido digitados antes", () => {
    const parsed = prayerSchema.parse({
      message: "Orem por mim",
      identify: false,
      name: "Ana Souza",
      contact: "ana@example.com",
      consent: true,
      website: "",
    });
    const payload = toPrayerPayload(parsed);
    expect(payload).toMatchObject({ type: "ORACAO", message: "Orem por mim" });
    expect(payload).not.toHaveProperty("name", "Ana Souza");
    expect(payload).toMatchObject({ name: undefined, phone: undefined, email: undefined });
  });

  it("separa WhatsApp e e-mail do campo único do pedido de oração", () => {
    const base = {
      message: "Orem por mim",
      identify: true,
      name: "Ana Souza",
      consent: true,
      website: "",
    };

    expect(
      toPrayerPayload(prayerSchema.parse({ ...base, contact: "ana@example.com" })),
    ).toMatchObject({
      name: "Ana Souza",
      email: "ana@example.com",
      phone: undefined,
    });
    expect(
      toPrayerPayload(prayerSchema.parse({ ...base, contact: "(31) 99999-8888" })),
    ).toMatchObject({
      phone: "+5531999998888",
      email: undefined,
    });
  });

  it("escolhe CONTATO ou MINISTERIO pelo destinatário", () => {
    const base = {
      ministry_id: "2",
      name: "João Pereira",
      phone: "",
      email: "joao@example.com",
      message: "Gostaria de uma informação",
      consent: true,
      website: "",
    };

    expect(toContactPayload(contactSchema.parse({ ...base, audience: "geral" }))).toMatchObject({
      type: "CONTATO",
      ministry_id: undefined,
    });
    expect(
      toContactPayload(contactSchema.parse({ ...base, audience: "ministerio" })),
    ).toMatchObject({ type: "MINISTERIO", ministry_id: 2 });
  });
});
