import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, MessageCircleIcon } from "lucide-react";
import { Link } from "react-router";
import { formatDateLong, formatIsoDate } from "~/shared/format";
import { institution } from "~/content/institution";
import { messages } from "~/shared/messages";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { SanitizedHtml } from "~/shared/ui/sanitized-html";
import { YouTubeFacade } from "~/shared/ui/youtube-facade";
import { isApiError } from "~/shared/http/errors";
import { absoluteUrl } from "~/shared/seo/meta";
import { publicContentMessages as text } from "../messages";
import { postQuery, postsQuery, type PostDetail } from "../public-api";
import { postPath } from "./post-list";

/** Compartilhar pelo WhatsApp: abre o WhatsApp com o título e o endereço da mensagem. */
function whatsappShareUrl(post: PostDetail): string {
  return `https://wa.me/?text=${encodeURIComponent(text.shareText(post.title, absoluteUrl(postPath(post.slug))))}`;
}

/** As outras mensagens, para a pessoa continuar lendo: duas, sem repetir a que está aberta. */
function MorePosts({ currentSlug }: { currentSlug: string }) {
  const query = useQuery(postsQuery(1));
  const others = (query.data?.data ?? []).filter((post) => post.slug !== currentSlug).slice(0, 2);

  if (others.length === 0) return null;

  return (
    <section aria-labelledby="mais" className="border-t border-border bg-muted px-4 pt-8 pb-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <h2 id="mais" className="m-0 text-xl leading-tight font-extrabold">
          {text.morePosts}
        </h2>
        {others.map((post) => (
          <Link
            key={post.id}
            to={postPath(post.slug)}
            className="flex flex-col gap-1 rounded-2xl border border-border bg-background px-5 py-4 text-foreground no-underline hover:bg-accent"
          >
            <span className="text-sm text-muted-foreground">
              {formatIsoDate(post.published_at.slice(0, 10))}
            </span>
            <span className="text-lg leading-snug font-extrabold">{post.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Uma mensagem da Palavra Viva (design: Mensagem; CAP-03): título, autor, vídeo sob toque (`YouTubeFacade`), o texto
 * (HTML já sanitizado pelo servidor, `prose`) e o atalho para compartilhar no WhatsApp. Mensagem agendada, excluída ou
 * inexistente responde 404 e a tela mostra "não encontrada" (BR-042). O `<title>` e a meta para o WhatsApp vêm do PHP.
 */
export function PostArticle({ slug }: { slug: string }) {
  const query = useQuery(postQuery(slug));

  if (query.isPending) {
    return (
      <div className="container py-8">
        <LoadingBlock count={3} className="mx-auto max-w-3xl" />
      </div>
    );
  }

  if (query.isError) {
    const notFound = isApiError(query.error) && query.error.status === 404;

    return (
      <div className="container flex flex-col gap-4 py-10">
        {notFound ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <title>{`${text.postNotFoundTitle} — ${institution.shortName}`}</title>
            <meta name="robots" content="noindex" />
            <h1 className="m-0">{text.postNotFoundTitle}</h1>
            <p className="m-0 text-muted-foreground">{text.postNotFoundText}</p>
            <Link
              to="/palavra-viva"
              className={buttonClassName({ size: "lg", className: "self-start px-5 font-bold" })}
            >
              {text.backToPosts}
            </Link>
          </div>
        ) : (
          <ErrorState
            message={messages.errors.generic}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        )}
      </div>
    );
  }

  const post = query.data;

  return (
    <>
      <article className="px-4 pt-4 pb-10">
        <title>{`${post.title} — ${institution.shortName}`}</title>
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <Link
            to="/palavra-viva"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-bold"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-[18px]" />
            {text.backToPosts}
          </Link>

          <header className="flex flex-col gap-2">
            <p className="m-0 text-sm font-bold text-primary">
              {text.postEyebrow(formatDateLong(post.published_at))}
            </p>
            <h1 className="m-0 text-[30px] leading-tight tracking-tight">{post.title}</h1>
            {post.author_display ? (
              <p className="m-0 text-muted-foreground">{text.byAuthor(post.author_display)}</p>
            ) : null}
          </header>

          {post.youtube_video_id ? (
            <figure className="m-0 flex flex-col gap-2">
              <YouTubeFacade videoId={post.youtube_video_id} title={post.title} />
              <figcaption className="text-sm text-muted-foreground">{text.videoCaption}</figcaption>
            </figure>
          ) : null}

          <SanitizedHtml html={post.body} className="text-lg leading-[1.7]" />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <span className="font-bold">{text.share}</span>
            <a
              href={whatsappShareUrl(post)}
              target="_blank"
              rel="noopener"
              className={buttonClassName({
                variant: "whatsapp",
                size: "lg",
                className: "gap-2 px-4 font-bold",
              })}
            >
              <MessageCircleIcon aria-hidden="true" className="size-5" />
              {text.shareWhatsapp}
              <span className="sr-only"> {messages.forms.opensInNewTab}</span>
            </a>
          </div>
        </div>
      </article>
      <MorePosts currentSlug={post.slug} />
    </>
  );
}
