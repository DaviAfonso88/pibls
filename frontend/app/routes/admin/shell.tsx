import { Outlet } from "react-router";
import { AuthProvider } from "~/features/access/auth-context";
import { Toaster } from "~/shared/ui/sonner";
import { TooltipProvider } from "~/shared/ui/tooltip";

/**
 * Raiz de tudo que fica sob `/admin`: o contexto de autenticação, a dica de ferramenta e o toast (que o site público não
 * usa, por isso ficam aqui e não no `root.tsx`; orçamento de bundle). O painel não é indexado: o `<meta>` é elevado ao
 * `<head>` pelo React 19.
 */
export default function AdminShell() {
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <AuthProvider>
        <TooltipProvider>
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </>
  );
}
