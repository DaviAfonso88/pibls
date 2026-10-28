import { TriangleAlertIcon } from "lucide-react";
import { messages } from "~/shared/messages";
import { buttonClassName } from "./button-variants";
import { Alert } from "./alert";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "./empty";
import { Spinner } from "./spinner";

export interface ErrorStateProps {
  title?: string;
  /** Mensagem amigável: a do `ApiError` ou de `messages.errors`. */
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Só nas páginas públicas: link do WhatsApp da igreja para quem não consegue prosseguir. */
  whatsappUrl?: string | null;
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
}

/**
 * Falha ao carregar (Frontend → Estados de tela: "Erro"): a mensagem, "Tentar novamente" e, no site público, o
 * caminho alternativo pelo WhatsApp. Anunciado como alerta para leitores de tela.
 */
// O botão é um <button> com as classes do Button: o Button do Base UI pesa no JS inicial das páginas públicas (orçamento).
export function ErrorState({
  title = messages.states.errorTitle,
  message,
  onRetry,
  retrying = false,
  whatsappUrl,
  headingLevel: Heading = "h2",
  className,
}: ErrorStateProps) {
  return (
    <Empty className={className} role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon" aria-hidden="true">
          <TriangleAlertIcon />
        </EmptyMedia>
        <Heading className="font-heading text-lg font-extrabold text-balance">{title}</Heading>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {onRetry || whatsappUrl ? (
        <EmptyContent className="flex-row flex-wrap justify-center">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className={buttonClassName({})}
            >
              {retrying ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {retrying ? messages.common.loading : messages.common.retry}
            </button>
          ) : null}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({ variant: "whatsapp" })}
            >
              {messages.common.whatsapp}{" "}
              <span className="sr-only">{messages.forms.opensInNewTab}</span>
            </a>
          ) : null}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

/**
 * Aviso de que o conteúdo veio do snapshot gravado no build (FR-011). Fica acima do conteúdo, não no lugar dele.
 */
export function StaleNotice({ className }: { className?: string }) {
  return (
    <Alert variant="warning" role="status" className={className}>
      <TriangleAlertIcon aria-hidden="true" />
      <p>{messages.common.stale}</p>
    </Alert>
  );
}
