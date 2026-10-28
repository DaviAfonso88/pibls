import { queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { array, nullish, number, object, schema, string } from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";

/** `Pix` (contracts/openapi.yaml): o valor vigente, no mesmo formato público. */
const pixParser = object({
  pix_key: string,
  beneficiary_name: string,
  qr_image_url: nullish(string),
  copy_paste_code: nullish(string),
});

export type AdminPix = ReturnType<typeof pixParser>;

/** Uma alteração da auditoria: quem, quando e quais campos (sem os valores antigos). */
const historyParser = object({
  id: number,
  occurred_at: string,
  actor: nullish(object({ id: number, name: string })),
  fields: array(string),
});

export type PixHistoryItem = ReturnType<typeof historyParser>;

const showEnvelope = schema(object({ data: pixParser, history: array(historyParser) }));
const savedEnvelope = schema(object({ data: pixParser }));

export function adminPixQuery() {
  return queryOptions({
    queryKey: ["admin", "pix"] as const,
    queryFn: async ({ signal }) =>
      showEnvelope.parse(await api.get<unknown>("/api/admin/settings/pix", { signal })),
    staleTime: STALE_TIME.admin,
  });
}

export interface PixInput {
  pix_key: string;
  beneficiary_name: string;
  copy_paste_code: string;
  current_password: string;
}

/**
 * Altera os dados PIX (multipart). A senha viaja só nesta requisição e não é guardada em lugar nenhum (BR-060); o QR Code
 * só vai se a pessoa escolheu um novo.
 */
export async function updatePix(input: PixInput, qrImage: File | null): Promise<AdminPix> {
  const form = new FormData();
  form.set("pix_key", input.pix_key);
  form.set("beneficiary_name", input.beneficiary_name);
  form.set("copy_paste_code", input.copy_paste_code);
  form.set("current_password", input.current_password);
  if (qrImage !== null) form.set("qr_image", qrImage);

  return savedEnvelope.parse(await api.post<unknown>("/api/admin/settings/pix", form)).data;
}
