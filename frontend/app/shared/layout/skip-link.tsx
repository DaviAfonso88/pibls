import { messages } from "~/shared/messages";

/** Primeiro item da ordem do Tab: pula o menu e vai direto ao conteúdo (WCAG 2.4.1). Só aparece com o foco. */
export function SkipLink({ targetId }: { targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      {messages.a11y.skipToContent}
    </a>
  );
}
