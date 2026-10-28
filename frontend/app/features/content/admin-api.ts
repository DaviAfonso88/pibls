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

export const PUBLICATION_STATUSES = ["AGENDADO", "PUBLICADO"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

const pageMeta = object({ page: number, per_page: number, total: number, last_page: number });
const userRef = nullish(object({ id: number, name: string }));

// ───────────────────────────── Boletins ─────────────────────────────

/** `BulletinAdmin`: o boletim público mais quando sai, o estado e quem alterou por último. */
const bulletinParser = object({
  id: number,
  edition_number: number,
  reference_date: string,
  title: string,
  summary_text: nullish(string),
  pdf_url: string,
  pdf_size_bytes: number,
  published_at: string,
  status: oneOf(PUBLICATION_STATUSES),
  updated_at: nullish(string),
  updated_by: userRef,
});

export type AdminBulletin = ReturnType<typeof bulletinParser>;

const bulletinsEnvelope = schema(object({ data: array(bulletinParser), meta: pageMeta }));
const bulletinEnvelope = schema(object({ data: bulletinParser }));

export interface AdminBulletinFilters {
  /** Vazio = todos os anos. */
  year: number | null;
  page: number;
}

export function adminBulletinsQuery(filters: AdminBulletinFilters) {
  return queryOptions({
    queryKey: ["admin", "bulletins", "list", filters] as const,
    queryFn: async ({ signal }) =>
      bulletinsEnvelope.parse(
        await api.get<unknown>("/api/admin/bulletins", {
          query: {
            year: filters.year ?? undefined,
            page: filters.page > 1 ? filters.page : undefined,
          },
          signal,
        }),
      ),
    staleTime: STALE_TIME.admin,
    placeholderData: keepPreviousData,
  });
}

export function adminBulletinQuery(id: number) {
  return queryOptions({
    queryKey: ["admin", "bulletins", "item", id] as const,
    queryFn: async ({ signal }) =>
      bulletinEnvelope.parse(await api.get<unknown>(`/api/admin/bulletins/${id}`, { signal })).data,
    staleTime: STALE_TIME.admin,
  });
}

/** Os dados do formulário de boletim, como o servidor os recebe. */
export interface BulletinInput {
  edition_number: number;
  reference_date: string;
  title: string;
  summary_text: string;
  /** ISO 8601 com fuso; `null` = publicar agora. */
  published_at: string | null;
}

export interface UploadProgress {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export async function createBulletin(
  input: BulletinInput,
  pdf: File,
  upload: UploadProgress = {},
): Promise<AdminBulletin> {
  const form = new FormData();
  form.set("edition_number", String(input.edition_number));
  form.set("reference_date", input.reference_date);
  form.set("title", input.title);
  if (input.summary_text.trim() !== "") form.set("summary_text", input.summary_text);
  if (input.published_at !== null) form.set("published_at", input.published_at);
  form.set("pdf", pdf);

  return bulletinEnvelope.parse(await uploadForm<unknown>("/api/admin/bulletins", form, upload))
    .data;
}

export async function updateBulletin(id: number, input: BulletinInput): Promise<AdminBulletin> {
  return bulletinEnvelope.parse(
    await api.patch<unknown>(`/api/admin/bulletins/${id}`, {
      edition_number: input.edition_number,
      reference_date: input.reference_date,
      title: input.title,
      summary_text: input.summary_text.trim() === "" ? null : input.summary_text,
      ...(input.published_at !== null ? { published_at: input.published_at } : {}),
    }),
  ).data;
}

export async function replaceBulletinPdf(
  id: number,
  pdf: File,
  upload: UploadProgress = {},
): Promise<AdminBulletin> {
  const form = new FormData();
  form.set("pdf", pdf);

  return bulletinEnvelope.parse(
    await uploadForm<unknown>(`/api/admin/bulletins/${id}/pdf`, form, upload),
  ).data;
}

export async function deleteBulletin(id: number): Promise<void> {
  await api.delete<unknown>(`/api/admin/bulletins/${id}`);
}

// ───────────────────────────── Palavra Viva ─────────────────────────────

/** `PalavraVivaAdmin`: o detalhe mais o link original do YouTube, o estado e quem alterou por último. */
const postParser = object({
  id: number,
  title: string,
  slug: string,
  excerpt: string,
  author_display: nullish(string),
  youtube_video_id: nullish(string),
  published_at: string,
  body: string,
  youtube_url: nullish(string),
  status: oneOf(PUBLICATION_STATUSES),
  updated_at: nullish(string),
  updated_by: userRef,
});

export type AdminPost = ReturnType<typeof postParser>;

const postsEnvelope = schema(object({ data: array(postParser), meta: pageMeta }));
/** `sanitization_warning` vem `true` só quando o servidor removeu formatação do corpo (BR-046). */
const savedPostEnvelope = schema(
  object({ data: postParser, sanitization_warning: nullish(boolean) }),
);

export function adminPostsQuery(page: number) {
  return queryOptions({
    queryKey: ["admin", "palavra-viva", "list", page] as const,
    queryFn: async ({ signal }) =>
      postsEnvelope.parse(
        await api.get<unknown>("/api/admin/palavra-viva", {
          query: { page: page > 1 ? page : undefined },
          signal,
        }),
      ),
    staleTime: STALE_TIME.admin,
    placeholderData: keepPreviousData,
  });
}

export function adminPostQuery(id: number) {
  return queryOptions({
    queryKey: ["admin", "palavra-viva", "item", id] as const,
    queryFn: async ({ signal }) =>
      savedPostEnvelope.parse(await api.get<unknown>(`/api/admin/palavra-viva/${id}`, { signal }))
        .data,
    staleTime: STALE_TIME.admin,
  });
}

export interface PostInput {
  title: string;
  slug: string;
  /** HTML do editor; o servidor sanitiza de novo (BR-046). */
  body: string;
  author_display: string;
  youtube_url: string;
  /** ISO 8601 com fuso; `null` = publicar agora. */
  published_at: string | null;
}

export interface SavedPost {
  post: AdminPost;
  /** O servidor removeu formatação do corpo (BR-046). */
  sanitizationWarning: boolean;
}

function postBody(input: PostInput) {
  return {
    title: input.title,
    slug: input.slug,
    body: input.body,
    author_display: input.author_display.trim() === "" ? null : input.author_display.trim(),
    youtube_url: input.youtube_url.trim() === "" ? null : input.youtube_url.trim(),
    ...(input.published_at !== null ? { published_at: input.published_at } : {}),
  };
}

function toSaved(raw: unknown): SavedPost {
  const parsed = savedPostEnvelope.parse(raw);
  return { post: parsed.data, sanitizationWarning: parsed.sanitization_warning === true };
}

export async function createPost(input: PostInput): Promise<SavedPost> {
  return toSaved(await api.post<unknown>("/api/admin/palavra-viva", postBody(input)));
}

export async function updatePost(id: number, input: PostInput): Promise<SavedPost> {
  return toSaved(await api.patch<unknown>(`/api/admin/palavra-viva/${id}`, postBody(input)));
}

export async function deletePost(id: number): Promise<void> {
  await api.delete<unknown>(`/api/admin/palavra-viva/${id}`);
}
