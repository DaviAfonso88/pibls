import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { messages } from "~/shared/messages";
import { cn } from "~/shared/lib/utils";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYoutubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && VIDEO_ID.test(value);
}

/**
 * Vídeo do YouTube sob toque: mostra só a miniatura (`i.ytimg.com`, sem cookie) e um botão de reproduzir. O `iframe` de
 * `youtube-nocookie.com` só entra depois do clique, com a reprodução já iniciada. Id inválido: não renderiza nada.
 */
export function YouTubeFacade({
  videoId,
  title,
  className,
}: {
  videoId: string | null | undefined;
  /** Título do vídeo: nome acessível do botão e do `iframe`. */
  title: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (!isYoutubeVideoId(videoId)) return null;

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl bg-foreground",
        className,
      )}
    >
      {playing ? (
        <iframe
          title={title}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`${messages.media.playVideo}: ${title}`}
          className="group absolute inset-0 flex items-center justify-center"
        >
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <span className="relative flex size-16 items-center justify-center rounded-full bg-footer text-footer-foreground group-hover:bg-primary">
            <PlayIcon aria-hidden="true" className="size-7" />
          </span>
        </button>
      )}
    </div>
  );
}
