import type { ComponentProps } from "react";

export type HoneypotProps = Omit<ComponentProps<"input">, "type" | "tabIndex" | "autoComplete">;

/**
 * Campo-armadilha contra robôs (BR-002): o servidor descarta o envio se `website` chegar preenchido. Fica fora da
 * tela (não com `display: none`, que alguns robôs já ignoram), fora da ordem do Tab e escondido de leitores de tela,
 * então uma pessoa nunca o vê nem o preenche. Aceita as props do `register` do React Hook Form.
 */
export function Honeypot({ name = "website", ...props }: HoneypotProps) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <input
        type="text"
        name={name}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        aria-label="Deixe este campo vazio"
        {...props}
      />
    </div>
  );
}
