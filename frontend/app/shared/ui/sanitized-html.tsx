import { cn } from "~/shared/lib/utils";

/**
 * Único lugar do frontend onde `dangerouslySetInnerHTML` é aceito (regra de ESLint). Só para campos `SanitizedHtml`
 * da API (`body`, `description`): o servidor já passou o HTML pelo HTMLPurifier (BR-046). Nunca use com texto que
 * venha de outro lugar.
 */
export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div className={cn("prose max-w-none", className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
