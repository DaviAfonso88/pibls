import * as z from "zod";
import { digitsOnly, formatCep, formatPhone, isValidCep, isValidPhone } from "~/shared/format";
import { ruleMessages } from "~/shared/rule-messages";
import type { AdminSettings, SettingsPatch } from "./settings-api";
import {
  LEAD_TYPES,
  MAX_RECIPIENTS,
  MAX_SCHEDULE_ITEMS,
  MAX_SOCIAL_LINKS,
  settingsMessages as text,
  type LeadTypeCode,
} from "./settings-messages";

/**
 * O formulário de configurações (CAP-17): uma seção por chave de `site_settings`. Os campos de texto são sempre `string`
 * (vazio = ausente); `toPatch` devolve o valor que o servidor espera. Só as seções que mudaram são validadas e enviadas:
 * uma seção ainda com valor provisório (o CEP do conteúdo inicial, por exemplo) não impede de salvar as outras.
 */
export interface SettingsFormValues {
  schedule: {
    day: string;
    time: string;
    activity: string;
    recurrence: string;
    mode: string;
  }[];
  campaign_notice: { active: boolean; title: string; text: string };
  lords_supper_notice: { active: boolean; text: string };
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
  map_links: { google_maps_url: string; waze_url: string; embed_url: string };
  whatsapp: { phone: string; default_text: string };
  youtube_links: { channel_url: string; live_url: string };
  social_links: { network: string; url: string }[];
  notification_recipients: Record<LeadTypeCode, string[]>;
}

export type SectionKey = keyof SettingsFormValues;

export const SECTION_KEYS = [
  "schedule",
  "campaign_notice",
  "lords_supper_notice",
  "address",
  "map_links",
  "whatsapp",
  "youtube_links",
  "social_links",
  "notification_recipients",
] as const satisfies readonly SectionKey[];

/** O que a API devolveu, no formato dos campos (CEP e telefone com máscara para leitura). */
export function toFormValues(data: AdminSettings): SettingsFormValues {
  return {
    schedule: data.schedule.map((item) => ({
      day: item.day,
      time: item.time,
      activity: item.activity,
      recurrence: item.recurrence,
      mode: item.mode,
    })),
    campaign_notice: { ...data.campaign_notice },
    lords_supper_notice: { ...data.lords_supper_notice },
    address: {
      ...data.address,
      zip: isValidCep(data.address.zip) ? formatCep(data.address.zip) : data.address.zip,
    },
    map_links: { ...data.map_links },
    whatsapp: {
      ...data.whatsapp,
      phone: isValidPhone(data.whatsapp.phone)
        ? formatPhone(data.whatsapp.phone)
        : data.whatsapp.phone,
    },
    youtube_links: { ...data.youtube_links },
    social_links: data.social_links.map((link) => ({ ...link })),
    notification_recipients: {
      VISITANTE: [...data.notification_recipients.VISITANTE],
      MEMBRO: [...data.notification_recipients.MEMBRO],
      ORACAO: [...data.notification_recipients.ORACAO],
      CONTATO: [...data.notification_recipients.CONTATO],
      MINISTERIO: [...data.notification_recipients.MINISTERIO],
    },
  };
}

/** As seções cujo valor atual difere do salvo. */
export function changedSections(
  current: SettingsFormValues,
  saved: SettingsFormValues,
): SectionKey[] {
  return SECTION_KEYS.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(saved[key]));
}

const httpsUrl = z
  .string()
  .trim()
  .max(1000, text.channels.urlInvalid)
  .refine((value) => {
    if (value === "") return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, text.channels.urlInvalid);

const required = (message: string, max: number, tooLong: string) =>
  z.string().trim().min(1, message).max(max, tooLong);

/** Aviso ligado precisa de texto: uma faixa vazia apareceria no site. */
function checkNotice(
  value: { active: boolean; text: string },
  context: z.RefinementCtx,
  message: string,
): void {
  if (value.active && value.text.trim() === "") {
    context.addIssue({ code: "custom", path: ["text"], message });
  }
}

const sectionSchemas = {
  schedule: z
    .array(
      z.object({
        day: z.string().min(1, text.schedule.dayRequired),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, text.schedule.timeInvalid),
        activity: required(text.schedule.activityRequired, 80, text.schedule.activityLength),
        recurrence: z.string().trim().max(60, text.schedule.recurrenceLength),
        mode: z.string().trim().max(80, text.schedule.modeLength),
      }),
    )
    .max(MAX_SCHEDULE_ITEMS, text.schedule.count(MAX_SCHEDULE_ITEMS)),
  campaign_notice: z
    .object({
      active: z.boolean(),
      title: z.string().trim().max(80, text.campaign.titleLength),
      text: z.string().trim().max(500, text.campaign.textLength),
    })
    .superRefine((value, context) => checkNotice(value, context, text.campaign.textRequired)),
  lords_supper_notice: z
    .object({
      active: z.boolean(),
      text: z.string().trim().max(300, text.supper.textLength),
    })
    .superRefine((value, context) => checkNotice(value, context, text.supper.textRequired)),
  address: z.object({
    street: required(text.address.streetRequired, 120, text.address.streetRequired),
    number: required(text.address.numberRequired, 20, text.address.numberRequired),
    complement: z.string().trim().max(80),
    neighborhood: required(
      text.address.neighborhoodRequired,
      80,
      text.address.neighborhoodRequired,
    ),
    city: required(text.address.cityRequired, 80, text.address.cityRequired),
    state: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, text.address.stateInvalid),
    zip: z.string().trim().refine(isValidCep, text.address.zipInvalid),
  }),
  map_links: z.object({ google_maps_url: httpsUrl, waze_url: httpsUrl, embed_url: httpsUrl }),
  whatsapp: z.object({
    phone: z.string().trim().refine(isValidPhone, ruleMessages.phone),
    default_text: z.string().trim().max(200, text.channels.defaultTextLength),
  }),
  youtube_links: z.object({ channel_url: httpsUrl, live_url: httpsUrl }),
  social_links: z
    .array(
      z.object({
        network: required(
          text.channels.socialNetworkRequired,
          30,
          text.channels.socialNetworkLength,
        ),
        url: httpsUrl.refine((value) => value !== "", text.channels.urlInvalid),
      }),
    )
    .max(MAX_SOCIAL_LINKS),
  notification_recipients: z.object(
    Object.fromEntries(
      LEAD_TYPES.map((type) => [
        type,
        z
          .array(z.email(ruleMessages.recipients).max(254, ruleMessages.recipients))
          .max(MAX_RECIPIENTS, ruleMessages.recipients),
      ]),
    ) as Record<LeadTypeCode, z.ZodArray<z.ZodEmail>>,
  ),
} satisfies Record<SectionKey, z.ZodType>;

export interface SectionIssue {
  /** Caminho do campo dentro do formulário, como o React Hook Form o conhece (`address.zip`, `schedule.0.time`). */
  path: string;
  message: string;
}

/** Valida só as seções pedidas e devolve cada problema no campo certo. */
export function validateSections(
  values: SettingsFormValues,
  keys: readonly SectionKey[],
): SectionIssue[] {
  const issues: SectionIssue[] = [];

  for (const key of keys) {
    const result = sectionSchemas[key].safeParse(values[key]);
    if (result.success) continue;

    for (const issue of result.error.issues) {
      issues.push({ path: [key, ...issue.path].join("."), message: issue.message });
    }
  }

  return issues;
}

const trimmed = (value: string): string => value.trim();

/**
 * O valor de uma seção como `PATCH /api/admin/settings` o espera. Campo opcional vazio vai como texto vazio: o servidor o
 * converte em `null` antes de validar e gravar.
 */
export function toPatch(values: SettingsFormValues, keys: readonly SectionKey[]): SettingsPatch {
  const patch: SettingsPatch = {};

  for (const key of keys) {
    switch (key) {
      case "schedule":
        patch.schedule = values.schedule.map((item) => ({
          day: item.day,
          time: item.time,
          activity: trimmed(item.activity),
          recurrence: trimmed(item.recurrence),
          mode: trimmed(item.mode),
        }));
        break;
      case "campaign_notice":
        patch.campaign_notice = {
          active: values.campaign_notice.active,
          title: trimmed(values.campaign_notice.title),
          text: trimmed(values.campaign_notice.text),
        };
        break;
      case "lords_supper_notice":
        patch.lords_supper_notice = {
          active: values.lords_supper_notice.active,
          text: trimmed(values.lords_supper_notice.text),
        };
        break;
      case "address":
        patch.address = {
          street: trimmed(values.address.street),
          number: trimmed(values.address.number),
          complement: trimmed(values.address.complement),
          neighborhood: trimmed(values.address.neighborhood),
          city: trimmed(values.address.city),
          state: trimmed(values.address.state).toUpperCase(),
          zip: digitsOnly(values.address.zip),
        };
        break;
      case "map_links":
        patch.map_links = {
          google_maps_url: trimmed(values.map_links.google_maps_url),
          waze_url: trimmed(values.map_links.waze_url),
          embed_url: trimmed(values.map_links.embed_url),
        };
        break;
      case "whatsapp":
        patch.whatsapp = {
          phone: trimmed(values.whatsapp.phone),
          default_text: trimmed(values.whatsapp.default_text),
        };
        break;
      case "youtube_links":
        patch.youtube_links = {
          channel_url: trimmed(values.youtube_links.channel_url),
          live_url: trimmed(values.youtube_links.live_url),
        };
        break;
      case "social_links":
        patch.social_links = values.social_links.map((link) => ({
          network: trimmed(link.network),
          url: trimmed(link.url),
        }));
        break;
      case "notification_recipients":
        patch.notification_recipients = {
          VISITANTE: [...values.notification_recipients.VISITANTE],
          MEMBRO: [...values.notification_recipients.MEMBRO],
          ORACAO: [...values.notification_recipients.ORACAO],
          CONTATO: [...values.notification_recipients.CONTATO],
          MINISTERIO: [...values.notification_recipients.MINISTERIO],
        };
        break;
    }
  }

  return patch;
}
