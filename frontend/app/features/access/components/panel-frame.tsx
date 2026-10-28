import { MenuIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { SkipLink } from "~/shared/layout/skip-link";
import { useFocusContentOnNavigation } from "~/shared/layout/use-focus-content";
import { usePublicSettings } from "~/shared/site/settings";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "~/shared/ui/sheet";
import { accessMessages } from "../messages";
import { AdminNav, type MenuBadge } from "./admin-nav";

const CONTENT_ID = "conteudo";

/**
 * Moldura do painel (design: AdminInicio): menu lateral fixo a partir de `lg` (1024 px) e, abaixo disso, uma barra no topo
 * com o botão que abre o mesmo menu numa gaveta (`Sheet`). Depois de cada navegação o foco vai ao título da página.
 */
export function PanelFrame({
  children,
  badges,
}: {
  children: ReactNode;
  /** Os selos de contatos novos do menu. */
  badges?: Partial<Record<MenuBadge, number>>;
}) {
  const contentRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const { settings } = usePublicSettings();
  const features = { events: settings?.features.events ?? false };
  useFocusContentOnNavigation(contentRef);

  return (
    <div className="flex min-h-svh flex-col bg-muted lg:flex-row">
      <SkipLink targetId={CONTENT_ID} />

      <aside className="sticky top-0 hidden h-svh w-62 flex-none overflow-y-auto border-r border-border bg-card lg:block">
        <AdminNav features={features} badges={badges} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-2 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label={accessMessages.menu.open}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg border border-border-strong bg-background"
          >
            <MenuIcon aria-hidden="true" className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw] overflow-y-auto p-0">
            <SheetTitle className="sr-only">{accessMessages.menu.label}</SheetTitle>
            <SheetDescription className="sr-only">{accessMessages.panelName}</SheetDescription>
            <AdminNav features={features} badges={badges} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-extrabold">{accessMessages.panelName}</span>
      </header>

      <main
        id={CONTENT_ID}
        ref={contentRef}
        className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        {children}
      </main>
    </div>
  );
}
