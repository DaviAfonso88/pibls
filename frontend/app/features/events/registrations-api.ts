import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import {
  array,
  nullish,
  number,
  object,
  oneOf,
  schema,
  string,
  type Parser,
} from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";
import { FORM_FIELD_TYPES } from "./api-shared";

/** O valor de uma resposta depende do tipo da pergunta (texto, número, lista, caixa marcada); a tela o estreita. */
const answerValue: Parser<unknown> = (value) => value;

/** Uma resposta com o rótulo da época em que a pessoa se inscreveu. */
const answerParser = object({
  key: string,
  label: string,
  type: oneOf(FORM_FIELD_TYPES),
  value: answerValue,
});

/** `EventRegistrationAdmin`: uma inscrição com os campos fixos e as respostas. Telefone em E.164. */
const registrationParser = object({
  id: number,
  created_at: string,
  participant_name: string,
  phone: string,
  email: nullish(string),
  guardian_name: nullish(string),
  guardian_phone: nullish(string),
  answers: array(answerParser),
});

export type RegistrationAnswer = ReturnType<typeof answerParser>;
export type AdminRegistration = ReturnType<typeof registrationParser>;

/** `spots_total` nulo = vagas ilimitadas; `spots_filled` conta todas as inscrições, não só as da página. */
const registrationsEnvelope = schema(
  object({
    data: array(registrationParser),
    meta: object({
      page: number,
      per_page: number,
      total: number,
      last_page: number,
      spots_total: nullish(number),
      spots_filled: number,
    }),
  }),
);

export type RegistrationsPage = ReturnType<typeof registrationsEnvelope.parse>;

/** O PDF usa a mesma lista numa página só: até 500 inscrições (SC-014). */
export const PDF_PAGE_SIZE = 500;

/** Linhas por página na tela. */
export const REGISTRATIONS_PER_PAGE = 50;

export interface RegistrationsFilters {
  page: number;
  /** Nome ou telefone; vazio = todas. */
  search: string;
}

export function registrationsPath(eventId: number): string {
  return `/api/admin/events/${eventId}/registrations`;
}

export function registrationsCsvPath(eventId: number): string {
  return `${registrationsPath(eventId)}/export.csv`;
}

export function registrationsQuery(eventId: number, filters: RegistrationsFilters) {
  return queryOptions({
    queryKey: ["admin", "events", "registrations", eventId, filters] as const,
    queryFn: async ({ signal }) =>
      registrationsEnvelope.parse(
        await api.get<unknown>(registrationsPath(eventId), {
          query: {
            per_page: REGISTRATIONS_PER_PAGE,
            page: filters.page > 1 ? filters.page : undefined,
            q: filters.search === "" ? undefined : filters.search,
          },
          signal,
        }),
      ),
    staleTime: STALE_TIME.admin,
    placeholderData: keepPreviousData,
  });
}

/** Todas as inscrições de uma vez (até 500), para o PDF. */
export async function fetchAllRegistrations(
  eventId: number,
  signal?: AbortSignal,
): Promise<RegistrationsPage> {
  return registrationsEnvelope.parse(
    await api.get<unknown>(registrationsPath(eventId), {
      query: { per_page: PDF_PAGE_SIZE },
      signal,
    }),
  );
}

/** `CANCELLED`: a pessoa desistiu (BR-034). `TITULAR_REQUEST`: exclusão a pedido do titular dos dados (BR-081). */
export type CancelReason = "CANCELLED" | "TITULAR_REQUEST";

/** Exclui a inscrição em definitivo; a vaga volta (BR-034). */
export async function cancelRegistration(
  eventId: number,
  registrationId: number,
  reason: CancelReason,
): Promise<void> {
  await api.delete<unknown>(`${registrationsPath(eventId)}/${registrationId}`, {}, { reason });
}
