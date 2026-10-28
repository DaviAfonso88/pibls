import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  array,
  boolean,
  nullish,
  object,
  schema,
  string,
  withDefault,
} from "~/shared/http/parsers";
import { readSnapshot } from "~/shared/http/snapshots";
import { STALE_TIME } from "~/shared/lib/query-client";

const nullishString = nullish(string);

const scheduleItem = object({
  day: string,
  recurrence: nullishString,
  activity: string,
  time: string,
  mode: nullishString,
});

/**
 * O que o site inteiro precisa das configurações públicas (`GET /api/public/settings` = `data/settings.json`): o
 * cabeçalho esconde "Eventos" pela flag, o rodapé mostra endereço, horários e contatos, e as páginas leem o resto.
 * Campos opcionais: o painel deixa a igreja apagar um deles sem quebrar o site. Validado com `parsers.ts` (mais leve que o
 * Zod no JS inicial; orçamento de 160 KB, T052).
 */
const publicSettingsParser = object({
  schedule: withDefault(array(scheduleItem), []),
  campaign_notice: nullish(
    object({ active: withDefault(boolean, false), title: nullishString, text: nullishString }),
  ),
  lords_supper_notice: nullish(
    object({ active: withDefault(boolean, false), text: nullishString }),
  ),
  address: nullish(
    object({
      street: nullishString,
      number: nullishString,
      complement: nullishString,
      neighborhood: nullishString,
      city: nullishString,
      state: nullishString,
      zip: nullishString,
    }),
  ),
  map_links: nullish(
    object({ google_maps_url: nullishString, waze_url: nullishString, embed_url: nullishString }),
  ),
  whatsapp: nullish(object({ phone: string, default_text: nullishString })),
  youtube_links: nullish(object({ channel_url: nullishString, live_url: nullishString })),
  social_links: withDefault(array(object({ network: string, url: string })), []),
  pix: nullish(
    object({
      pix_key: nullishString,
      beneficiary_name: nullishString,
      qr_image_url: nullishString,
      copy_paste_code: nullishString,
    }),
  ),
  features: withDefault(object({ events: withDefault(boolean, false) }), { events: false }),
});

export type PublicSettings = ReturnType<typeof publicSettingsParser>;

export const publicSettingsSchema = schema(publicSettingsParser);

export const publicSettingsQuery = queryOptions({
  queryKey: ["snapshot", "settings"],
  queryFn: ({ signal }) => readSnapshot("settings", { schema: publicSettingsSchema, signal }),
  staleTime: STALE_TIME.snapshot,
});

/**
 * As configurações públicas, se vieram do snapshot do build (`stale`) e o estado da leitura. Antes de chegarem,
 * `settings` é `undefined`; se todas as fontes falharem, `isError` fica verdadeiro e `refetch` tenta de novo.
 */
export function usePublicSettings() {
  const query = useQuery(publicSettingsQuery);
  return {
    settings: query.data?.data,
    stale: query.data?.stale ?? false,
    isPending: query.isPending,
    isError: query.isError && query.data === undefined,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
