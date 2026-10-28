import { Navigate, useSearchParams } from "react-router";
import { safeReturnPath, useAuth } from "~/features/access/auth-context";
import { AuthHeading, AuthShell } from "~/features/access/components/auth-shell";
import { LoginForm } from "~/features/access/components/login-form";
import { accessMessages } from "~/features/access/messages";

/** Login (design: AdminEntrar). Quem já tem sessão vai direto para o painel (ou para a rota pedida em `voltar`). */
export default function AdminEntrar() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const returnTo = params.get("voltar");

  if (auth.status === "authenticated") {
    return <Navigate replace to={safeReturnPath(returnTo)} />;
  }

  return (
    <AuthShell>
      <title>Entrar — Painel PIBLS</title>
      <AuthHeading title={accessMessages.login.title} intro={accessMessages.login.intro} />
      <LoginForm returnTo={returnTo} expired={params.get("motivo") === "expirou"} />
    </AuthShell>
  );
}
