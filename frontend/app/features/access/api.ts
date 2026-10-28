import { queryOptions } from "@tanstack/react-query";
import { api } from "~/shared/http/client";
import { isApiError } from "~/shared/http/errors";
import { array, boolean, nullish, number, object, schema, string } from "~/shared/http/parsers";
import { STALE_TIME } from "~/shared/lib/query-client";

const ministryRef = object({ id: number, name: string });

/** `Me` (contracts/openapi.yaml): o usuário da sessão, com papéis e permissões para montar a interface (BR-076). */
const meParser = object({
  id: number,
  name: string,
  email: string,
  ministry: nullish(ministryRef),
  roles: array(string),
  permissions: array(string),
});

export type AuthUser = ReturnType<typeof meParser>;

const meEnvelope = schema(object({ data: meParser }));

/** `UserDirectoryItem`: o `Me` mais `is_active` e o último acesso (UTC). */
const directoryUserParser = object({
  id: number,
  name: string,
  email: string,
  ministry: nullish(ministryRef),
  roles: array(string),
  permissions: array(string),
  is_active: boolean,
  last_login_at: nullish(string),
});

export type DirectoryUser = ReturnType<typeof directoryUserParser>;

const directoryEnvelope = schema(
  object({
    data: array(directoryUserParser),
    meta: object({ page: number, per_page: number, total: number, last_page: number }),
  }),
);

export const ME_QUERY_KEY = ["auth", "me"] as const;

/**
 * `GET /api/auth/me`. Sem sessão a resposta é um 401, e isso não é falha: é a resposta "ninguém entrou", então vira
 * `null`. Qualquer outro erro (rede, 5xx) continua erro, para o painel oferecer "Tentar novamente".
 */
export const meQuery = queryOptions({
  queryKey: ME_QUERY_KEY,
  queryFn: async ({ signal }): Promise<AuthUser | null> => {
    try {
      return meEnvelope.parse(await api.get<unknown>("/api/auth/me", { signal })).data;
    } catch (error) {
      if (isApiError(error) && error.isUnauthenticated) return null;
      throw error;
    }
  },
  staleTime: STALE_TIME.me,
  retry: false,
});

export async function login(email: string, password: string): Promise<AuthUser> {
  return meEnvelope.parse(await api.post<unknown>("/api/auth/login", { email, password })).data;
}

export async function logout(): Promise<void> {
  try {
    await api.post<unknown>("/api/auth/logout");
  } catch (error) {
    // Sessão que já tinha acabado: o resultado é o mesmo
    if (!(isApiError(error) && error.isUnauthenticated)) throw error;
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post<unknown>("/api/auth/forgot-password", { email });
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await api.post<unknown>("/api/auth/reset-password", input);
}

/** `GET /api/admin/users` (`users.read`): o diretório inteiro numa página (a igreja tem poucas dezenas de contas). */
export const usersQuery = queryOptions({
  queryKey: ["admin", "users"] as const,
  queryFn: async ({ signal }) =>
    directoryEnvelope.parse(
      await api.get<unknown>("/api/admin/users", {
        query: { per_page: 100, sort: "name" },
        signal,
      }),
    ),
  staleTime: STALE_TIME.admin,
});
