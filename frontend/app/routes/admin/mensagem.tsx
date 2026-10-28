import { useParams } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { RequirePermission } from "~/features/access/guards";
import { PostForm } from "~/features/content/components/admin/post-form";
import AdminNotFound from "./not-found";

/**
 * Cadastro (`/admin/palavra-viva/nova`) e edição (`/admin/palavra-viva/:id`) de mensagem (design: AdminPalavraViva;
 * CAP-03). O `key` troca o formulário inteiro ao mudar de mensagem.
 */
export default function AdminMensagem() {
  const { id } = useParams();
  const { user } = useAuth();

  const editing = id !== undefined;
  const postId = editing ? Number(id) : null;
  if (user === null || (editing && (!Number.isInteger(postId) || (postId ?? 0) < 1))) {
    return <AdminNotFound />;
  }

  return (
    <RequirePermission permission="mensagens.write">
      <PostForm key={postId ?? "nova"} id={postId} userId={user.id} />
    </RequirePermission>
  );
}
