import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, PlayIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { formatIsoDate } from "~/shared/format";
import { messages } from "~/shared/messages";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { isYoutubeVideoId } from "~/shared/ui/youtube-facade";
import { publicContentMessages as text } from "../messages";
import { postsQuery, type PostSummary } from "../public-api";
import { SimplePager } from "./simple-pager";

/** `2026-10-16T13:10:00Z` → `16/10/2026`, na data de São Paulo. */
function publishedDate(iso: string): string {
  return formatIsoDate(iso.slice(0, 10));
}

export function postPath(slug: string): string {
  return `/palavra-viva/${slug}`;
}

function pageFromParams(params: URLSearchParams): number {
  const page = Number(params.get("pagina"));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** A mensagem mais recente, em destaque: miniatura do vídeo (se houver), título, trecho e "Ler mensagem". */
function FeaturedPost({ post }: { post: PostSummary }) {
  const thumbnail = isYoutubeVideoId(post.youtube_video_id)
    ? `https://i.ytimg.com/vi/${post.youtube_video_id}/hqdefault.jpg`
    : null;

  return (
    <section aria-labelledby="mais-recente" className="container pt-6 pb-2">
      <Link
        to={postPath(post.slug)}
        className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-border p-4 text-foreground no-underline hover:bg-muted"
      >
        {thumbnail ? (
          <span className="relative flex aspect-video flex-[1_1_20rem] items-center justify-center overflow-hidden rounded-xl bg-muted">
            <img
              src={thumbnail}
              alt=""
              width={480}
              height={360}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
            <span className="relative flex size-14 items-center justify-center rounded-full bg-foreground text-background">
              <PlayIcon aria-hidden="true" className="size-6 fill-current" />
            </span>
            <span className="sr-only">{text.videoThumbnail}</span>
          </span>
        ) : null}
        <span className="flex flex-[1_1_20rem] flex-col gap-2 p-1">
          <span id="mais-recente" className="text-sm font-bold text-primary">
            {text.latestPost(publishedDate(post.published_at))}
          </span>
          <span className="text-[22px] leading-tight font-extrabold">{post.title}</span>
          <span className="text-muted-foreground">{post.excerpt}</span>
          <span className="inline-flex min-h-11 items-center gap-1.5 font-bold text-primary">
            {text.readPost}
            <ChevronRightIcon aria-hidden="true" className="size-[18px]" />
          </span>
        </span>
      </Link>
    </section>
  );
}

function PostCard({ post }: { post: PostSummary }) {
  return (
    <li className="flex-[1_1_20rem]">
      <Link
        to={postPath(post.slug)}
        className="flex h-full flex-col gap-1 rounded-2xl border border-border px-5 py-4 text-foreground no-underline hover:bg-muted"
      >
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{publishedDate(post.published_at)}</span>
          {post.youtube_video_id ? (
            <span className="inline-flex items-center gap-1 font-bold text-primary">
              <PlayIcon aria-hidden="true" className="size-3.5 fill-current" />
              {text.withVideo}
            </span>
          ) : null}
        </span>
        <span className="text-lg leading-snug font-extrabold">{post.title}</span>
        <span className="text-muted-foreground">{post.excerpt}</span>
      </Link>
    </li>
  );
}

/**
 * A lista pública da Palavra Viva (design: PalavraViva; CAP-03): a mais recente em destaque (só na primeira página), as
 * anteriores em cartões e paginação de 10 em 10. Mensagem agendada não chega aqui (BR-042).
 */
export function PostList() {
  const [params] = useSearchParams();
  const page = pageFromParams(params);
  const query = useQuery(postsQuery(page));
  const hrefFor = (target: number) => `/palavra-viva${target > 1 ? `?pagina=${target}` : ""}`;

  if (query.isError) {
    return (
      <section className="container py-8">
        <ErrorState
          message={messages.errors.generic}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </section>
    );
  }

  if (query.isPending) {
    return (
      <section className="container py-8">
        <LoadingBlock count={4} />
      </section>
    );
  }

  const posts = query.data.data;
  if (posts.length === 0) {
    return (
      <section className="container py-8">
        <EmptyState title={text.noPosts} />
      </section>
    );
  }

  const latest = page === 1 ? posts[0] : undefined;
  const older = page === 1 ? posts.slice(1) : posts;

  return (
    <>
      {latest ? <FeaturedPost post={latest} /> : null}
      <section aria-labelledby="anteriores" className="container pt-8 pb-12">
        <div className="flex flex-col gap-4">
          <h2 id="anteriores" className="m-0 text-[22px] leading-tight font-extrabold">
            {text.previousPosts}
          </h2>
          {older.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
              {older.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </ul>
          ) : null}
          <SimplePager
            page={query.data.meta.page}
            lastPage={query.data.meta.last_page}
            hrefFor={hrefFor}
          />
        </div>
      </section>
    </>
  );
}
