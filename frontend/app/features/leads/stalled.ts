import { queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { toDateInput } from "~/shared/format";
import { array, nullish, number, object, oneOf, schema, string } from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";

/** Dias parado a partir dos quais um contato novo aparece em destaque (BR-010). */
export const STALLED_AFTER_DAYS = 3;

const stalledLeadParser = object({
  id: number,
  type: oneOf(["VISITANTE", "MEMBRO", "CONTATO", "MINISTERIO"]),
  name: nullish(string),
  // Nulo nos contatos do dia-limite que ainda não passaram de 3 dias completos (o filtro `to` é por data, a BR-010 é por hora)
  waiting_days: nullish(number),
  assigned_to: nullish(object({ id: number, name: string })),
});

type ListedLead = ReturnType<typeof stalledLeadParser>;

/** Um contato esperando há mais de 3 dias, já com o número de dias (BR-010). */
export type StalledLead = ListedLead & { waiting_days: number };

function isStalled(lead: ListedLead): lead is StalledLead {
  return typeof lead.waiting_days === "number";
}

const stalledEnvelope = schema(object({ data: array(stalledLeadParser) }));

export const LEAD_TYPE_LABELS: Record<StalledLead["type"], string> = {
  VISITANTE: "Sou visitante",
  MEMBRO: "Quero ser membro",
  CONTATO: "Fale conosco",
  MINISTERIO: "Fale com um ministério",
};

/**
 * Os contatos novos (`status=NOVO`) da caixa geral esperando há mais de 3 dias (BR-010), os mais antigos primeiro:
 * `GET /api/admin/leads?inbox=geral&status=NOVO&to=<hoje − 3 dias>`. A tela de contatos chega na fase seguinte; até lá a
 * API responde 404 e o início do painel esconde o bloco.
 */
export function stalledLeadsQuery(now: Date = new Date()) {
  const to = toDateInput(new Date(now.getTime() - STALLED_AFTER_DAYS * 24 * 60 * 60 * 1000));

  return queryOptions({
    queryKey: ["admin", "leads", "stalled", to] as const,
    queryFn: async ({ signal }) =>
      stalledEnvelope
        .parse(
          await api.get<unknown>("/api/admin/leads", {
            query: {
              inbox: "geral",
              status: "NOVO",
              to,
              sort: "created_at",
              per_page: 5,
            },
            signal,
          }),
        )
        .data.filter(isStalled),
    staleTime: STALE_TIME.admin,
  });
}
