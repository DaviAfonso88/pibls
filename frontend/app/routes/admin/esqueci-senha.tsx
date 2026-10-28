import { AuthShell } from "~/features/access/components/auth-shell";
import { ForgotPasswordForm } from "~/features/access/components/forgot-password-form";

/** Pedir o link de nova senha (RF-D06). A resposta é a mesma para qualquer e-mail. */
export default function AdminEsqueciSenha() {
  return (
    <AuthShell>
      <title>Criar nova senha — Painel PIBLS</title>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
