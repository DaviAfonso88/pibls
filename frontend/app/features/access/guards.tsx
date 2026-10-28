import { LockIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Spinner } from "~/shared/ui/spinner";
import { ErrorState } from "~/shared/ui/error-state";
import { buttonClassName } from "~/shared/ui/button-variants";
import { messages } from "~/shared/messages";
import { useAuth } from "./auth-context";
import { accessMessages } from "./messages";
import type { PermissionRequirement } from "./permissions";

/** `/admin/entrar?voltar=<rota>`: depois do login, a pessoa volta ao que pediu (Frontend → Route guards). */
export function loginPath(returnTo: string, options: { expired?: boolean } = {}): string {
  const query = new URLSearchParams({ voltar: returnTo });
  if (options.expired) query.set("motivo", "expirou");
  return `/admin/entrar?${query.toString()}`;
}

/**
 * Guard de sessão: sem login vai para `/admin/entrar?voltar=<rota>`. Enquanto pergunta ao servidor, mostra um indicador;
 * se a pergunta falhar (rede, 5xx), oferece "Tentar novamente" em vez de jogar a pessoa no login sem motivo.
 * Guard só de experiência: o servidor revalida tudo (BR-076).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center" role="status">
        <Spinner aria-hidden="true" className="size-8 text-primary" />
        <span className="sr-only">{accessMessages.checkingSession}</span>
      </div>
    );
  }

  if (auth.error !== null) {
    return (
      <div className="container py-16">
        <ErrorState message={messages.errors.generic} onRetry={auth.refetch} />
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <Navigate
        replace
        to={loginPath(`${location.pathname}${location.search}`, { expired: auth.sessionExpired })}
      />
    );
  }

  return <>{children}</>;
}

/** O que a pessoa vê ao abrir, pelo endereço, uma área que o perfil dela não inclui. */
export function AccessDenied() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-12" role="alert">
      <title>Sem acesso — Painel PIBLS</title>
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
      >
        <LockIcon className="size-6" />
      </span>
      <h1 className="m-0 text-2xl font-extrabold text-balance">{accessMessages.denied.title}</h1>
      <p className="m-0 text-muted-foreground">{accessMessages.denied.text}</p>
      <Link to="/admin" className={buttonClassName({ size: "lg", className: "px-5 font-bold" })}>
        {accessMessages.denied.back}
      </Link>
    </div>
  );
}

/**
 * Guard de permissão de uma tela: sem a permissão, "Você não tem acesso a esta área" com o caminho de volta. Aceita uma
 * chave ou uma lista (qualquer uma libera). É só experiência: a API responde 403 de qualquer jeito (BR-076).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionRequirement;
  children: ReactNode;
}) {
  const { can } = useAuth();

  return can(permission) ? <>{children}</> : <AccessDenied />;
}

/** Mostra o conteúdo só a quem tem a permissão (botões e blocos); sem ela, nada (ou o `fallback`). */
export function PermissionGate({
  permission,
  fallback = null,
  children,
}: {
  permission: PermissionRequirement;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = useAuth();

  return <>{can(permission) ? children : fallback}</>;
}
