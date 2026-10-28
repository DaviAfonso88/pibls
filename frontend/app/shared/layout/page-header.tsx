import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

/**
 * Faixa de título das páginas internas (design: cabeçalho de "Como chegar", "Ministérios", "Grupos"): o `h1`, uma frase
 * de apoio e, se houver, algo mais embaixo. Cada página tem um único `h1`, e é ele que recebe o foco ao navegar.
 * `narrow` estreita o conteúdo para 640 px, a largura dos formulários.
 */
export function PageHeader({
  title,
  eyebrow,
  intro,
  narrow = false,
  children,
  media,
  className,
}: {
  title: string;
  /** Linha pequena em caixa-alta acima do título (ex.: "Ficha de Visitante"). */
  eyebrow?: string;
  intro?: ReactNode;
  narrow?: boolean;
  children?: ReactNode;
  /** Foto da página, na largura do conteúdo, depois do texto (use `Photo` com uma proporção larga). */
  media?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border bg-muted pt-8 pb-6", className)}>
      <div className="container">
        <div className={cn("flex flex-col gap-4", narrow && "mx-auto max-w-[40rem]")}>
          <div className="flex flex-col gap-2">
            {eyebrow ? (
              <p className="m-0 text-sm font-bold tracking-wider text-primary uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="m-0 text-balance">{title}</h1>
            {intro ? (
              <p className="m-0 max-w-prose text-lg text-muted-foreground">{intro}</p>
            ) : null}
          </div>
          {children}
          {media}
        </div>
      </div>
    </section>
  );
}
