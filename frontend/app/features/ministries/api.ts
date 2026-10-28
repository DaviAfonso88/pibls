import { queryOptions, useQuery } from "@tanstack/react-query";
import { array, nullish, number, object, oneOf, schema, string } from "~/shared/http/parsers";
import { readSnapshot } from "~/shared/http/snapshots";
import { STALE_TIME } from "~/shared/lib/query-client";

const nullishString = nullish(string);

/** `MinistryPublic` (contracts/openapi.yaml): nunca traz `private_address` nem `contact_email` (BR-048). */
const ministryParser = object({
  id: number,
  category: oneOf(["MINISTERIO", "GRUPO", "CELULA"]),
  name: string,
  /** HTML já sanitizado pelo servidor (BR-046). */
  description: nullishString,
  leaders_text: nullishString,
  schedule_text: nullishString,
  neighborhood: nullishString,
  contact_phone: nullishString,
});

export type Ministry = ReturnType<typeof ministryParser>;
export type MinistryCategory = Ministry["category"];

/** `data/ministries.json`: todos os itens ativos, na ordem de exibição; a SPA filtra por categoria e bairro. */
export const ministriesQuery = queryOptions({
  queryKey: ["snapshot", "ministries"],
  queryFn: ({ signal }) =>
    readSnapshot("ministries", { schema: schema(array(ministryParser)), signal }),
  staleTime: STALE_TIME.snapshot,
});

export function useMinistries() {
  const query = useQuery(ministriesQuery);
  return {
    items: query.data?.data,
    stale: query.data?.stale ?? false,
    isPending: query.isPending,
    isError: query.isError && query.data === undefined,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
