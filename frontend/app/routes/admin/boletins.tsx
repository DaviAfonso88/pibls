import { RequirePermission } from "~/features/access/guards";
import { BulletinAdminList } from "~/features/content/components/admin/bulletin-admin-list";

/** Lista de boletins do painel (design: AdminBoletins; CAP-02). */
export default function AdminBoletins() {
  return (
    <RequirePermission permission="boletins.write">
      <BulletinAdminList />
    </RequirePermission>
  );
}
