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

export const LEAD_TYPES = ["VISITANTE", "MEMBRO", "CONTATO", "MINISTERIO", "ORACAO"] as const;
export const LEAD_STATUSES = ["NOVO", "EM_ATENDIMENTO", "CONCLUIDO"] as const;

export type LeadType = (typeof LEAD_TYPES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Quem pode ser responsável (`UserRefWithStatus`). `is_active` falso vira "(inativo)" (BR-012). */
const assigneeParser = object({ id: number, name: string, is_active: boolean });

const leadListItemParser = object({
  id: number,
  type: oneOf(LEAD_TYPES),
  status: oneOf(LEAD_STATUSES),
  name: nullish(string),
  phone: nullish(string),
  created_at: string,
  /** Preenchido só em `NOVO` há mais de 3 dias (BR-010). */
  waiting_days: nullish(number),
  assigned_to: nullish(assigneeParser),
});

export type LeadListItem = ReturnType<typeof leadListItemParser>;

const nameRef = nullish(object({ id: number, name: string }));

const leadActivityParser = object({
  id: number,
  actor: object({ id: number, name: string }),
  from_status: nullish(oneOf(LEAD_STATUSES)),
  to_status: nullish(oneOf(LEAD_STATUSES)),
  assigned_to: nullish(number),
  note: nullish(string),
  created_at: string,
});

export type LeadActivity = ReturnType<typeof leadActivityParser>;

const leadDetailParser = object({
  id: number,
  type: oneOf(LEAD_TYPES),
  status: oneOf(LEAD_STATUSES),
  name: nullish(string),
  phone: nullish(string),
  created_at: string,
  waiting_days: nullish(number),
  assigned_to: nullish(assigneeParser),
  email: nullish(string),
  neighborhood: nullish(string),
  wants_visit: nullish(boolean),
  wants_cell_group: nullish(boolean),
  group: nameRef,
  from_other_baptist_church: nullish(boolean),
  ministry: nameRef,
  message: nullish(string),
  consent_at: string,
  consent_version: string,
  whatsapp_url: nullish(string),
  activities: array(leadActivityParser),
});

export type LeadDetail = ReturnType<typeof leadDetailParser>;

const listEnvelope = schema(
  object({
    data: array(leadListItemParser),
    meta: object({ page: number, per_page: number, total: number, last_page: number }),
  }),
);
const detailEnvelope = schema(object({ data: leadDetailParser }));
const assigneesEnvelope = schema(object({ data: array(object({ id: number, name: string })) }));

export type Inbox = "geral" | "oracao";

/** Os filtros da caixa, como ficam na URL (Frontend: filtros na URL). Texto vazio = sem filtro. */
export interface InboxFilters {
  type: string;
  status: string;
  assignee: string;
  q: string;
  page: number;
}

/** O padrão da tela: contatos abertos (novo e em atendimento). */
export const DEFAULT_STATUS_FILTER = "ABERTOS";

export function inboxQuery(inbox: Inbox, filters: InboxFilters) {
  return queryOptions({
    queryKey: ["admin", "leads", "list", inbox, filters] as const,
    queryFn: async ({ signal }) =>
      listEnvelope.parse(
        await api.get<unknown>("/api/admin/leads", {
          query: {
            inbox,
            type: filters.type || undefined,
            status: filters.status || undefined,
            assigned_to: filters.assignee || undefined,
            q: filters.q || undefined,
            page: filters.page > 1 ? filters.page : undefined,
          },
          signal,
        }),
      ),
    staleTime: STALE_TIME.admin,
    placeholderData: (previous) => previous,
  });
}

export function leadQuery(id: number) {
  return queryOptions({
    queryKey: ["admin", "leads", "detail", id] as const,
    queryFn: async ({ signal }) =>
      detailEnvelope.parse(await api.get<unknown>(`/api/admin/leads/${id}`, { signal })).data,
    staleTime: STALE_TIME.admin,
    retry: false,
  });
}

export function assigneesQuery(type: LeadType) {
  return queryOptions({
    queryKey: ["admin", "leads", "assignees", type] as const,
    queryFn: async ({ signal }) =>
      assigneesEnvelope.parse(
        await api.get<unknown>("/api/admin/leads/assignees", { query: { type }, signal }),
      ).data,
    staleTime: STALE_TIME.admin,
  });
}

/** `PATCH /api/admin/leads/{id}`: status, responsável e anotação (todos opcionais, pelo menos um). */
export interface LeadPatch {
  status?: LeadStatus;
  assigned_to?: number | null;
  note?: string;
}

export async function patchLead(id: number, patch: LeadPatch): Promise<LeadDetail> {
  return detailEnvelope.parse(await api.patch<unknown>(`/api/admin/leads/${id}`, patch)).data;
}

/** `DELETE /api/admin/leads/{id}`: exclusão definitiva a pedido do titular (BR-081). */
export async function eraseLead(id: number): Promise<void> {
  await api.delete<unknown>(`/api/admin/leads/${id}`, {}, { reason: "TITULAR_REQUEST" });
}
