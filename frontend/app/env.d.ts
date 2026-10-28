// Variáveis de ambiente do build (Vite). Só o que começa com VITE_ chega ao navegador, e nunca segredo.
interface ImportMetaEnv {
  /** DSN público do Sentry do frontend. Vazio = Sentry desligado. */
  readonly VITE_SENTRY_DSN?: string;
  /** Identificador do release (o mesmo da API em `/api/health`), para agrupar os erros por versão. */
  readonly VITE_RELEASE?: string;
  /** `count.js` da medição de uso (GoatCounter). Vazio = sem medição. Só `https://…` ou caminho do próprio site. */
  readonly VITE_ANALYTICS_SRC?: string;
  /** Endereço de envio da medição, `https://<código>.goatcounter.com/count`. Vazio = sem medição. */
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
