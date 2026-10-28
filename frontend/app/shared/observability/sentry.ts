/**
 * Sentry do frontend (Observability). Desligado sem `VITE_SENTRY_DSN`. Nunca recebe dado pessoal (LGPD):
 *
 * - `dataCollection` no mínimo (no Sentry 11 ele substitui o `sendDefaultPii`), sem Session Replay e sem tracing;
 * - nada de cookies, cabeçalhos, corpo de requisição, usuário ou query string de URL;
 * - cliques, digitação e console não viram *breadcrumbs* (o texto do que a pessoa digita iria junto);
 * - e-mails e sequências longas de dígitos (telefone, CPF, CNPJ) são trocados por `[redigido]` nas mensagens.
 *
 * Os mesmos cuidados valem no backend (`SentryScrubber`).
 */

// Só tipos: o SDK em si é carregado sob demanda (`initSentry`) e não pesa no bundle inicial
import type { Breadcrumb, ErrorEvent } from "@sentry/react";

const REDACTED = "[redigido]";
const EMAIL = /[^\s@<>()"']+@[^\s@<>()"']+\.[^\s@<>()"']+/g;
// Telefone, CPF, CNPJ, CEP: 8 ou mais dígitos, com os separadores comuns no meio
const LONG_DIGITS = /[+(]?\d[\d\s().+/-]{6,}\d/g;

/** Troca e-mail e número longo por `[redigido]`. */
export function scrubText(text: string): string {
  return text.replace(EMAIL, REDACTED).replace(LONG_DIGITS, REDACTED);
}

/** Mantém só origem e caminho: a query string e o hash podem ter nome, e-mail ou telefone. */
export function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    const path = scrubText(parsed.pathname);
    return url.startsWith("/") ? path : `${parsed.origin}${path}`;
  } catch {
    return REDACTED;
  }
}

/** Categorias de breadcrumb que carregam o que a pessoa fez ou digitou. */
const DROPPED_BREADCRUMBS = new Set(["ui.click", "ui.input", "console"]);

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category && DROPPED_BREADCRUMBS.has(breadcrumb.category)) return null;

  const { data } = breadcrumb;
  if (!data) return breadcrumb;

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "url" || key === "from" || key === "to") {
      scrubbed[key] = typeof value === "string" ? scrubUrl(value) : REDACTED;
    } else if (key === "method" || key === "status_code" || key === "reason") {
      scrubbed[key] = value;
    }
    // Qualquer outro campo (corpo, cabeçalhos…) fica de fora
  }

  return {
    ...breadcrumb,
    message: breadcrumb.message && scrubText(breadcrumb.message),
    data: scrubbed,
  };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.extra;
  delete event.server_name;

  if (event.request) {
    event.request = event.request.url ? { url: scrubUrl(event.request.url) } : {};
  }
  if (event.message) event.message = scrubText(event.message);

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }

  event.breadcrumbs = event.breadcrumbs
    ?.map((breadcrumb) => scrubBreadcrumb(breadcrumb))
    .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);

  return event;
}

type SentrySdk = typeof import("@sentry/react");

let sdk: Promise<SentrySdk | null> | null = null;

/**
 * Liga o Sentry, se houver DSN. O SDK (dezenas de KB) vem por `import()`, em paralelo à hidratação, e não entra no JS
 * da carga inicial (orçamento de bundle). Um erro no próprio carregamento nunca derruba o site: só fica sem relatório.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  sdk = import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        release: import.meta.env.VITE_RELEASE || undefined,
        environment: import.meta.env.MODE,
        // Nada de usuário, cookies, cabeçalhos, corpos, query string nem variáveis locais das pilhas
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          stackFrameVariables: false,
        },
        tracesSampleRate: 0,
        maxBreadcrumbs: 20,
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      });
      return Sentry;
    })
    .catch(() => null);
}

/** Envia um erro capturado por um `ErrorBoundary`. Sem Sentry iniciado (sem DSN), não faz nada. */
export function reportError(error: unknown): void {
  void sdk?.then((Sentry) => Sentry?.captureException(error));
}
