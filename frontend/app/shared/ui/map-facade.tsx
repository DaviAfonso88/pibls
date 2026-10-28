import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import { messages } from "~/shared/messages";
import { cn } from "~/shared/lib/utils";
import { buttonClassName } from "./button-variants";

/**
 * O CSP (`frame-src`) só aceita o mapa incorporado do Google; qualquer outro endereço é ignorado. Links comuns do Maps
 * (`/maps/search`, `/maps/place`) também ficam de fora: o Google proíbe abri-los num quadro ("A conexão com
 * www.google.com foi recusada"). Valem `/maps/embed?pb=…` (Compartilhar › Incorporar um mapa) e `/maps?q=…&output=embed`.
 */
export function isAllowedMapEmbed(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const isEmbedPath =
      parsed.pathname.startsWith("/maps/embed") ||
      (parsed.pathname === "/maps" && parsed.searchParams.get("output") === "embed");
    return parsed.protocol === "https:" && parsed.hostname === "www.google.com" && isEmbedPath;
  } catch {
    return false;
  }
}

/**
 * Mapa sob toque: a página mostra um botão, e o `iframe` do Google (pesado, com cookies de terceiros) só nasce depois
 * do clique (Frontend → Lazy loading: "Players do YouTube e mapas: fachada"). Sem endereço de mapa válido, não
 * renderiza nada.
 */
export function MapFacade({
  embedUrl,
  className,
}: {
  embedUrl: string | null | undefined;
  className?: string;
}) {
  const [shown, setShown] = useState(false);

  if (!isAllowedMapEmbed(embedUrl)) return null;

  return (
    <section
      aria-label={messages.media.mapTitle}
      className={cn("flex min-h-64 overflow-hidden rounded-2xl border border-border", className)}
    >
      {shown ? (
        <iframe
          title={messages.media.mapTitle}
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="min-h-64 w-full flex-1 border-0"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
          <button
            type="button"
            onClick={() => setShown(true)}
            className={buttonClassName({ variant: "outline", size: "lg" })}
          >
            <MapPinIcon data-icon="inline-start" aria-hidden="true" />
            {messages.media.showMap}
          </button>
          <p className="m-0 max-w-64 text-sm text-muted-foreground">{messages.media.mapHint}</p>
        </div>
      )}
    </section>
  );
}
