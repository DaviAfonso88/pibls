import { queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { array, nullish, number, object, schema, string } from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";

/** `TodayRegistration`: uma linha de "Inscrições de hoje", com o nome já abreviado pelo servidor ("Pedro H."). */
const todayParser = object({
  id: number,
  created_at: string,
  name: string,
  event: object({ id: number, title: string }),
});

export type TodayRegistration = ReturnType<typeof todayParser>;

const todayEnvelope = schema(object({ data: array(todayParser), meta: object({ total: number }) }));

/** `GET /api/admin/registrations/today`: até 10 inscrições de hoje (dia de Brasília) e o total do dia. */
export function todayRegistrationsQuery() {
  return queryOptions({
    queryKey: ["admin", "events", "registrations-today"] as const,
    queryFn: async ({ signal }) =>
      todayEnvelope.parse(await api.get<unknown>("/api/admin/registrations/today", { signal })),
    staleTime: STALE_TIME.admin,
  });
}

const nextEventEnvelope = schema(
  object({
    data: array(
      object({
        id: number,
        title: string,
        registration: object({ spots_total: nullish(number), spots_left: nullish(number) }),
      }),
    ),
  }),
);

/**
 * O próximo evento com inscrições abertas (o de início mais próximo) e suas vagas: `GET /api/admin/events` filtrado por
 * `INSCRICOES_ABERTAS`, do início mais próximo para o mais distante. `null` = nenhum.
 */
export function nextOpenEventQuery() {
  return queryOptions({
    queryKey: ["admin", "events", "next-open"] as const,
    queryFn: async ({ signal }) =>
      nextEventEnvelope.parse(
        await api.get<unknown>("/api/admin/events", {
          query: { state: "INSCRICOES_ABERTAS", sort: "starts_at", per_page: 1 },
          signal,
        }),
      ).data[0] ?? null,
    staleTime: STALE_TIME.admin,
  });
}
