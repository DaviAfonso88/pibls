import { Suspense, useSyncExternalStore, type ReactNode } from "react";
import { LoadingBlock } from "~/shared/ui/loading-block";

/** Coluna de 640 px que abriga o formulário de uma página pública. */
export function FormPage({ children }: { children: ReactNode }) {
  return (
    <div className="container pt-6 pb-12">
      <div className="mx-auto flex max-w-[40rem] flex-col gap-4">{children}</div>
    </div>
  );
}

const subscribe = () => () => undefined;

/**
 * Envolve o formulário de uma página pública. Duas razões para ele só existir no navegador, depois da hidratação:
 *
 * - O formulário (React Hook Form + Zod) vem por `React.lazy` e fica fora do JS inicial (orçamento de bundle); enquanto
 *   chega, um esqueleto do formato final.
 * - No HTML pré-renderizado ele não pode aparecer: quem digitasse antes do JS carregar perderia o texto na hidratação, e um
 *   envio nativo mandaria nome e telefone na URL (dado pessoal em histórico e log). O servidor entrega o esqueleto e o aviso
 *   de que precisa do JavaScript.
 */
export function LazyForm({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const skeleton = <LoadingBlock count={4} itemClassName="h-16" />;

  if (!hydrated) {
    return (
      <>
        {skeleton}
        <noscript>
          <p className="m-0 rounded-xl border border-border p-4">
            Este formulário precisa do JavaScript. Ative-o no navegador ou fale conosco pelo
            WhatsApp.
          </p>
        </noscript>
      </>
    );
  }

  return <Suspense fallback={skeleton}>{children}</Suspense>;
}
