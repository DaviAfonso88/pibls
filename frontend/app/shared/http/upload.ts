/**
 * Envio de arquivo com progresso (boletim com PDF). Mora à parte do `client.ts` para não entrar no JS das páginas
 * públicas (orçamento de bundle, RNF-05): só as telas de edição do painel importam este arquivo.
 *
 * O `fetch` não informa o progresso do envio, então aqui o envio é por `XMLHttpRequest`. Todo o resto (CSRF, repetição do
 * 419, envelope de erro, 401) é o mesmo das demais chamadas, porque passa por `request` do cliente.
 */
import { messages } from "~/shared/messages";
import { buildUrl, readCookie, request, type RequestOptions, type WriteBody } from "./client";
import { ApiError, NETWORK_ERROR_CODE } from "./errors";
import { ulid } from "./ulid";

/** `RequestOptions` mais o progresso do envio, de 0 a 1. */
export interface UploadOptions extends RequestOptions {
  onProgress?: (fraction: number) => void;
}

function parseResponseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return headers;
}

function sendWithProgress(onProgress: UploadOptions["onProgress"]) {
  return (
    method: string,
    path: string,
    body: WriteBody,
    options: RequestOptions,
  ): Promise<Response> =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, buildUrl(path, options.query));
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("X-Request-Id", ulid());
      const token = readCookie("XSRF-TOKEN");
      if (token !== null) xhr.setRequestHeader("X-XSRF-TOKEN", token);
      for (const [name, value] of Object.entries(options.headers ?? {})) {
        xhr.setRequestHeader(name, value);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () =>
        resolve(
          new Response(xhr.status === 204 ? null : xhr.responseText, {
            status: xhr.status,
            headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
          }),
        );
      xhr.onerror = () =>
        reject(
          new ApiError({ status: 0, code: NETWORK_ERROR_CODE, message: messages.errors.network }),
        );
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
      // Cancelar encerra a promessa na hora, sem esperar o navegador avisar que abortou
      options.signal?.addEventListener(
        "abort",
        () => {
          xhr.abort();
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );

      xhr.send(body instanceof FormData ? body : null);
    });
}

/** Envia um `FormData` (multipart) e informa o progresso do envio, de 0 a 1. */
export function uploadForm<T>(
  path: string,
  body: FormData,
  options: UploadOptions = {},
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<T> {
  return request<T>(method, path, body, options, sendWithProgress(options.onProgress));
}
