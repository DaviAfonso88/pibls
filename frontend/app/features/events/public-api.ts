import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import {
  array,
  boolean,
  nullish,
  number,
  object,
  oneOf,
  schema,
  string,
} from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";
import { EVENT_STATES, formFieldParser, pageMeta } from "./api-shared";

/** De quanto em quanto tempo a página do evento pergunta de novo quantas vagas restam (só com a página visível). */
export const SPOTS_REFRESH_MS = 30_000;

/** `EventRegistrationInfo`: o estado derivado, o prazo e as vagas (`spots_left` nulo = ilimitadas). */
const registrationInfo = object({
  state: oneOf(EVENT_STATES),
  deadline: nullish(string),
  spots_total: nullish(number),
  spots_left: nullish(number),
});

/** `EventSummary` (contracts/openapi.yaml): o evento como aparece na lista. */
const summaryParser = object({
  id: number,
  slug: string,
  title: string,
  excerpt: string,
  ministry: nullish(object({ id: number, name: string })),
  starts_at: string,
  ends_at: nullish(string),
  location: string,
  banner_small_url: nullish(string),
  registration: registrationInfo,
});

export type PublicEventSummary = ReturnType<typeof summaryParser>;

/** `EventPublicDetail`: o resumo mais a descrição (HTML sanitizado pelo servidor), o banner grande e o formulário. */
const detailParser = object({
  id: number,
  slug: string,
  title: string,
  excerpt: string,
  ministry: nullish(object({ id: number, name: string })),
  starts_at: string,
  ends_at: nullish(string),
  location: string,
  banner_small_url: nullish(string),
  registration: registrationInfo,
  description: string,
  banner_url: nullish(string),
  has_minors: boolean,
  form_schema: array(formFieldParser),
});

export type PublicEvent = ReturnType<typeof detailParser>;

const eventsEnvelope = schema(object({ data: array(summaryParser), meta: pageMeta }));
const eventEnvelope = schema(object({ data: detailParser }));

/** Os eventos publicados: os próximos primeiro e, com `include_past`, os que já aconteceram em seguida. */
export function publicEventsQuery(page: number) {
  return queryOptions({
    queryKey: ["public", "events", "list", page] as const,
    queryFn: async ({ signal }) =>
      eventsEnvelope.parse(
        await api.get<unknown>("/api/public/events", {
          query: { include_past: 1, page: page > 1 ? page : undefined },
          signal,
        }),
      ),
    staleTime: STALE_TIME.list,
    placeholderData: keepPreviousData,
  });
}

/**
 * Um evento pelo endereço. As vagas mudam a cada inscrição: enquanto a página está visível a consulta se repete a cada
 * 30 s (o TanStack Query pausa o relógio com a aba em segundo plano). Evento que não existe, que é rascunho ou com a flag
 * desligada responde 404, e a página mostra "Evento não encontrado".
 */
export function publicEventQuery(slug: string) {
  return queryOptions({
    queryKey: ["public", "events", "item", slug] as const,
    queryFn: async ({ signal }) =>
      eventEnvelope.parse(
        await api.get<unknown>(`/api/public/events/${encodeURIComponent(slug)}`, { signal }),
      ).data,
    staleTime: STALE_TIME.detail,
    refetchInterval: SPOTS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

/** O corpo do envio, como a API espera (`RegistrationInput`). */
export interface RegistrationPayload {
  participant_name: string;
  phone: string;
  email?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_consent?: boolean;
  answers: Record<string, unknown>;
  consent: boolean;
  health_consent?: boolean;
  website: string;
}

/**
 * `RegistrationReceipt`. O honeypot devolve só `{received: true}`, então nada aqui é obrigatório: a tela completa o
 * resumo com o que ela já sabe.
 */
const receiptEnvelope = schema(
  object({
    data: object({
      id: nullish(number),
      event_title: nullish(string),
      participant_name: nullish(string),
      starts_at: nullish(string),
      confirmation_email_queued: nullish(boolean),
    }),
  }),
);

export type RegistrationReceipt = ReturnType<typeof receiptEnvelope.parse>["data"];

/** `POST /api/public/events/{slug}/register`: o cliente HTTP cuida do CSRF e do `X-Request-Id`. */
export async function registerForEvent(
  slug: string,
  payload: RegistrationPayload,
  signal?: AbortSignal,
): Promise<RegistrationReceipt> {
  const body = await api.post<unknown>(
    `/api/public/events/${encodeURIComponent(slug)}/register`,
    payload,
    { signal },
  );

  return receiptEnvelope.parse(body).data;
}
