import { RequirePermission } from "~/features/access/guards";
import { InboxList } from "~/features/leads/components/inbox-list";

/** Caixa geral de contatos (design: AdminContatos). Nunca traz pedido de oração (BR-007). */
export default function AdminContatos() {
  return (
    <RequirePermission permission="leads.read">
      <InboxList inbox="geral" />
    </RequirePermission>
  );
}
