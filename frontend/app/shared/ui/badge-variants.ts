/* Alteração local (shadcn/ui): variantes info, success e warning (StatusBadge) e texto de 14 px, com altura de 24 px, para leitura no celular. */
/*
 * Só as classes do selo, sem o Base UI: as páginas públicas usam `badgeVariants` em `<span>` e `<a>` e não podem carregar o
 * `Badge` do Base UI (orçamento de bundle, RNF-05). O componente `Badge` fica em `badge.tsx`.
 */
import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2.5 py-0.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        info: "border-info-border bg-info text-info-foreground",
        success: "border-success-foreground/20 bg-success text-success-foreground",
        warning: "border-warning-foreground/30 bg-warning text-warning-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
