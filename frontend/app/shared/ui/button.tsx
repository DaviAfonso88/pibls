/* Alteração local (shadcn/ui): alvos de toque de 44 px (design: botões ≥ 48 px nos formulários públicos), hover da marca (--primary-hover), borda forte no botão secundário e variantes whatsapp e highlight do design. */
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type VariantProps } from "class-variance-authority";
import { cn } from "~/shared/lib/utils";
import { buttonVariants } from "./button-variants";

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
