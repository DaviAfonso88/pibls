import { AuthShell } from "~/features/access/components/auth-shell";
import { ResetPasswordForm } from "~/features/access/components/reset-password-form";

/** Definir a nova senha com o link do e-mail (BR-072, BR-073). O token chega no fragmento da URL. */
export default function AdminRedefinirSenha() {
  return (
    <AuthShell>
      <title>Nova senha — Painel PIBLS</title>
      <ResetPasswordForm />
    </AuthShell>
  );
}
