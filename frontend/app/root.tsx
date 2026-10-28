import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import { isApiError } from "~/shared/http/errors";
import { BrowserOutdatedNotice } from "~/shared/layout/browser-outdated-notice";
import { queryClient } from "~/shared/lib/query-client";
import { messages } from "~/shared/messages";
import { Analytics } from "~/shared/observability/analytics";
import { reportError } from "~/shared/observability/sentry";
import { publicSettingsQuery } from "~/shared/site/settings";
import { whatsappUrl } from "~/shared/site/links";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ErrorState } from "~/shared/ui/error-state";
import { Spinner } from "~/shared/ui/spinner";
import type { Route } from "./+types/root";
import "./app.css";

/** Ícones da aba e da tela inicial do celular, gerados do símbolo por `scripts/optimize-images.py`. */
export function links(): Route.LinkDescriptors {
  return [
    { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
    { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  ];
}

/**
 * Casca do documento. Também envolve o `ErrorBoundary` e o `HydrateFallback`, por isso o provedor do cache de dados fica
 * aqui e não no componente da rota: um erro não pode levar o cache junto. O `TooltipProvider` e o `Toaster` ficam no
 * layout do painel, os únicos que usam dica de ferramenta e toast (orçamento de bundle).
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <BrowserOutdatedNotice />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// O <Toaster> (sonner) fica no layout do painel: o site público não usa toast, e o JS dele pesa no orçamento de bundle
export default function App() {
  return (
    <>
      <Outlet />
      <Analytics />
    </>
  );
}

/** Mostrada no HTML de fallback da SPA (painel e 404) enquanto o JavaScript carrega. */
export function HydrateFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status">
      <Spinner aria-hidden="true" className="size-8 text-primary" />
      <span className="sr-only">{messages.a11y.loadingContent}</span>
    </div>
  );
}

/** Erro que nenhuma rota tratou: relata ao Sentry (sem dado pessoal) e mostra a mensagem amigável. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (!notFound) reportError(error);
  }, [error, notFound]);

  const message = notFound
    ? messages.errors.notFound
    : isApiError(error)
      ? error.message
      : messages.errors.generic;
  // O WhatsApp só aparece se as configurações já estiverem no cache; este componente não busca nada
  const whatsapp = whatsappUrl(
    queryClient.getQueryData(publicSettingsQuery.queryKey)?.data.whatsapp,
  );

  return (
    <main className="container flex flex-col items-center gap-6 py-16">
      <ErrorState
        headingLevel="h1"
        title={notFound ? messages.states.notFoundTitle : messages.states.unexpectedTitle}
        message={message}
        onRetry={notFound ? undefined : () => window.location.reload()}
        whatsappUrl={whatsapp}
      />
      <a href="/" className={buttonClassName({ variant: "outline" })}>
        {messages.states.backHome}
      </a>
    </main>
  );
}
