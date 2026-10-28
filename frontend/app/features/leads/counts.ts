import { queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { number, object, schema } from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";
import type { Inbox } from "./admin-api";

const countEnvelope = schema(object({ meta: object({ total: number }) }));

/**
 * Quantos contatos estão `NOVO` numa caixa (os cartões do Início e os selos do menu): pede uma linha só e lê o `total` do
 * `meta`. A chave fica sob `["admin", "leads"]`, então atender um contato atualiza o número.
 */
export function newLeadsCountQuery(inbox: Inbox) {
  return queryOptions({
    queryKey: ["admin", "leads", "new-count", inbox] as const,
    queryFn: async ({ signal }) =>
      countEnvelope.parse(
        await api.get<unknown>("/api/admin/leads", {
          query: { inbox, status: "NOVO", per_page: 1 },
          signal,
        }),
      ).meta.total,
    staleTime: STALE_TIME.admin,
  });
}
