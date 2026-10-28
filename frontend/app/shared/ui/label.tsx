/* Alteração local (shadcn/ui): texto de 16 px, o mesmo do corpo dos formulários. */
import * as React from "react";
import { cn } from "~/shared/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // Wrapper genérico: `htmlFor` e `children` chegam pelas props, onde cada tela associa o rótulo ao campo
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-base leading-snug font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
