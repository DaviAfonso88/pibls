import { messages } from "~/shared/messages";

/**
 * Aviso para navegador abaixo do piso do Tailwind 4 (Frontend Architecture, regra 13). Fica oculto; o CSS de
 * `app.css` o mostra só quando o navegador não entende `color-mix()`. Por isso usa a classe `browser-outdated` e
 * HTML puro, sem nenhuma classe do Tailwind: a página inteira pode estar sem estilo.
 */
export function BrowserOutdatedNotice() {
  return (
    <div className="browser-outdated" role="alert">
      {messages.browserOutdated.text} <a href="/como-chegar">{messages.browserOutdated.link}</a>.
    </div>
  );
}
