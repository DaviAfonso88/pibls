import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";
import { Input } from "./input";

export type DatePickerMode = "date" | "datetime-local";

export interface DatePickerProps extends Omit<ComponentProps<typeof Input>, "type"> {
  /** `date` para só o dia (`AAAA-MM-DD`); `datetime-local` para dia e hora (`AAAA-MM-DDTHH:mm`). */
  mode?: DatePickerMode;
}

/**
 * Data (ou data e hora) com o seletor nativo do navegador: no celular é a roleta do sistema, no desktop o calendário,
 * ambos acessíveis por teclado e leitor de tela, e exibidos em dd/mm/aaaa por causa do `lang="pt-BR"` (FR-074). O valor
 * do campo fica no formato do HTML; use `toApiDateTime` / `toDateTimeLocal` (`~/shared/format`) para ir e voltar da API
 * no horário de Brasília.
 */
export function DatePicker({ mode = "date", className, ...props }: DatePickerProps) {
  return (
    <Input
      type={mode}
      lang="pt-BR"
      autoComplete="off"
      className={cn("w-full sm:w-auto sm:min-w-56", className)}
      {...props}
    />
  );
}
