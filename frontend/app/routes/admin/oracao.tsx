import { RequirePermission } from "~/features/access/guards";
import { InboxList } from "~/features/leads/components/inbox-list";

/** Caixa de pedidos de oração: permissão e rota próprias (BR-007). */
export default function AdminOracao() {
  return (
    <RequirePermission permission="leads.oracao.read">
      <InboxList inbox="oracao" />
    </RequirePermission>
  );
}
