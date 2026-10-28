import { api } from "~/shared/http/client";
import type { LeadPayload } from "./schemas";

/**
 * `POST /api/public/leads` (CAP-05). O cliente HTTP já cuida do CSRF (cookie antes da primeira escrita, nova tentativa
 * no 419) e do `X-Request-Id`. A resposta é só `{data: {received: true}}`: a API não devolve o id do contato.
 */
export function submitLead(payload: LeadPayload, signal?: AbortSignal): Promise<void> {
  return api.post<unknown>("/api/public/leads", payload, { signal }).then(() => undefined);
}
