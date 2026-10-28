import { useEffect } from "react";

/**
 * Avisa antes de fechar ou recarregar a aba com alteração não salva (Web Interface Guidelines: "Warn on navigation with
 * unsaved changes"). O navegador mostra o próprio texto; o `returnValue` vazio só liga o aviso. Serve às telas sem
 * rascunho local, como as configurações e o catálogo, onde perder o que foi digitado é pior do que pedir confirmação.
 */
export function useUnsavedWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
