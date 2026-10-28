import * as z from "zod";
import { isValidPhone, toE164 } from "~/shared/format";
import { ruleMessages } from "~/shared/rule-messages";
import type { ApiFormField } from "./api-shared";
import type { RegistrationPayload } from "./public-api";
import { publicEventMessages as text } from "./public-messages";

/**
 * O esquema do formulário de inscrição (BR-001, BR-004, BR-023, BR-024, BR-083), montado a partir do `form_schema` do
 * evento: cada pergunta vira uma regra do seu tipo. Espelha o `RegisterForEvent` do servidor com as mesmas frases; o
 * servidor é a validação final e devolve as mesmas.
 */

const rules = ruleMessages;

const MAX_TEXT = 200;
const MAX_TEXTAREA = 2000;

/** O que o formulário guarda de cada pergunta: texto, lista de opções marcadas ou caixa marcada. */
export type AnswerValue = string | string[] | boolean;

export interface RegistrationValues {
  participant_name: string;
  phone: string;
  email: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_consent: boolean;
  /** `AnswerValue` por pergunta; o esquema do Zod só garante o objeto, a tela e o envio estreitam cada valor. */
  answers: Record<string, unknown>;
  health_consent: boolean;
  consent: boolean;
  website: string;
}

function isPersonName(value: string): boolean {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 120 && /\p{L}/u.test(name);
}

function isEmail(value: string): boolean {
  return value.length <= 254 && z.email().safeParse(value).success;
}

/** `"1,75"` e `"1.75"` valem; qualquer outra coisa não é número. */
export function parseNumber(value: string): number | null {
  const clean = value.trim();
  if (!/^-?\d+([.,]\d+)?$/.test(clean)) return null;
  return Number(clean.replace(",", "."));
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

function issue(ctx: z.RefinementCtx, message: string): void {
  ctx.addIssue({ code: "custom", message });
}

function textAnswer(field: ApiFormField) {
  const ceiling = field.type === "TEXTAREA" ? MAX_TEXTAREA : MAX_TEXT;
  const max = Math.min(field.max ?? ceiling, ceiling);
  const min = field.min ?? 0;

  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") {
        if (field.required) issue(ctx, rules.required);
        return;
      }
      if (value.length > max) issue(ctx, text.tooLong(max));
      else if (min > 0 && value.length < min) issue(ctx, text.tooShort(min));
    });
}

function numberAnswer(field: ApiFormField) {
  const min = field.min ?? null;
  const max = field.max ?? null;

  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") {
        if (field.required) issue(ctx, rules.required);
        return;
      }
      const number = parseNumber(value);
      if (number === null) return issue(ctx, text.invalidNumber);
      if ((min !== null && number < min) || (max !== null && number > max)) {
        if (min !== null && max !== null) issue(ctx, text.numberBetween(min, max));
        else if (min !== null) issue(ctx, text.numberFrom(min));
        else if (max !== null) issue(ctx, text.numberUpTo(max));
      }
    });
}

function answerSchema(field: ApiFormField): z.ZodType<AnswerValue> {
  const options = field.options ?? [];

  switch (field.type) {
    case "TEXT":
    case "TEXTAREA":
      return textAnswer(field);
    case "NUMBER":
      return numberAnswer(field);
    case "DATE":
      return z
        .string()
        .trim()
        .superRefine((value, ctx) => {
          if (value === "") {
            if (field.required) issue(ctx, rules.required);
          } else if (!isRealDate(value)) {
            issue(ctx, text.invalidDate);
          }
        });
    case "SELECT":
      return z.string().superRefine((value, ctx) => {
        if (value === "") {
          if (field.required) issue(ctx, rules.required);
        } else if (!options.includes(value)) {
          issue(ctx, rules.pickOption);
        }
      });
    case "MULTISELECT":
      return z.array(z.string()).superRefine((value, ctx) => {
        if (value.length === 0) {
          if (field.required) issue(ctx, rules.required);
        } else if (value.some((choice) => !options.includes(choice))) {
          issue(ctx, rules.pickOption);
        }
      });
    case "BOOLEAN":
      return z.boolean().superRefine((value, ctx) => {
        if (field.required && !value) issue(ctx, rules.required);
      });
  }
}

/** O formulário tem alguma pergunta de saúde? Então a inscrição pede o segundo consentimento (BR-083). */
export function hasHealthQuestion(fields: readonly ApiFormField[]): boolean {
  return fields.some((field) => field.sensitive === true);
}

export function buildRegistrationSchema(fields: readonly ApiFormField[], hasMinors: boolean) {
  const answers: Record<string, z.ZodType<AnswerValue>> = {};
  for (const field of fields) answers[field.key] = answerSchema(field);

  return z.object({
    participant_name: z.string().trim().refine(isPersonName, rules.name),
    phone: z.string().trim().refine(isValidPhone, rules.phone),
    email: z
      .string()
      .trim()
      .refine((value) => value === "" || isEmail(value), rules.email),
    guardian_name: hasMinors ? z.string().trim().refine(isPersonName, rules.guardian) : z.string(),
    guardian_phone: hasMinors ? z.string().trim().refine(isValidPhone, rules.guardian) : z.string(),
    guardian_consent: hasMinors
      ? z.boolean().refine((value) => value, rules.guardian)
      : z.boolean(),
    answers: z.object(answers),
    health_consent: hasHealthQuestion(fields)
      ? z.boolean().refine((value) => value, rules.healthConsent)
      : z.boolean(),
    consent: z.boolean().refine((value) => value, rules.consent),
    website: z.string(),
  });
}

/** O valor inicial de cada pergunta: vazio, nenhuma opção marcada ou caixa desmarcada. */
export function emptyAnswers(fields: readonly ApiFormField[]): Record<string, AnswerValue> {
  const answers: Record<string, AnswerValue> = {};
  for (const field of fields) {
    answers[field.key] = field.type === "MULTISELECT" ? [] : field.type === "BOOLEAN" ? false : "";
  }
  return answers;
}

/**
 * Os valores do formulário no formato da API (`RegistrationInput`): telefone em E.164, número como número, e só o que a
 * pessoa respondeu (pergunta em branco não vai). O responsável e o consentimento de saúde só vão quando o evento os pede.
 */
export function toRegistrationPayload(
  values: RegistrationValues,
  fields: readonly ApiFormField[],
  hasMinors: boolean,
): RegistrationPayload {
  const answers: Record<string, unknown> = {};

  for (const field of fields) {
    const value = values.answers[field.key];

    if (typeof value === "boolean") {
      answers[field.key] = value;
    } else if (Array.isArray(value)) {
      if (value.length > 0) answers[field.key] = value;
    } else if (typeof value === "string" && value.trim() !== "") {
      answers[field.key] = field.type === "NUMBER" ? parseNumber(value) : value.trim();
    }
  }

  const email = values.email.trim();

  return {
    participant_name: values.participant_name.trim(),
    phone: toE164(values.phone) ?? values.phone.trim(),
    ...(email === "" ? {} : { email }),
    ...(hasMinors
      ? {
          guardian_name: values.guardian_name.trim(),
          guardian_phone: toE164(values.guardian_phone) ?? values.guardian_phone.trim(),
          guardian_consent: values.guardian_consent,
        }
      : {}),
    answers,
    consent: values.consent,
    ...(hasHealthQuestion(fields) ? { health_consent: values.health_consent } : {}),
    website: values.website,
  };
}
