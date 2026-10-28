import { messages } from "~/shared/messages";
import { Checkbox } from "./checkbox";
import { Field, FieldContent, FieldError, FieldLabel } from "./field";

export interface ConsentCheckboxProps {
  id: string;
  name?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Texto do erro (BR-001: `ruleMessages.consent`). Marca o campo como inválido. */
  error?: string;
  privacyHref?: string;
  disabled?: boolean;
}

/**
 * Consentimento da Política de Privacidade (BR-001), obrigatório nos formulários públicos. A caixa nunca vem marcada.
 * O link abre em outra aba para a pessoa ler sem perder o que já digitou.
 */
export function ConsentCheckbox({
  id,
  name,
  checked,
  onCheckedChange,
  error,
  privacyHref = "/privacidade",
  disabled,
}: ConsentCheckboxProps) {
  const errorId = `${id}-error`;

  return (
    <Field orientation="horizontal" data-invalid={error ? true : undefined}>
      <Checkbox
        id={id}
        name={name}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldContent>
        <FieldLabel htmlFor={id} className="font-normal">
          <span>
            {messages.forms.consentBefore}
            <a
              href={privacyHref}
              target="_blank"
              rel="noopener"
              className="font-bold text-primary underline underline-offset-2 hover:text-primary-hover"
            >
              {messages.forms.consentLink}{" "}
              <span className="sr-only">{messages.forms.opensInNewTab}</span>
            </a>
            {messages.forms.consentAfter}
          </span>
        </FieldLabel>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </FieldContent>
    </Field>
  );
}
