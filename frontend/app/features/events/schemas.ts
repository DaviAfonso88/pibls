import * as z from "zod";
import { SLUG_PATTERN } from "~/shared/lib/slug";
import { eventAdminMessages } from "./admin-messages";
import { FORM_FIELD_TYPES, MAX_FORM_FIELDS } from "./admin-api";
import { hasOptions, parseOptions } from "./event-model";

const { form: text, builder: builderText } = eventAdminMessages;

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Uma pergunta do formulário como a tela a edita (ver `FieldDraft`). O servidor repete estas regras (BR-031). */
export const fieldDraftSchema = z
  .object({
    uid: z.string(),
    key: z.string(),
    label: z
      .string()
      .trim()
      .min(1, builderText.questionRequired)
      .max(150, builderText.questionLength),
    type: z.enum(FORM_FIELD_TYPES),
    required: z.boolean(),
    help_text: z.string().trim().max(300, builderText.helpLength),
    sensitive: z.boolean(),
    min: z.string(),
    max: z.string(),
    options: z.string(),
  })
  .superRefine((field, context) => {
    if (hasOptions(field.type)) {
      const options = parseOptions(field.options);
      const distinct = new Set(options.map((option) => option.toLowerCase()));

      if (options.length < 2 || options.length > 30 || distinct.size !== options.length) {
        context.addIssue({
          code: "custom",
          path: ["options"],
          message: builderText.optionsInvalid,
        });
      }
    }

    if (field.type === "NUMBER") {
      const limits = (["min", "max"] as const).map((name) => {
        const raw = field[name].trim().replace(",", ".");
        if (raw === "") return null;
        const value = Number(raw);

        if (!Number.isFinite(value)) {
          context.addIssue({ code: "custom", path: [name], message: builderText.numberInvalid });
          return null;
        }
        return value;
      });

      const [min, max] = limits;
      if (min !== null && min !== undefined && max !== null && max !== undefined && min > max) {
        context.addIssue({ code: "custom", path: ["min"], message: builderText.limitsInvalid });
      }
    }
  });

/**
 * O formulário do evento (CAP-12). As datas são o valor de `<input type="datetime-local">` (hora de Brasília). As regras
 * de vagas contra os inscritos (BR-027) e de endereço único (BR-032) são do servidor; a tela mostra o que ele devolver.
 */
export const eventSchema = z
  .object({
    title: z.string().trim().min(3, text.titleLength).max(150, text.titleLength),
    slug: z
      .string()
      .min(1, text.slugRequired)
      .max(160, text.slugInvalid)
      .regex(SLUG_PATTERN, text.slugInvalid),
    ministry_id: z.string().min(1, text.ministryRequired),
    description: z.string().max(20_000, text.descriptionLength),
    starts_at: z.string().regex(LOCAL_DATE_TIME, text.startsRequired),
    ends_at: z.string(),
    location: z.string().trim().min(1, text.locationRequired).max(200, text.locationLength),
    max_spots: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" ||
          (/^\d{1,6}$/.test(value) && Number(value) >= 1 && Number(value) <= 100_000),
        text.spotsInvalid,
      ),
    registration_deadline: z.string(),
    has_minors: z.boolean(),
    form_schema: z.array(fieldDraftSchema).max(MAX_FORM_FIELDS, builderText.limit(MAX_FORM_FIELDS)),
  })
  .superRefine((values, context) => {
    const startsAt = LOCAL_DATE_TIME.test(values.starts_at) ? values.starts_at : null;

    // As datas locais (AAAA-MM-DDTHH:mm, mesmo fuso) comparam bem como texto
    if (startsAt !== null && values.ends_at !== "" && values.ends_at < startsAt) {
      context.addIssue({ code: "custom", path: ["ends_at"], message: text.endBeforeStart });
    }

    if (
      startsAt !== null &&
      values.registration_deadline !== "" &&
      values.registration_deadline > startsAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["registration_deadline"],
        message: text.deadlineAfterStart,
      });
    }
  });

export type EventValues = z.infer<typeof eventSchema>;
