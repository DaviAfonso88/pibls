import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";

/** O que o controle precisa para ficar ligado ao rótulo, à dica e ao erro (WCAG 1.3.1, 3.3.1). */
export interface FormControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

/**
 * Um campo de formulário completo: rótulo sempre visível (nunca só placeholder), dica e erro ligados ao controle por
 * `aria-describedby`, e `aria-invalid` quando há erro. O controle vem como função para receber esses atributos:
 *
 *   <FormField id="nome" label="Nome" error={errors.name?.message}>
 *     {(control) => <Input {...control} {...register("name")} />}
 *   </FormField>
 */
export function FormField({
  id,
  label,
  optionalLabel,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  /** Texto de "(opcional)", ao lado do rótulo. */
  optionalLabel?: string;
  hint?: ReactNode;
  error?: string;
  children: (control: FormControlProps) => ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id} className="font-bold">
        {label}
        {optionalLabel ? (
          <span className="font-normal text-muted-foreground"> {optionalLabel}</span>
        ) : null}
      </FieldLabel>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}
