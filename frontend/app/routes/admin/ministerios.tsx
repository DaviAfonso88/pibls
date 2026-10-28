import { RequirePermission } from "~/features/access/guards";
import { MinistriesAdmin } from "~/features/ministries/components/admin/ministries-admin";

/**
 * Ministérios, grupos e células (design: AdminMinisterios; CAP-16). Serve `/admin/ministerios`, `/novo` e `/:id`: a lista
 * e o formulário ficam na mesma tela. Só `ministerios.write`; a API recusa de qualquer jeito (BR-076).
 */
export default function AdminMinisterios() {
  return (
    <RequirePermission permission="ministerios.write">
      <MinistriesAdmin />
    </RequirePermission>
  );
}
