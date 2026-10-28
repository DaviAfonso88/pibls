import { RequirePermission } from "~/features/access/guards";
import { PostAdminList } from "~/features/content/components/admin/post-admin-list";

/** Lista de mensagens da Palavra Viva no painel (design: AdminPalavraViva; CAP-03). */
export default function AdminPalavraViva() {
  return (
    <RequirePermission permission="mensagens.write">
      <PostAdminList />
    </RequirePermission>
  );
}
