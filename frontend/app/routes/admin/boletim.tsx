import { useParams } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { RequirePermission } from "~/features/access/guards";
import { BulletinForm } from "~/features/content/components/admin/bulletin-form";
import AdminNotFound from "./not-found";

/**
 * Cadastro (`/admin/boletins/novo`) e edição (`/admin/boletins/:id`) de boletim (design: AdminBoletim; CAP-02). O `key`
 * troca o formulário inteiro ao mudar de boletim, para o estado de um não vazar para o outro.
 */
export default function AdminBoletim() {
  const { id } = useParams();
  const { user } = useAuth();

  const editing = id !== undefined;
  const bulletinId = editing ? Number(id) : null;
  if (user === null || (editing && (!Number.isInteger(bulletinId) || (bulletinId ?? 0) < 1))) {
    return <AdminNotFound />;
  }

  return (
    <RequirePermission permission="boletins.write">
      <BulletinForm key={bulletinId ?? "novo"} id={bulletinId} userId={user.id} />
    </RequirePermission>
  );
}
