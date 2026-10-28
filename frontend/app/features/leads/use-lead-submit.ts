import { useState } from "react";
import type { FieldValues, UseFormSetError } from "react-hook-form";
import { applyApiErrors } from "~/shared/http/forms";
import { submitLead } from "./api";
import type { LeadPayload } from "./schemas";

/**
 * O envio de um formulário de contato: manda para a API, mostra a confirmação em caso de sucesso e distribui o erro:
 * o 422 vai para o campo certo (foco no primeiro), e qualquer outro (429, 5xx, rede) vira uma mensagem geral com o
 * texto amigável da API. O botão fica travado enquanto envia pelo `isSubmitting` do React Hook Form.
 */
export function useLeadSubmit<TValues extends FieldValues>(
  setError: UseFormSetError<TValues>,
  fields: readonly string[],
  toPayload: (values: TValues) => LeadPayload,
) {
  const [general, setGeneral] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit(values: TValues): Promise<void> {
    setGeneral(null);
    try {
      await submitLead(toPayload(values));
      setSubmitted(true);
    } catch (error) {
      setGeneral(applyApiErrors(error, setError, fields).general);
    }
  }

  return { submit, general, submitted };
}
