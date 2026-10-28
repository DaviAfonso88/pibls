import { Controller, type UseFormReturn } from "react-hook-form";
import { cn } from "~/shared/lib/utils";
import { Checkbox } from "~/shared/ui/checkbox";
import { Field, FieldContent, FieldError, FieldLabel } from "~/shared/ui/field";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { Textarea } from "~/shared/ui/textarea";
import type { ApiFormField } from "../../api-shared";
import { publicEventMessages as text } from "../../public-messages";
import type { RegistrationValues } from "../../registration-schema";

/** Até quantas opções uma pergunta de escolha única vira botões de rádio; acima disso, uma lista para escolher. */
const RADIO_LIMIT = 4;

const choiceClassName = cn(
  "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border border-border-strong px-3.5",
  "has-[:checked]:border-primary has-[:checked]:bg-info has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
);

/**
 * Uma pergunta personalizada do formulário de inscrição (BR-024), no controle do seu tipo: texto, área de texto, número,
 * data, escolha única (botões de rádio até 4 opções, lista acima disso), várias escolhas ou caixa de marcar. O erro é o
 * do campo, e o rótulo da pergunta fica sempre visível.
 */
export function AnswerField({
  field,
  form,
}: {
  field: ApiFormField;
  form: UseFormReturn<RegistrationValues>;
}) {
  const name = `answers.${field.key}` as const;
  const id = `answer-${field.key}`;
  const { register, control, formState } = form;
  const error = form.getFieldState(name, formState).error?.message;
  const optionalLabel = field.required ? undefined : text.optional;
  const options = field.options ?? [];

  switch (field.type) {
    case "TEXT":
      return (
        <FormField
          id={id}
          label={field.label}
          optionalLabel={optionalLabel}
          hint={field.help_text}
          error={error}
        >
          {(controlProps) => <Input {...controlProps} {...register(name)} />}
        </FormField>
      );
    case "TEXTAREA":
      return (
        <FormField
          id={id}
          label={field.label}
          optionalLabel={optionalLabel}
          hint={field.help_text}
          error={error}
        >
          {(controlProps) => <Textarea {...controlProps} rows={4} {...register(name)} />}
        </FormField>
      );
    case "NUMBER":
      return (
        <FormField
          id={id}
          label={field.label}
          optionalLabel={optionalLabel}
          hint={field.help_text}
          error={error}
        >
          {(controlProps) => <Input {...controlProps} inputMode="decimal" {...register(name)} />}
        </FormField>
      );
    case "DATE":
      return (
        <FormField
          id={id}
          label={field.label}
          optionalLabel={optionalLabel}
          hint={field.help_text}
          error={error}
        >
          {(controlProps) => <Input {...controlProps} type="date" {...register(name)} />}
        </FormField>
      );
    case "SELECT":
      if (options.length > RADIO_LIMIT) {
        return (
          <FormField
            id={id}
            label={field.label}
            optionalLabel={optionalLabel}
            hint={field.help_text}
            error={error}
          >
            {(controlProps) => (
              <NativeSelect className="w-full" {...controlProps} {...register(name)}>
                <NativeSelectOption value="">{text.choose}</NativeSelectOption>
                {options.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        );
      }
      return (
        <ChoiceGroup id={id} field={field} error={error}>
          {options.map((option) => (
            <label key={option} className={choiceClassName}>
              <input
                type="radio"
                value={option}
                className="size-5 accent-primary"
                {...register(name)}
              />
              {option}
            </label>
          ))}
        </ChoiceGroup>
      );
    case "MULTISELECT":
      return (
        <ChoiceGroup id={id} field={field} error={error}>
          <Controller
            control={control}
            name={name}
            render={({ field: state }) => {
              const chosen = Array.isArray(state.value) ? state.value : [];

              return (
                <>
                  {options.map((option, index) => {
                    const optionId = `${id}-${index}`;

                    return (
                      <label key={option} htmlFor={optionId} className={choiceClassName}>
                        <Checkbox
                          id={optionId}
                          name={state.name}
                          checked={chosen.includes(option)}
                          onCheckedChange={(checked) =>
                            state.onChange(
                              checked
                                ? [...chosen, option]
                                : chosen.filter((value) => value !== option),
                            )
                          }
                          aria-invalid={error ? true : undefined}
                        />
                        {option}
                      </label>
                    );
                  })}
                </>
              );
            }}
          />
        </ChoiceGroup>
      );
    case "BOOLEAN":
      return (
        <Controller
          control={control}
          name={name}
          render={({ field: state }) => (
            <Field orientation="horizontal" data-invalid={error ? true : undefined}>
              <Checkbox
                id={id}
                name={state.name}
                checked={state.value === true}
                onCheckedChange={(checked) => state.onChange(checked)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              <FieldContent>
                <FieldLabel htmlFor={id} className="font-normal">
                  <span>
                    {field.label}
                    {optionalLabel ? (
                      <span className="text-muted-foreground"> {optionalLabel}</span>
                    ) : null}
                  </span>
                </FieldLabel>
                {field.help_text ? (
                  <p className="m-0 text-sm text-muted-foreground">{field.help_text}</p>
                ) : null}
                {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
              </FieldContent>
            </Field>
          )}
        />
      );
  }
}

/** Pergunta de escolha: o `fieldset` com o rótulo na `legend`, a dica e o erro ligados ao grupo. */
function ChoiceGroup({
  id,
  field,
  error,
  children,
}: {
  id: string;
  field: ApiFormField;
  error: string | undefined;
  children: React.ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [field.help_text ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
      aria-describedby={describedBy || undefined}
    >
      <legend className="mb-1 font-bold">
        {field.label}
        {field.required ? null : (
          <span className="font-normal text-muted-foreground"> {text.optional}</span>
        )}
      </legend>
      {field.help_text ? (
        <p id={hintId} className="m-0 text-sm text-muted-foreground">
          {field.help_text}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">{children}</div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </fieldset>
  );
}
