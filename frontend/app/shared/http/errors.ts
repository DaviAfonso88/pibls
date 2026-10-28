import { messages } from "~/shared/messages";

/** Um erro de campo do envelope da API (`error.details[]`), ex.: `{field: "phone", code: "invalid_phone", message: "…"}`. */
export interface ErrorDetail {
  field: string;
  code: string;
  message: string;
}

/** Envelope de erro da API (API Standards → Formato padrão de erro). */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: ErrorDetail[];
    traceId: string;
  };
}

/** Código usado quando a resposta de erro não veio no envelope (ex.: página de erro do Apache). */
export const GENERIC_ERROR_CODE = "HTTP_ERROR";

/** Código do erro de rede: o servidor nem chegou a responder. */
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: readonly ErrorDetail[];
  readonly traceId: string;
  /** Segundos até poder tentar de novo (cabeçalho `Retry-After` do 429), se o servidor informou. */
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: readonly ErrorDetail[];
    traceId?: string;
    retryAfterSeconds?: number | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.traceId = init.traceId ?? "";
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  /** O servidor nem respondeu (sem internet, DNS, queda). */
  get isNetwork(): boolean {
    return this.code === NETWORK_ERROR_CODE;
  }

  /** 422: há erros por campo em `details`. */
  get isValidation(): boolean {
    return this.status === 422;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Mensagem do primeiro erro de cada campo, ex.: `{phone: "Informe um telefone válido com DDD."}`. */
  fieldErrors(): Record<string, string> {
    const byField: Record<string, string> = {};
    for (const detail of this.details) {
      byField[detail.field] ??= detail.message;
    }
    return byField;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** O corpo da resposta tem a forma do envelope de erro? */
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

/** Mensagem amigável para um status quando o servidor não mandou o envelope. */
export function messageForStatus(status: number, traceId: string): string {
  switch (status) {
    case 401:
      return messages.errors.sessionExpired;
    case 403:
      return messages.errors.forbidden;
    case 404:
      return messages.errors.notFound;
    case 413:
      return messages.errors.payloadTooLarge;
    case 419:
      return messages.errors.csrf;
    case 429:
      return messages.errors.tooManyRequests;
    case 503:
      return messages.errors.serviceUnavailable;
    default:
      return status >= 500 ? messages.errors.internal(traceId) : messages.errors.generic;
  }
}
