import { buildUrl, request, type RequestOptions } from "./client";
import { ApiError, NETWORK_ERROR_CODE } from "./errors";
import { messages } from "~/shared/messages";
import { ulid } from "./ulid";

/** Um arquivo baixado da API, com o nome que o servidor sugeriu em `Content-Disposition` (se sugeriu). */
export interface DownloadedFile {
  blob: Blob;
  filename: string | null;
}

function filenameOf(header: string | null): string | null {
  const match = header === null ? null : /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? null;
}

/**
 * Baixa um arquivo da API (CSV de inscritos) com a sessão do painel. Vai por `request` para que um 401 derrube a sessão
 * e um erro (403, 404, 429 do limite de exportação) chegue como `ApiError` com a mensagem do servidor, em vez de o
 * navegador salvar o JSON do erro como se fosse o arquivo.
 */
export async function downloadFile(
  path: string,
  options: RequestOptions = {},
): Promise<DownloadedFile> {
  // Objeto, e não `let`: quem preenche é o transporte, depois do `await`, e o TypeScript não vê isso numa variável
  const received: { file: DownloadedFile | null } = { file: null };

  await request<undefined>(
    "GET",
    path,
    undefined,
    options,
    async (_method, target, _body, opts) => {
      let response: Response;
      try {
        response = await fetch(buildUrl(target, opts.query), {
          method: "GET",
          headers: { Accept: "text/csv, application/json", "X-Request-Id": ulid() },
          signal: opts.signal,
          credentials: "same-origin",
        });
      } catch (error) {
        if (opts.signal?.aborted || (error as { name?: unknown } | null)?.name === "AbortError")
          throw error;
        throw new ApiError({
          status: 0,
          code: NETWORK_ERROR_CODE,
          message: messages.errors.network,
        });
      }

      if (!response.ok) return response;

      received.file = {
        blob: await response.blob(),
        filename: filenameOf(response.headers.get("Content-Disposition")),
      };
      // O `request` só espera o status de sucesso; o arquivo já foi guardado acima
      return new Response(null, { status: 204 });
    },
  );

  if (received.file === null) throw new Error("Download sem arquivo.");
  return received.file;
}

/** Entrega o arquivo ao navegador como download (link temporário, liberado em seguida). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Dá ao navegador o instante de iniciar o download antes de soltar o endereço
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
