import { useRef } from "react";
import { Outlet } from "react-router";
import { SiteFooter } from "~/shared/layout/site-footer";
import { SiteHeader } from "~/shared/layout/site-header";
import { SkipLink } from "~/shared/layout/skip-link";
import { useFocusContentOnNavigation } from "~/shared/layout/use-focus-content";
import { visibleNavItems } from "~/shared/layout/nav";
import { safeHttpUrl } from "~/shared/site/links";
import { usePublicSettings } from "~/shared/site/settings";
import { StaleNotice } from "~/shared/ui/error-state";

const CONTENT_ID = "conteudo";

/**
 * Moldura do site público: pular para o conteúdo, cabeçalho com o menu, conteúdo e rodapé. O menu esconde "Eventos"
 * enquanto a flag `features.events` estiver desligada (R1); sem as configurações, a flag vale como desligada.
 */
export default function PublicLayout() {
  const contentRef = useRef<HTMLElement>(null);
  const { settings, stale } = usePublicSettings();
  useFocusContentOnNavigation(contentRef);

  return (
    <>
      <SkipLink targetId={CONTENT_ID} />
      <SiteHeader
        items={visibleNavItems({ events: settings?.features.events ?? false })}
        youtubeUrl={safeHttpUrl(settings?.youtube_links?.channel_url)}
      />
      <main id={CONTENT_ID} ref={contentRef}>
        {stale ? <StaleNotice className="container my-4" /> : null}
        <Outlet />
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
