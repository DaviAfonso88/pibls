/* Alteração local (shadcn/ui): alvos de toque de 44 px (design: botões ≥ 48 px nos formulários públicos), hover da marca (--primary-hover), borda forte no botão secundário e variantes whatsapp e highlight do design. */
/*
 * Só as classes do botão, sem o Base UI: as páginas públicas usam `buttonClassName` em links e `<button>` nativos e não podem
 * carregar o `Button` do Base UI (orçamento de bundle, RNF-05). O componente `Button` fica em `button.tsx`.
 */
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/shared/lib/utils";

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        whatsapp: "bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90",
        highlight: "bg-highlight text-highlight-foreground hover:bg-highlight/90",
        outline:
          "border-border-strong bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-4 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11",
        "icon-xs":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * As classes de um botão para um link (`<a>` ou `<Link>`) com o visual de `Button`. Passa pelo `cn` (tailwind-merge) como o
 * `Button` faz: o `cva` sozinho só concatena, e as classes de `className` brigariam com as da variante (`justify-center` x
 * `justify-between`, `border-transparent` x `border-border-strong`), com o CSS decidindo o vencedor.
 */
export function buttonClassName({
  className,
  ...variants
}: VariantProps<typeof buttonVariants> & { className?: string }) {
  return cn(buttonVariants(variants), className);
}
