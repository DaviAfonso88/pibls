import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { uploadForm } from "~/shared/http/upload";
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
import {
  EVENT_STATES,
  FORM_FIELD_TYPES,
  MAX_FORM_FIELDS,
  formFieldParser,
  pageMeta,
  type ApiFormField,
  type EventState,
  type FormFieldType,
} from "./api-shared";

export { EVENT_STATES, FORM_FIELD_TYPES, MAX_FORM_FIELDS };
export type { ApiFormField, EventState, FormFieldType };

const userRef = nullish(object({ id: number, name: string }));

/** `EventAdmin`: o detalhe público mais publicação, vagas, prazo, total de inscritos e quem alterou por último. */
const eventParser = object({
  id: number,
  slug: string,
  title: string,
  excerpt: string,
  ministry: nullish(object({ id: number, name: string })),
  starts_at: string,
  ends_at: nullish(string),
  location: string,
  banner_small_url: nullish(string),
  registration: object({
    state: oneOf(EVENT_STATES),
    deadline: nullish(string),
    spots_total: nullish(number),
    spots_left: nullish(number),
  }),
  description: string,
  banner_url: nullish(string),
  has_minors: boolean,
  form_schema: array(formFieldParser),
  is_published: boolean,
  max_spots: nullish(number),
  registration_deadline: nullish(string),
  registrations_count: number,
  updated_at: nullish(string),
  updated_by: userRef,
});

export type AdminEvent = ReturnType<typeof eventParser>;

const eventsEnvelope = schema(object({ data: array(eventParser), meta: pageMeta }));
/** `sanitization_warning` vem `true` só quando o servidor removeu formatação da descrição (BR-046). */
const savedEventEnvelope = schema(
  object({ data: eventParser, sanitization_warning: nullish(boolean) }),
);
const bannerEnvelope = schema(
  object({ data: object({ banner_url: string, banner_small_url: string }) }),
);

export interface AdminEventFilters {
  /** Vazio = todas as situações. */
  state: EventState | null;
  /** Vazio = todos os ministérios. */
  ministryId: number | null;
  page: number;
}

export function adminEventsQuery(filters: AdminEventFilters) {
  return queryOptions({
    queryKey: ["admin", "events", "list", filters] as const,
    queryFn: async ({ signal }) =>
      eventsEnvelope.parse(
        await api.get<unknown>("/api/admin/events", {
          query: {
            state: filters.state ?? undefined,
            ministry_id: filters.ministryId ?? undefined,
            page: filters.page > 1 ? filters.page : undefined,
          },
          signal,
        }),
      ),
    staleTime: STALE_TIME.admin,
    placeholderData: keepPreviousData,
  });
}

export function adminEventQuery(id: number) {
  return queryOptions({
    queryKey: ["admin", "events", "item", id] as const,
    queryFn: async ({ signal }) =>
      savedEventEnvelope.parse(await api.get<unknown>(`/api/admin/events/${id}`, { signal })).data,
    staleTime: STALE_TIME.admin,
  });
}

/** Uma pergunta do formulário, como o servidor a recebe (`FormField`). */
export interface FormFieldInput {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  help_text: string | null;
  sensitive: boolean;
  min: number | null;
  max: number | null;
  options: string[] | null;
}

/** Os dados do formulário do evento, como o servidor os recebe (`EventInput`). Datas em ISO 8601 com fuso. */
export interface EventInput {
  title: string;
  slug: string;
  ministry_id: number;
  /** HTML do editor; o servidor sanitiza de novo (BR-046). */
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  max_spots: number | null;
  registration_deadline: string | null;
  has_minors: boolean;
  form_schema: FormFieldInput[];
}

export interface SavedEvent {
  event: AdminEvent;
  /** O servidor removeu formatação da descrição (BR-046). */
  sanitizationWarning: boolean;
}

function toSaved(raw: unknown): SavedEvent {
  const parsed = savedEventEnvelope.parse(raw);
  return { event: parsed.data, sanitizationWarning: parsed.sanitization_warning === true };
}

export async function createEvent(input: EventInput, publish: boolean): Promise<SavedEvent> {
  return toSaved(await api.post<unknown>("/api/admin/events", { ...input, is_published: publish }));
}

/**
 * Altera o evento. O endereço (`slug`) não muda depois de criado, então não vai no PATCH. `confirmSchemaChange` confirma a
 * remoção ou a troca de tipo de pergunta com inscrições (BR-029).
 */
export async function updateEvent(
  id: number,
  input: EventInput,
  confirmSchemaChange = false,
): Promise<SavedEvent> {
  return toSaved(
    await api.patch<unknown>(`/api/admin/events/${id}`, {
      title: input.title,
      ministry_id: input.ministry_id,
      description: input.description,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      location: input.location,
      max_spots: input.max_spots,
      registration_deadline: input.registration_deadline,
      has_minors: input.has_minors,
      form_schema: input.form_schema,
      ...(confirmSchemaChange ? { confirm_schema_change: true } : {}),
    }),
  );
}

/** Publicar e despublicar são um PATCH só com `is_published`. */
export async function setEventPublished(id: number, published: boolean): Promise<SavedEvent> {
  return toSaved(await api.patch<unknown>(`/api/admin/events/${id}`, { is_published: published }));
}

/** "Encerrar inscrições" é o prazo = agora; "Reabrir" tira o prazo (`null`). */
export async function setRegistrationDeadline(
  id: number,
  deadline: string | null,
): Promise<SavedEvent> {
  return toSaved(
    await api.patch<unknown>(`/api/admin/events/${id}`, { registration_deadline: deadline }),
  );
}

export async function deleteEvent(id: number): Promise<void> {
  await api.delete<unknown>(`/api/admin/events/${id}`);
}

export async function uploadEventBanner(
  id: number,
  banner: File,
): Promise<{ banner_url: string; banner_small_url: string }> {
  const form = new FormData();
  form.set("banner", banner);

  return bannerEnvelope.parse(await uploadForm<unknown>(`/api/admin/events/${id}/banner`, form))
    .data;
}

export async function removeEventBanner(id: number): Promise<void> {
  await api.delete<unknown>(`/api/admin/events/${id}/banner`);
}
