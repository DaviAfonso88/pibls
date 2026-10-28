import { queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { array, boolean, object, oneOf, schema, string, withDefault } from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";
import { LEAD_TYPES, type LeadTypeCode } from "./settings-messages";

/** Texto opcional: ausente ou `null` vira vazio, que é o que os campos do formulário mostram. */
const text = withDefault(string, "");

/** `AdminSettings` (contracts/openapi.yaml): todas as chaves editáveis, menos a `pix`. */
const settingsParser = object({
  schedule: withDefault(
    array(
      object({
        day: string,
        recurrence: text,
        activity: string,
        time: string,
        mode: text,
      }),
    ),
    [],
  ),
  campaign_notice: withDefault(object({ active: boolean, title: text, text }), {
    active: false,
    title: "",
    text: "",
  }),
  lords_supper_notice: withDefault(object({ active: boolean, text }), { active: false, text: "" }),
  address: withDefault(
    object({
      street: text,
      number: text,
      complement: text,
      neighborhood: text,
      city: text,
      state: text,
      zip: text,
    }),
    { street: "", number: "", complement: "", neighborhood: "", city: "", state: "", zip: "" },
  ),
  map_links: withDefault(object({ google_maps_url: text, waze_url: text, embed_url: text }), {
    google_maps_url: "",
    waze_url: "",
    embed_url: "",
  }),
  whatsapp: withDefault(object({ phone: text, default_text: text }), {
    phone: "",
    default_text: "",
  }),
  youtube_links: withDefault(object({ channel_url: text, live_url: text }), {
    channel_url: "",
    live_url: "",
  }),
  social_links: withDefault(array(object({ network: string, url: string })), []),
  notification_recipients: withDefault(
    object({
      VISITANTE: withDefault(array(string), []),
      MEMBRO: withDefault(array(string), []),
      ORACAO: withDefault(array(string), []),
      CONTATO: withDefault(array(string), []),
      MINISTERIO: withDefault(array(string), []),
    }),
    { VISITANTE: [], MEMBRO: [], ORACAO: [], CONTATO: [], MINISTERIO: [] },
  ),
});

export type AdminSettings = ReturnType<typeof settingsParser>;

/** Um tipo de contato sem nenhum destinatário (BR-011). */
const warningParser = object({
  code: string,
  lead_type: oneOf(LEAD_TYPES),
  message: string,
});

export interface SettingsWarning {
  code: string;
  lead_type: LeadTypeCode;
  message: string;
}

const envelope = schema(
  object({ data: settingsParser, warnings: withDefault(array(warningParser), []) }),
);

export interface AdminSettingsResult {
  data: AdminSettings;
  warnings: SettingsWarning[];
}

export function adminSettingsQuery() {
  return queryOptions({
    queryKey: ["admin", "settings"] as const,
    queryFn: async ({ signal }): Promise<AdminSettingsResult> =>
      envelope.parse(await api.get<unknown>("/api/admin/settings", { signal })),
    staleTime: STALE_TIME.admin,
  });
}

/** O que `PATCH /api/admin/settings` aceita: só as chaves enviadas, cada uma com o valor completo. */
export type SettingsPatch = Partial<AdminSettings>;

export async function updateSettings(patch: SettingsPatch): Promise<AdminSettingsResult> {
  return envelope.parse(await api.patch<unknown>("/api/admin/settings", patch));
}
