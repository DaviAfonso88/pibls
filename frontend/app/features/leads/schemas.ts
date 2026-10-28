import * as z from "zod";
import { isValidPhone, toE164 } from "~/shared/format";
import { ruleMessages } from "~/shared/rule-messages";
import { leadMessages } from "./messages";

/**
 * Esquemas dos cinco formulários públicos (BR-001, BR-004, BR-005, BR-006). Espelham as regras do servidor
 * (`SubmitLeadRequest`) com as mesmas frases do `architecture.md`; o servidor é a validação final e devolve os mesmos
 * textos. Os nomes dos campos são os da API (`snake_case`), para o 422 cair no campo certo. Os textos vêm de
 * `~/shared/rule-messages`, conferidos contra `backend/lang/pt_BR/business.php`.
 */

const rules = ruleMessages;

/** `"sim"` e `"nao"`: o valor dos botões de rádio. Vazio (nada escolhido) cai na mensagem de campo obrigatório. */
const yesNo = z.enum(["sim", "nao"], { error: rules.required });

/** 2 a 120 caracteres depois de aparar, com pelo menos uma letra (PersonName). */
function isPersonName(value: string): boolean {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 120 && /\p{L}/u.test(name);
}

/** Mesma regra do servidor (EmailAddress): formato de e-mail, até 254 caracteres. */
function isEmail(value: string): boolean {
  return value.length <= 254 && z.email().safeParse(value).success;
}

const requiredName = z.string().trim().refine(isPersonName, rules.name);
const requiredPhone = z.string().trim().refine(isValidPhone, rules.phone);
const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === "" || isEmail(value), rules.email);
const optionalPhone = z
  .string()
  .trim()
  .refine((value) => value === "" || isValidPhone(value), rules.phone);

/** BR-001: a caixa nunca vem marcada, e o envio só passa com `true`. */
const consent = z.boolean().refine((value) => value, rules.consent);

function messageBetween(min: number, max: number, required: boolean) {
  return z
    .string()
    .trim()
    .max(max, leadMessages.messageTooLong(max))
    .refine(
      (value) => (required ? value.length >= min : value === "" || value.length >= min),
      rules.message,
    );
}

/** Campos que todo formulário tem: o consentimento e o honeypot `website` (BR-002). */
const common = { consent, website: z.string() };

export const visitorSchema = z.object({
  name: requiredName,
  phone: requiredPhone,
  neighborhood: z
    .string()
    .trim()
    .refine((value) => value.length >= 2 && value.length <= 80, rules.neighborhoodRequired),
  wants_visit: yesNo,
  wants_cell_group: yesNo,
  /** Id do grupo ou da célula, como texto; vazio = nenhum. */
  group_id: z.string(),
  message: messageBetween(0, 2000, false),
  ...common,
});

export const memberSchema = z.object({
  name: requiredName,
  phone: requiredPhone,
  from_other_baptist_church: yesNo,
  email: optionalEmail,
  message: messageBetween(0, 2000, false),
  ...common,
});

export const prayerSchema = z
  .object({
    message: messageBetween(5, 4000, true),
    /** "Quero me identificar": só então o nome e o contato entram no envio (RF-D03). */
    identify: z.boolean(),
    name: z.string().trim(),
    /** WhatsApp ou e-mail, num campo só (design). */
    contact: z.string().trim(),
    ...common,
  })
  .superRefine((values, context) => {
    if (!values.identify) return;
    if (values.name !== "" && !isPersonName(values.name)) {
      context.addIssue({ code: "custom", path: ["name"], message: rules.name });
    }
    if (values.contact !== "" && !isValidPhone(values.contact) && !isEmail(values.contact)) {
      context.addIssue({
        code: "custom",
        path: ["contact"],
        message: leadMessages.phoneOrEmailInvalid,
      });
    }
  });

export const contactSchema = z
  .object({
    /** `geral` = Fale conosco (CONTATO); `ministerio` = com um ministério (MINISTERIO). */
    audience: z.enum(["geral", "ministerio"]),
    ministry_id: z.string(),
    name: requiredName,
    phone: optionalPhone,
    email: optionalEmail,
    message: messageBetween(5, 2000, true),
    ...common,
  })
  .superRefine((values, context) => {
    // BR-005: telefone OU e-mail. Só acusa se os dois estão vazios (um preenchido e inválido já tem o seu erro).
    if (values.phone === "" && values.email === "") {
      context.addIssue({ code: "custom", path: ["phone"], message: rules.phoneOrEmail });
    }
    // BR-006
    if (values.audience === "ministerio" && values.ministry_id === "") {
      context.addIssue({ code: "custom", path: ["ministry_id"], message: rules.invalidMinistry });
    }
  });

export type VisitorValues = z.infer<typeof visitorSchema>;
export type MemberValues = z.infer<typeof memberSchema>;
export type PrayerValues = z.infer<typeof prayerSchema>;
export type ContactValues = z.infer<typeof contactSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Corpo do POST /api/public/leads (contracts/openapi.yaml → LeadInput)
// ---------------------------------------------------------------------------------------------------------------

interface LeadBase {
  consent: true;
  website: string;
}

export type LeadPayload =
  | (LeadBase & {
      type: "VISITANTE";
      name: string;
      phone: string;
      neighborhood: string;
      wants_visit: boolean;
      wants_cell_group: boolean;
      group_id?: number;
      message?: string;
    })
  | (LeadBase & {
      type: "MEMBRO";
      name: string;
      phone: string;
      from_other_baptist_church: boolean;
      email?: string;
      message?: string;
    })
  | (LeadBase & { type: "ORACAO"; message: string; name?: string; phone?: string; email?: string })
  | (LeadBase & {
      type: "CONTATO" | "MINISTERIO";
      name: string;
      message: string;
      phone?: string;
      email?: string;
      ministry_id?: number;
    });

/** Só inclui o campo se tiver valor: a API trata ausente e vazio da mesma forma, mas o corpo fica enxuto. */
function present<T extends string>(value: T): T | undefined {
  return value === "" ? undefined : value;
}

export function toVisitorPayload(values: VisitorValues): LeadPayload {
  return {
    type: "VISITANTE",
    name: values.name,
    phone: toE164(values.phone) ?? values.phone,
    neighborhood: values.neighborhood,
    wants_visit: values.wants_visit === "sim",
    wants_cell_group: values.wants_cell_group === "sim",
    group_id: values.group_id === "" ? undefined : Number(values.group_id),
    message: present(values.message),
    consent: true,
    website: values.website,
  };
}

export function toMemberPayload(values: MemberValues): LeadPayload {
  return {
    type: "MEMBRO",
    name: values.name,
    phone: toE164(values.phone) ?? values.phone,
    from_other_baptist_church: values.from_other_baptist_church === "sim",
    email: present(values.email),
    message: present(values.message),
    consent: true,
    website: values.website,
  };
}

export function toPrayerPayload(values: PrayerValues): LeadPayload {
  const contact = values.identify ? values.contact : "";
  const isMail = contact.includes("@");

  return {
    type: "ORACAO",
    message: values.message,
    name: values.identify ? present(values.name) : undefined,
    phone: contact !== "" && !isMail ? (toE164(contact) ?? contact) : undefined,
    email: isMail ? contact : undefined,
    consent: true,
    website: values.website,
  };
}

export function toContactPayload(values: ContactValues): LeadPayload {
  const toMinistry = values.audience === "ministerio";

  return {
    type: toMinistry ? "MINISTERIO" : "CONTATO",
    name: values.name,
    phone: values.phone === "" ? undefined : (toE164(values.phone) ?? values.phone),
    email: present(values.email),
    message: values.message,
    ministry_id: toMinistry ? Number(values.ministry_id) : undefined,
    consent: true,
    website: values.website,
  };
}
