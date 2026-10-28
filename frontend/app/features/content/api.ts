import { queryOptions, useQuery } from "@tanstack/react-query";
import { array, nullish, number, object, schema, string, withDefault } from "~/shared/http/parsers";
import { readSnapshot } from "~/shared/http/snapshots";
import { STALE_TIME } from "~/shared/lib/query-client";

const nullishString = nullish(string);

/** `data/home.json` (contracts/snapshots.md): destaques da página inicial. */
const homeParser = object({
  latest_bulletin: nullish(
    object({
      id: number,
      edition_number: number,
      reference_date: string,
      title: string,
      summary_text: nullishString,
      pdf_url: string,
    }),
  ),
  latest_posts: withDefault(
    array(
      object({
        id: number,
        title: string,
        slug: string,
        excerpt: nullishString,
        published_at: string,
      }),
    ),
    [],
  ),
  // R2: sempre vazio com a flag de eventos desligada
  upcoming_events: withDefault(
    array(object({ id: number, slug: string, title: string, starts_at: string })),
    [],
  ),
});

export type HomeHighlights = ReturnType<typeof homeParser>;

export const homeQuery = queryOptions({
  queryKey: ["snapshot", "home"],
  queryFn: ({ signal }) => readSnapshot("home", { schema: schema(homeParser), signal }),
  staleTime: STALE_TIME.snapshot,
});

/**
 * Os destaques da página inicial. São um complemento: se o arquivo, a API e o snapshot de build falharem, a página
 * segue sem a seção, em vez de mostrar erro (`highlights` fica `undefined`).
 */
export function useHomeHighlights() {
  const query = useQuery(homeQuery);
  return { highlights: query.data?.data, isPending: query.isPending };
}
