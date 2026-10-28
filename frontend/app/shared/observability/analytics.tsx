import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Medição de uso do site (FR-076, TBD-09: GoatCounter). Agregada, sem cookies, sem `localStorage` e sem identificar a
 * pessoa; por isso não há banner de consentimento. Cuidados:
 *
 * - desligada sem `VITE_ANALYTICS_SRC` (o `count.js`) e `VITE_ANALYTICS_ENDPOINT` (`https://<código>.goatcounter.com/count`);
 * - nunca no painel (`/admin*`): lá há dado pessoal na tela, e a equipe não é público a ser medido;
 * - conta só o caminho (`/boletins`), nunca a query string (`?grupo=23`, `?q=nome`) nem o hash;
 * - o script entra por `useEffect`, depois da hidratação, e não pesa no bundle inicial.
 *
 * A CSP em `deploy/htaccess/public_html.htaccess` libera `script-src` e `connect-src` só para esta ferramenta.
 */

interface GoatCounter {
  no_onload?: boolean;
  count?: (vars: { path: string }) => void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

/** Só `https://…` ou um caminho do próprio site (script hospedado junto): nada de `http:` nem `javascript:`. */
function isAllowedUrl(url: string): boolean {
  return url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//"));
}

/** O painel e tudo o que mora em `/admin` ficam de fora. */
export function isMeasuredPath(pathname: string): boolean {
  return pathname !== "/admin" && !pathname.startsWith("/admin/");
}

// Caminhos que chegaram antes de o script terminar de carregar: são contados quando ele carregar
let pending: string[] = [];
let scriptRequested = false;

/** Só para os testes: volta ao estado de "nada carregado". */
export function resetAnalyticsForTests(): void {
  pending = [];
  scriptRequested = false;
}

function loadScript(src: string, endpoint: string): void {
  scriptRequested = true;
  // `no_onload`: o primeiro pageview também passa por `count`, com o caminho sem query
  window.goatcounter = { ...window.goatcounter, no_onload: true };

  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  script.dataset.goatcounter = endpoint;
  script.addEventListener("load", () => {
    const queued = pending;
    pending = [];
    for (const path of queued) window.goatcounter?.count?.({ path });
  });
  document.head.appendChild(script);
}

function countPath(pathname: string, src: string, endpoint: string): void {
  if (window.goatcounter?.count) {
    window.goatcounter.count({ path: pathname });
    return;
  }

  pending.push(pathname);
  if (!scriptRequested) loadScript(src, endpoint);
}

export function Analytics({
  src = import.meta.env.VITE_ANALYTICS_SRC ?? "",
  endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "",
}: {
  src?: string;
  endpoint?: string;
}) {
  const { pathname } = useLocation();
  const enabled = isAllowedUrl(src) && isAllowedUrl(endpoint) && isMeasuredPath(pathname);

  useEffect(() => {
    if (enabled) countPath(pathname, src, endpoint);
  }, [enabled, pathname, src, endpoint]);

  return null;
}
