import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "~/shared/lib/utils";
import { messages } from "~/shared/messages";
import { FieldError } from "./field";

/**
 * Pergunta de sim ou não (design: "Deseja receber uma visita?"). Dois botões de rádio nativos, lado a lado, com alvo de
 * toque de 48 px, no `fieldset` com a pergunta na `legend`. O valor é `"sim"` ou `"nao"`: quem envia converte para
 * booleano. Ligado ao React Hook Form pelo `register`.
 */
export function YesNoField({
  name,
  legend,
  register,
  error,
}: {
  name: string;
  legend: string;
  /** `() => register("campo")`: o registro acontece aqui, na ordem da tela, para o foco do erro ir ao primeiro campo. */
  register: () => UseFormRegisterReturn;
  error?: string;
}) {
  const errorId = `${name}-error`;
  const registration = register();

  return (
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-2 font-bold">{legend}</legend>
      <div className="flex gap-2.5">
        {(
          [
            ["sim", messages.common.yes],
            ["nao", messages.common.no],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={cn(
              "flex min-h-12 flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border border-border-strong px-3.5",
              "has-[:checked]:border-primary has-[:checked]:bg-info has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            )}
          >
            <input type="radio" value={value} className="size-5 accent-primary" {...registration} />
            {label}
          </label>
        ))}
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </fieldset>
  );
}
