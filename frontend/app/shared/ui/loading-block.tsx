import { cn } from "~/shared/lib/utils";
import { messages } from "~/shared/messages";
import { Skeleton } from "./skeleton";

/**
 * Esqueleto de uma lista que ainda carrega (Frontend → Estados de tela: "Carregando": o formato final, sem spinner de
 * página inteira). Anunciado como `status` para leitores de tela; no HTML pré-renderizado é o que a pessoa vê até os
 * dados chegarem.
 */
export function LoadingBlock({
  count = 3,
  className,
  itemClassName,
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col gap-3", className)}>
      <span className="sr-only">{messages.a11y.loadingContent}</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn("h-14 w-full", itemClassName)} />
      ))}
    </div>
  );
}
