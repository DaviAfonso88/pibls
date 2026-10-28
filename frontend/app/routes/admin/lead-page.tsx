import { useParams } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { RequirePermission } from "~/features/access/guards";
import { LeadDetail } from "~/features/leads/components/lead-detail";
import type { Inbox } from "~/features/leads/admin-api";
import AdminNotFound from "./not-found";

/**
 * O contato aberto na caixa geral ou na de oração (CAP-10, CAP-11). A permissão de leitura é da caixa; a de atender
 * (`leads.manage` ou `leads.oracao.manage`) só libera os botões. A API decide de verdade (BR-007, BR-076).
 */
export function LeadPage({ inbox }: { inbox: Inbox }) {
  const { id } = useParams();
  const { user, can } = useAuth();
  const leadId = Number(id);

  if (!Number.isInteger(leadId) || leadId < 1 || user === null) return <AdminNotFound />;

  return (
    <RequirePermission permission={inbox === "oracao" ? "leads.oracao.read" : "leads.read"}>
      <LeadDetail
        id={leadId}
        inbox={inbox}
        canManage={can(inbox === "oracao" ? "leads.oracao.manage" : "leads.manage")}
        currentUser={{ id: user.id, name: user.name }}
      />
    </RequirePermission>
  );
}
