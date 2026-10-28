import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { array, nullish, number, object, schema, string } from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";

const pageMeta = object({ page: number, per_page: number, total: number, last_page: number });

/** `BulletinPublic` (contracts/openapi.yaml). O PDF é servido direto pelo Apache de `/uploads/`. */
const bulletinParser = object({
  id: number,
  edition_number: number,
  reference_date: string,
  title: string,
  summary_text: nullish(string),
  pdf_url: string,
  pdf_size_bytes: number,
});

export type PublicBulletin = ReturnType<typeof bulletinParser>;

const bulletinsEnvelope = schema(object({ data: array(bulletinParser), meta: pageMeta }));

export interface BulletinFilters {
  /** Vazio = todos os anos. */
  year: number | null;
  /** Vazio = todos os meses; só vale com o ano. */
  month: number | null;
  page: number;
}

export function bulletinsQuery(filters: BulletinFilters) {
  return queryOptions({
    queryKey: ["public", "bulletins", filters] as const,
    queryFn: async ({ signal }) =>
      bulletinsEnvelope.parse(
        await api.get<unknown>("/api/public/bulletins", {
          query: {
            year: filters.year ?? undefined,
            month: filters.year !== null ? (filters.month ?? undefined) : undefined,
            page: filters.page > 1 ? filters.page : undefined,
          },
          signal,
        }),
      ),
    staleTime: STALE_TIME.list,
    placeholderData: keepPreviousData,
  });
}

/** `PalavraVivaSummary`: a lista mostra o resumo (`excerpt`), nunca o corpo. */
const postSummaryParser = object({
  id: number,
  title: string,
  slug: string,
  excerpt: string,
  author_display: nullish(string),
  youtube_video_id: nullish(string),
  published_at: string,
});

export type PostSummary = ReturnType<typeof postSummaryParser>;

const postsEnvelope = schema(object({ data: array(postSummaryParser), meta: pageMeta }));

export function postsQuery(page: number) {
  return queryOptions({
    queryKey: ["public", "palavra-viva", "list", page] as const,
    queryFn: async ({ signal }) =>
      postsEnvelope.parse(
        await api.get<unknown>("/api/public/palavra-viva", {
          query: { page: page > 1 ? page : undefined },
          signal,
        }),
      ),
    staleTime: STALE_TIME.list,
    placeholderData: keepPreviousData,
  });
}

/** `PalavraVivaDetail`: o resumo mais o corpo, que é HTML já sanitizado pelo servidor (`SanitizedHtml`, BR-046). */
const postDetailParser = object({
  id: number,
  title: string,
  slug: string,
  excerpt: string,
  author_display: nullish(string),
  youtube_video_id: nullish(string),
  published_at: string,
  body: string,
});

export type PostDetail = ReturnType<typeof postDetailParser>;

const postEnvelope = schema(object({ data: postDetailParser }));

export function postQuery(slug: string) {
  return queryOptions({
    queryKey: ["public", "palavra-viva", "post", slug] as const,
    queryFn: async ({ signal }) =>
      postEnvelope.parse(
        await api.get<unknown>(`/api/public/palavra-viva/${encodeURIComponent(slug)}`, { signal }),
      ).data,
    staleTime: STALE_TIME.list,
  });
}
