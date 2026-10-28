import { queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import {
  array,
  boolean,
  nullish,
  number,
  object,
  oneOf,
  schema,
  string,
} from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";

export const MINISTRY_CATEGORIES = ["MINISTERIO", "GRUPO", "CELULA"] as const;
export type MinistryCategory = (typeof MINISTRY_CATEGORIES)[number];

/** `MinistryAdmin` (contracts/openapi.yaml): o item público mais o que só o painel vê (BR-048). */
const ministryParser = object({
  id: number,
  category: oneOf(MINISTRY_CATEGORIES),
  name: string,
  description: nullish(string),
  leaders_text: nullish(string),
  schedule_text: nullish(string),
  neighborhood: nullish(string),
  contact_phone: nullish(string),
  private_address: nullish(string),
  contact_email: nullish(string),
  display_order: number,
  is_active: boolean,
  updated_at: nullish(string),
  updated_by: nullish(object({ id: number, name: nullish(string) })),
});

export type AdminMinistry = ReturnType<typeof ministryParser>;

const listEnvelope = schema(object({ data: array(ministryParser) }));
const itemEnvelope = schema(object({ data: ministryParser }));

/** O catálogo inteiro (ativos e inativos), na ordem de exibição. */
export function adminMinistriesQuery() {
  return queryOptions({
    queryKey: ["admin", "ministries"] as const,
    queryFn: async ({ signal }) =>
      listEnvelope.parse(await api.get<unknown>("/api/admin/ministries", { signal })).data,
    staleTime: STALE_TIME.admin,
  });
}

/** `MinistryInput`: texto vazio vai como `null` nos campos opcionais. */
export interface MinistryInput {
  category: MinistryCategory;
  name: string;
  description: string | null;
  leaders_text: string | null;
  schedule_text: string | null;
  neighborhood: string | null;
  contact_phone: string | null;
  private_address: string | null;
  contact_email: string | null;
}

export async function createMinistry(input: MinistryInput): Promise<AdminMinistry> {
  return itemEnvelope.parse(await api.post<unknown>("/api/admin/ministries", input)).data;
}

/** Altera só o que foi enviado: a tela usa para o formulário, para ligar e desligar e para reordenar. */
export async function updateMinistry(
  id: number,
  changes: Partial<MinistryInput> & { display_order?: number; is_active?: boolean },
): Promise<AdminMinistry> {
  return itemEnvelope.parse(await api.patch<unknown>(`/api/admin/ministries/${id}`, changes)).data;
}

export async function deleteMinistry(id: number): Promise<void> {
  await api.delete<unknown>(`/api/admin/ministries/${id}`);
}
