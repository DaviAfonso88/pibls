import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "~/shared/http/errors";

/** Quanto tempo cada tipo de dado vale antes de revalidar (Frontend → Regras de cache). */
export const STALE_TIME = {
  /** Configurações, ministérios e destaques da página inicial (snapshots). */
  snapshot: 60_000,
  /** Listas públicas: boletins, mensagens, eventos. */
  list: 60_000,
  /** Detalhe de evento (vagas): sempre busca de novo ao montar. */
  detail: 0,
  /** `auth/me`. */
  me: 300_000,
  /** Listas e detalhes do painel. */
  admin: 0,
} as const;

const MAX_RETRIES = 2;

/**
 * Só vale tentar de novo o que pode dar certo na segunda vez: falha de rede e erro 5xx. Um 4xx (404, 403, 422, 429)
 * responde igual da próxima vez, e repetir um 429 só piora o bloqueio.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return isApiError(error) && (error.isNetwork || error.status >= 500);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME.list,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      // Todas as mutações aguardam o servidor; nada de atualização otimista nem de reenvio automático (evita duplicar)
      mutations: { retry: false },
    },
  });
}

/**
 * Um cliente para a aplicação inteira. É uma SPA (`ssr: false`): não há requisições de usuários diferentes
 * compartilhando o cache. O build pré-renderiza as páginas, mas nenhuma consulta roda nesse momento.
 */
export const queryClient = createQueryClient();
