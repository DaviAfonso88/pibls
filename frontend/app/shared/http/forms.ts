import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { messages } from "~/shared/messages";
import { isApiError } from "./errors";

export interface AppliedApiErrors {
  /** Erros que não pertencem a um campo do formulário (ou qualquer erro que não seja de validação). */
  general: string | null;
  /** O primeiro campo que recebeu erro, para o foco ir até ele. */
  firstField: string | null;
}

/**
 * Passa os erros 422 da API (`error.details[].field`) para os campos do React Hook Form (Frontend → Formulários).
 *
 * - `fields`: os nomes que o formulário realmente tem. O que a API citar fora dessa lista vai para `general`, em vez de
 *   ficar num campo que não existe.
 * - Qualquer erro que não seja de validação (409, 429, 500, rede…) vira `general`, com a mensagem amigável dele.
 */
export function applyApiErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  fields: readonly string[],
): AppliedApiErrors {
  if (!isApiError(error)) {
    return { general: messages.errors.generic, firstField: null };
  }

  if (!error.isValidation) {
    return { general: error.message, firstField: null };
  }

  const known = new Set(fields);
  const orphanMessages: string[] = [];
  let firstField: string | null = null;

  for (const [field, message] of Object.entries(error.fieldErrors())) {
    if (known.has(field)) {
      const detail = error.details.find((item) => item.field === field);
      setError(
        field as FieldPath<TFieldValues>,
        { type: detail?.code ?? "server", message },
        { shouldFocus: firstField === null },
      );
      firstField ??= field;
    } else {
      orphanMessages.push(message);
    }
  }

  return { general: orphanMessages.length > 0 ? orphanMessages.join(" ") : null, firstField };
}
