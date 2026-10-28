import { useEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router";

/**
 * Numa SPA, trocar de página não move o foco: quem usa leitor de tela ou teclado continua no link clicado, sem saber
 * que o conteúdo mudou. Depois de cada navegação (menos a primeira carga) leva o foco ao título da nova página.
 * O foco por programa só mostra o anel quando a pessoa está no teclado (`:focus-visible`).
 */
export function useFocusContentOnNavigation(contentRef: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const content = contentRef.current;
    if (!content) return;

    const target = content.querySelector<HTMLElement>("h1") ?? content;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, [pathname, contentRef]);
}
