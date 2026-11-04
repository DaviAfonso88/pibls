import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, PlayIcon, SearchIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { formatIsoDate } from "~/shared/format";
import { messages } from "~/shared/messages";
import { buttonClassName } from "~/shared/ui/button-variants";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { publicContentMessages as text } from "../messages";
import { postPath, postsQuery, type PostSummary } from "../public-api";
import { SimplePager } from "./simple-pager";

/** O mesmo limite da API (`q`, até 120 caracteres). */
const SEARCH_MAX_LENGTH = 120;

/** `2026-10-16T13:10:00Z` → `16/10/2026`, na data de São Paulo. */
function publishedDate(iso: string): string {
  return formatIsoDate(iso.slice(0, 10));
}

function cleanSearch(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
}

function pageFromParams(params: URLSearchParams): number {
  const page = Number(params.get("pagina"));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** A busca e a página moram na URL (`?busca=…&pagina=2`), para Voltar e o compartilhamento funcionarem. */
function listHref(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search !== "") params.set("busca", search);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return `/palavra-viva${query ? `?${query}` : ""}`;
}

function PostCard({ post }: { post: PostSummary }) {
  return (
    <li className="flex">
      <Link
        to={postPath(post.slug)}
        className="group flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-5 text-foreground no-underline transition-colors hover:border-border-strong hover:bg-muted"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <time dateTime={post.published_at}>{publishedDate(post.published_at)}</time>
          {post.youtube_video_id ? (
            <span className="inline-flex items-center gap-1 font-bold text-primary">
              <PlayIcon aria-hidden="true" className="size-3.5 fill-current" />
              {text.withVideo}
            </span>
          ) : null}
        </span>
        <span className="text-lg leading-snug font-extrabold text-pretty">{post.title}</span>
        <span className="line-clamp-3 text-muted-foreground">{post.excerpt}</span>
        <span className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-1 font-bold text-primary">
          {text.readPost}
          <ChevronRightIcon
            aria-hidden="true"
            className="size-[18px] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </Link>
    </li>
  );
}

/** Campo de busca: ao enviar, grava o termo na URL e volta para a primeira página. */
function PostSearch({ search }: { search: string }) {
  const [, setParams] = useSearchParams();

  return (
    <form
      role="search"
      action="/palavra-viva"
      method="get"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const value = new FormData(submitEvent.currentTarget).get("busca");
        const term = typeof value === "string" ? cleanSearch(value) : "";
        setParams(term === "" ? {} : { busca: term });
      }}
      className="flex max-w-2xl flex-col gap-1.5"
    >
      <label htmlFor="busca-mensagens" className="text-[15px] font-bold">
        {text.searchLabel}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          {/* A chave pelo termo refaz o campo quando a URL muda (Voltar, "Limpar busca") */}
          <input
            key={search}
            id="busca-mensagens"
            name="busca"
            type="search"
            defaultValue={search}
            placeholder={text.searchPlaceholder}
            maxLength={SEARCH_MAX_LENGTH}
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full min-w-0 rounded-xl border border-input bg-background pr-3 pl-11 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <button
          type="submit"
          className={buttonClassName({ size: "lg", className: "rounded-xl font-bold" })}
        >
          {text.searchSubmit}
        </button>
      </div>
    </form>
  );
}

/**
 * A lista pública da Palavra Viva (CAP-03): busca por título, resumo ou texto, todas as mensagens em cartões do mesmo
 * tamanho, das mais recentes às mais antigas, e paginação de 10 em 10. Mensagem agendada não chega aqui (BR-042).
 */
export function PostList() {
  const [params] = useSearchParams();
  const page = pageFromParams(params);
  const search = cleanSearch(params.get("busca") ?? "");
  const query = useQuery(postsQuery(page, search));
  const hrefFor = (target: number) => listHref(search, target);

  // Sem nenhuma mensagem publicada, não há o que buscar
  const nothingPublished = search === "" && query.data?.meta.total === 0;
  const settled = query.isSuccess && !query.isPlaceholderData;
  const total = query.data?.meta.total ?? 0;

  return (
    <section aria-label={text.postsListLabel} className="container pt-6 pb-12">
      <div className="flex flex-col gap-5">
        {nothingPublished ? null : <PostSearch search={search} />}

        {search !== "" ? (
          <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1">
            <p
              role="status"
              className={settled && total > 0 ? "m-0 text-[15px] text-muted-foreground" : "sr-only"}
            >
              {settled
                ? total > 0
                  ? text.searchResults(total, search)
                  : text.noSearchResults(search)
                : ""}
            </p>
            <Link
              to="/palavra-viva"
              className="inline-flex min-h-11 items-center font-bold text-primary"
            >
              {text.clearSearch}
            </Link>
          </div>
        ) : null}

        {query.isError ? (
          <ErrorState
            message={messages.errors.generic}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : query.isPending ? (
          <LoadingBlock count={4} />
        ) : query.data.data.length === 0 ? (
          search !== "" ? (
            <EmptyState
              icon={<SearchIcon />}
              title={text.noSearchResults(search)}
              description={text.noSearchResultsHint}
              action={
                <Link
                  to="/palavra-viva"
                  className={buttonClassName({ variant: "outline", size: "lg" })}
                >
                  {text.seeAllPosts}
                </Link>
              }
            />
          ) : (
            <EmptyState title={text.noPosts} />
          )
        ) : (
          <>
            <ul
              aria-busy={query.isPlaceholderData}
              className="m-0 grid list-none gap-4 p-0 transition-opacity aria-busy:opacity-60 sm:grid-cols-2 lg:grid-cols-3"
            >
              {query.data.data.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </ul>
            <SimplePager
              page={query.data.meta.page}
              lastPage={query.data.meta.last_page}
              hrefFor={hrefFor}
            />
          </>
        )}
      </div>
    </section>
  );
}
