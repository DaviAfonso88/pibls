import type { ComponentProps } from "react";
import { maskPhone } from "~/shared/format";
import { Input } from "./input";

export type PhoneInputProps = Omit<ComponentProps<typeof Input>, "type" | "inputMode">;

/**
 * Telefone brasileiro com máscara `(31) 99999-8888` enquanto a pessoa digita (BR-004). Colar com `+55` ou sem máscara
 * também funciona. O valor do campo é o texto já mascarado: serve tanto para `register` quanto para `Controller`, e o
 * servidor guarda em E.164 (`toE164`).
 */
export function PhoneInput({ onChange, ...props }: PhoneInputProps) {
  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      spellCheck={false}
      placeholder="(31) 99999-8888"
      {...props}
      onChange={(event) => {
        // O valor é trocado antes de `onChange` para o formulário já receber o texto mascarado
        event.target.value = maskPhone(event.target.value);
        onChange?.(event);
      }}
    />
  );
}
