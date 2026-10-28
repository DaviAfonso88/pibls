/**
 * O jsdom troca `AbortController` e `AbortSignal` pelos dele, e o `fetch` e o `Request` do Node (undici, por baixo do
 * MSW) só aceitam os do próprio Node: um `signal` do TanStack Query ou do React Router faria o construtor lançar
 * "Expected signal to be an instance of AbortSignal". No navegador não existe esse descompasso.
 *
 * A ponte tira o `signal` da chamada e reproduz o cancelamento por fora: ao abortar, a promessa do `fetch` rejeita com
 * um `AbortError`, igual ao navegador. O `Request` perde o `signal` (nos testes ninguém depende dele). Vai por cima do
 * `fetch` que o MSW instala, por isso é chamada depois do `listen()`.
 */

function withoutSignal(init: RequestInit | undefined): RequestInit | undefined {
  if (!init?.signal) return init;
  const rest = { ...init };
  delete rest.signal;
  return rest;
}

export function bridgeAbortSignal(): void {
  const NativeRequest = globalThis.Request;
  globalThis.Request = class BridgedRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, withoutSignal(init));
    }
  };

  const interceptedFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const signal = init?.signal;
    if (!signal) return interceptedFetch(input, init);

    const aborted = () => new DOMException("The operation was aborted.", "AbortError");
    if (signal.aborted) return Promise.reject(aborted());

    return new Promise<Response>((resolve, reject) => {
      signal.addEventListener("abort", () => reject(aborted()), { once: true });
      interceptedFetch(input, withoutSignal(init)).then(resolve, reject);
    });
  };
}
