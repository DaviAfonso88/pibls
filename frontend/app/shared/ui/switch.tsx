/* Alteração local (shadcn/ui): trilho de 52×32 px do design (AdminConfiguracoes), com área de toque de 44 px. */
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "~/shared/lib/utils";

/**
 * Liga ou desliga uma coisa (aviso no ar, item visível no site). O nome vem de `aria-label` ou `aria-labelledby`: o
 * trilho não tem texto.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-0 bg-input p-0 transition-colors outline-none after:absolute after:-inset-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6 translate-x-1 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-6"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
