/**
 * Cliente HTTP da API (API Standards; ADR-008). Mesma origem, sessão por cookie (Sanctum SPA).
 *
 * - Antes da primeira escrita, `GET /sanctum/csrf-cookie`; toda escrita leva `X-XSRF-TOKEN`.
 * - Toda chamada leva um `X-Request-Id` (ULID): o servidor o devolve em `error.traceId` e o grava no log.
 * - Um 419 (CSRF expirado) renova o cookie e repete a escrita UMA vez.
 * - Erros viram `ApiError`, com o envelope da API mapeado (código, mensagem, erros por campo, traceId).
 * - Um 401 chama o tratamento global registrado (o painel limpa a sessão e volta ao login).
 */

import { messages } from "~/shared/messages";
import {
  ApiError,
  GENERIC_ERROR_CODE,
  NETWORK_ERROR_CODE,
  isErrorEnvelope,
  messageForStatus,
} from "./errors";
import { ulid } from "./ulid";

type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue | readonly (string | number)[]>;

export interface RequestOptions {
  query?: Query;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export type WriteBody = object | FormData | null | undefined;

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_PATH = "/sanctum/csrf-cookie";
const XSRF_COOKIE = "XSRF-TOKEN";

let csrfReady: Promise<void> | null = null;
let unauthorizedHandler: ((error: ApiError) => void) | null = null;

/** O painel registra aqui o que fazer num 401 (limpar o `AuthContext` e ir ao login). */
export function setUnauthorizedHandler(handler: ((error: ApiError) => void) | null): void {
  unauthorizedHandler = handler;
}

/** Esquece o cookie CSRF: a próxima escrita pede um novo. Chamado no login, no logout e no 419. */
export function resetCsrf(): void {
  csrfReady = null;
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split("; ")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator) === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1));
      } catch {
        return part.slice(separator + 1);
      }
    }
  }
  return null;
}

/** Endereço absoluto na origem da página (o `fetch` do Node e do jsdom não aceita caminho relativo). */
export function buildUrl(path: string, query?: Query): string {
  const origin = globalThis.location?.origin ?? "http://localhost";
  const url = new URL(path, origin);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(`${key}[]`, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (header === null) return null;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

async function toApiError(response: Response): Promise<ApiError> {
  const headerTraceId = response.headers.get("X-Request-Id") ?? "";
  const retryAfterSeconds = parseRetryAfter(response);

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Corpo vazio ou HTML (ex.: página de erro do Apache): cai na mensagem padrão do status
  }

  if (isErrorEnvelope(body)) {
    const { code, message, details, traceId } = body.error;
    return new ApiError({
      status: response.status,
      code,
      message,
      details: Array.isArray(details) ? details : [],
      traceId: traceId || headerTraceId,
      retryAfterSeconds,
    });
  }

  return new ApiError({
    status: response.status,
    code: GENERIC_ERROR_CODE,
    message: messageForStatus(response.status, headerTraceId),
    traceId: headerTraceId,
    retryAfterSeconds,
  });
}

/** Faz a chamada de rede. Falha de rede vira `ApiError`; cancelamento (AbortError) passa como está. */
async function send(
  method: string,
  path: string,
  body: WriteBody,
  options: RequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-Id": ulid(),
    ...options.headers,
  };

  if (WRITE_METHODS.has(method)) {
    const token = readCookie(XSRF_COOKIE);
    if (token !== null) headers["X-XSRF-TOKEN"] = token;
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // o navegador define o Content-Type com o boundary
  } else if (body !== null && body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  try {
    return await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: payload,
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (error) {
    // O AbortError do fetch pode vir de outro "realm" (jsdom, iframes): confere pelo nome, não por instanceof
    if (options.signal?.aborted || (error as { name?: unknown } | null)?.name === "AbortError")
      throw error;
    throw new ApiError({
      status: 0,
      code: NETWORK_ERROR_CODE,
      message: messages.errors.network,
    });
  }
}

async function ensureCsrf(): Promise<void> {
  csrfReady ??= (async () => {
    const response = await send("GET", CSRF_PATH, undefined, {});
    if (!response.ok) throw await toApiError(response);
  })().catch((error: unknown) => {
    csrfReady = null; // não guarda o fracasso: a próxima escrita tenta de novo
    throw error;
  });

  return csrfReady;
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (text === "") return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError({
      status: response.status,
      code: GENERIC_ERROR_CODE,
      message: messages.errors.generic,
      traceId: response.headers.get("X-Request-Id") ?? "",
    });
  }
}

export type Transport = (
  method: string,
  path: string,
  body: WriteBody,
  options: RequestOptions,
) => Promise<Response>;

/** Chamada com CSRF, repetição do 419 e erros padronizados. `transport` troca só o envio (o upload usa XMLHttpRequest). */
export async function request<T>(
  method: string,
  path: string,
  body: WriteBody,
  options: RequestOptions,
  transport: Transport = send,
): Promise<T> {
  const isWrite = WRITE_METHODS.has(method);
  if (isWrite) await ensureCsrf();

  let response = await transport(method, path, body, options);

  // CSRF expirado: renova o cookie e repete a escrita uma única vez
  if (response.status === 419 && isWrite) {
    resetCsrf();
    await ensureCsrf();
    response = await transport(method, path, body, options);
  }

  if (response.ok) return parseSuccess<T>(response);

  const error = await toApiError(response);
  if (error.isUnauthenticated) unauthorizedHandler?.(error);
  throw error;
}

export const api = {
  get: <T>(path: string, options: RequestOptions = {}): Promise<T> =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: WriteBody, options: RequestOptions = {}): Promise<T> =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: WriteBody, options: RequestOptions = {}): Promise<T> =>
    request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: WriteBody, options: RequestOptions = {}): Promise<T> =>
    request<T>("PATCH", path, body, options),
  /** O corpo é opcional: a exclusão a pedido do titular manda o motivo (`{reason}`, BR-081). */
  delete: <T>(path: string, options: RequestOptions = {}, body?: WriteBody): Promise<T> =>
    request<T>("DELETE", path, body, options),
};
