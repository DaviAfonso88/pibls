import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { resetCsrf, setUnauthorizedHandler } from "~/shared/http/client";
import { clearUserDrafts } from "~/shared/lib/draft-keys";
import { ME_QUERY_KEY, login, logout, meQuery, type AuthUser } from "./api";
import type { PermissionRequirement } from "./permissions";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Erro ao perguntar quem está logado (rede, 5xx). Não é o caso "sem sessão", que é `unauthenticated`. */
  error: Error | null;
  refetch: () => void;
  /** Uma chave ou uma lista (qualquer uma libera). Só para a interface: quem autoriza é o servidor (BR-076). */
  can: (permission: PermissionRequirement) => boolean;
  /** A sessão acabou no meio do uso (401 numa chamada do painel): o login mostra "Sua sessão expirou". */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Tudo do painel que não deve sobreviver à troca de usuário: o cache de `/api/admin/*`, mas não o dos snapshots públicos. */
function isPanelQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === "admin" || queryKey[0] === "auth";
}

/**
 * Contexto de autenticação do painel (Frontend → Stores / contextos): o usuário atual e as permissões, `can()`, login e
 * logout. Um 401 em qualquer chamada do painel limpa a sessão daqui (o `RequireAuth` então manda para o login com
 * "Sua sessão expirou. Entre novamente."). Mora só em `/admin`: o site público não precisa dele.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery(meQuery);
  const [sessionExpired, setSessionExpired] = useState(false);
  const hadUser = useRef(false);

  const user = me.data ?? null;
  hadUser.current = user !== null;

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (hadUser.current) setSessionExpired(true);
      queryClient.setQueryData(ME_QUERY_KEY, null);
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const signedIn = await login(email, password);
      // O servidor trocou o id da sessão: o cookie CSRF antigo não vale mais
      resetCsrf();
      queryClient.removeQueries({ predicate: (query) => isPanelQuery(query.queryKey) });
      queryClient.setQueryData(ME_QUERY_KEY, signedIn);
      setSessionExpired(false);
      return signedIn;
    },
    [queryClient],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const leavingUserId = queryClient.getQueryData<AuthUser | null>(ME_QUERY_KEY)?.id;

    try {
      await logout();
    } finally {
      // Logout explícito apaga os rascunhos de conteúdo deste usuário (FR-077); sessão expirada não, para oferecê-los de volta
      if (leavingUserId !== undefined) clearUserDrafts(leavingUserId);
      resetCsrf();
      queryClient.removeQueries({ predicate: (query) => isPanelQuery(query.queryKey) });
      queryClient.setQueryData(ME_QUERY_KEY, null);
      setSessionExpired(false);
      void navigate("/admin/entrar", { replace: true });
    }
  }, [queryClient, navigate]);

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user]);

  const can = useCallback(
    (requirement: PermissionRequirement): boolean =>
      (Array.isArray(requirement) ? requirement : [requirement]).some((key: string) =>
        permissions.has(key),
      ),
    [permissions],
  );

  const refetch = useCallback(() => void me.refetch(), [me]);

  const value = useMemo<AuthValue>(
    () => ({
      status: me.isPending ? "loading" : user === null ? "unauthenticated" : "authenticated",
      user,
      error: me.isError ? me.error : null,
      refetch,
      can,
      sessionExpired,
      signIn,
      signOut,
    }),
    [me.isPending, me.isError, me.error, user, refetch, can, sessionExpired, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth precisa estar dentro do AuthProvider do painel.");
  return value;
}

/** A rota de depois do login: só caminhos do próprio painel (nunca um endereço de fora, contra *open redirect*). */
export function safeReturnPath(value: string | null): string {
  if (
    value === null ||
    !value.startsWith("/admin") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/admin";
  }
  if (value.startsWith("/admin/entrar")) return "/admin";
  return value;
}
