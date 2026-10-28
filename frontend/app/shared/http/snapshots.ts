/**
 * Leitor dos snapshots públicos (ADR-014; contracts/snapshots.md; FR-011).
 *
 * Ordem de leitura:
 *   1. `/data/<nome>.json`, servido pelo Apache sem PHP: sempre o dado atual;
 *   2. a API, quando o arquivo falta ou veio inválido (o PHP regenera o arquivo, mas o servidor pode ter falhado);
 *   3. o snapshot gravado no build (`app/content/snapshots/<nome>.json`), com `stale: true`: quem mostra o dado
 *      precisa exibir `messages.common.stale` ("Algumas informações podem estar desatualizadas.").
 *
 * Se nada responder, o erro da API sobe e a tela mostra o `ErrorState`. O cancelamento (AbortError) nunca cai para o
 * próximo passo: quem cancelou não quer mais o dado.
 */

import { messages } from "~/shared/messages";
import { api, buildUrl } from "./client";
import { ApiError, GENERIC_ERROR_CODE, isApiError } from "./errors";

export type SnapshotName = "settings" | "ministries" | "home";
export type SnapshotSource = "static" | "api" | "build";

export interface SnapshotResult<T> {
  data: T;
  /** Quando o backend gravou o dado (ISO 8601, UTC). `null` se a fonte não informa (API). */
  generatedAt: string | null;
  source: SnapshotSource;
  /** `true` só quando veio do snapshot do build: mostrar o aviso de dado possivelmente desatualizado. */
  stale: boolean;
}

/** O que valida e tipa o dado: qualquer esquema do Zod serve (`z.object({...})`). */
export interface SnapshotSchema<T> {
  parse(value: unknown): T;
}

export interface ReadSnapshotOptions<T> {
  schema: SnapshotSchema<T>;
  signal?: AbortSignal;
  /**
   * Busca o mesmo dado na API e devolve o conteúdo de `data`. Sem isso, usa a rota pública equivalente de `settings` e
   * `ministries`. O `home` não tem rota própria (é composto de boletins, mensagens e eventos): quem lê informa.
   */
  fromApi?: (signal?: AbortSignal) => Promise<unknown>;
  /** Substitui o snapshot do build; existe para os testes. */
  loadBuildSnapshot?: (name: SnapshotName) => Promise<unknown>;
}

const API_PATHS: Partial<Record<SnapshotName, string>> = {
  settings: "/api/public/settings",
  ministries: "/api/public/ministries",
};

interface SnapshotFile {
  data: unknown;
  generatedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `{ data, generated_at }`, o formato que o backend grava (e que a API também devolve, sem `generated_at`). */
function toSnapshotFile(value: unknown): SnapshotFile | null {
  if (
    !isRecord(value) ||
    !("data" in value) ||
    value["data"] === undefined ||
    value["data"] === null
  ) {
    return null;
  }
  const generatedAt = value["generated_at"];
  return { data: value["data"], generatedAt: typeof generatedAt === "string" ? generatedAt : null };
}

function isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
  // O AbortError pode vir de outro "realm" (jsdom): confere pelo nome, não por instanceof
  return signal?.aborted === true || (isRecord(error) && error["name"] === "AbortError");
}

async function readStatic(
  name: SnapshotName,
  signal: AbortSignal | undefined,
): Promise<SnapshotFile | null> {
  const response = await fetch(buildUrl(`/data/${name}.json`), {
    headers: { Accept: "application/json" },
    // O arquivo muda sem aviso; `no-cache` revalida com o ETag (304 barato) em vez de servir uma cópia velha
    cache: "no-cache",
    signal,
  });
  if (!response.ok) return null;

  try {
    return toSnapshotFile(await response.json());
  } catch {
    // No servidor de desenvolvimento, o arquivo que falta devolve o index.html com 200
    return null;
  }
}

async function readApi<T>(
  name: SnapshotName,
  options: ReadSnapshotOptions<T>,
): Promise<SnapshotFile | null> {
  if (options.fromApi) {
    return { data: await options.fromApi(options.signal), generatedAt: null };
  }

  const path = API_PATHS[name];
  if (path === undefined) return null;

  return toSnapshotFile(await api.get<unknown>(path, { signal: options.signal }));
}

// Carga sob demanda: o JSON do build não entra no bundle inicial, só é baixado quando as duas fontes falham
const buildFiles = import.meta.glob<unknown>("../../content/snapshots/*.json", {
  import: "default",
});

type BuildSnapshotLoader = (name: SnapshotName) => Promise<unknown>;

async function defaultBuildSnapshot(name: SnapshotName): Promise<unknown> {
  const loader = buildFiles[`../../content/snapshots/${name}.json`];
  return loader ? loader() : null;
}

let buildSnapshotLoader: BuildSnapshotLoader = defaultBuildSnapshot;

/**
 * Troca quem entrega o snapshot do build (`null` volta ao padrão). Existe para os testes não dependerem de o build ter
 * gravado arquivos em `app/content/snapshots/` (`BUILD_SNAPSHOTS_FROM`).
 */
export function setBuildSnapshotLoader(loader: BuildSnapshotLoader | null): void {
  buildSnapshotLoader = loader ?? defaultBuildSnapshot;
}

export async function readSnapshot<T>(
  name: SnapshotName,
  options: ReadSnapshotOptions<T>,
): Promise<SnapshotResult<T>> {
  const { schema, signal } = options;
  let apiError: unknown = null;

  // 1. Arquivo estático
  try {
    const file = await readStatic(name, signal);
    if (file) {
      return {
        data: schema.parse(file.data),
        generatedAt: file.generatedAt,
        source: "static",
        stale: false,
      };
    }
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    // Rede, JSON fora do contrato ou dado que não passa no esquema: tenta a API
  }

  // 2. API
  try {
    const file = await readApi(name, options);
    if (file) {
      return {
        data: schema.parse(file.data),
        generatedAt: file.generatedAt,
        source: "api",
        stale: false,
      };
    }
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    apiError = error;
  }

  // 3. Snapshot gravado no build
  try {
    const file = toSnapshotFile(await (options.loadBuildSnapshot ?? buildSnapshotLoader)(name));
    if (file) {
      return {
        data: schema.parse(file.data),
        generatedAt: file.generatedAt,
        source: "build",
        stale: true,
      };
    }
  } catch {
    // Sem snapshot de build utilizável: vale o erro da API
  }

  throw isApiError(apiError)
    ? apiError
    : new ApiError({ status: 0, code: GENERIC_ERROR_CODE, message: messages.errors.generic });
}
