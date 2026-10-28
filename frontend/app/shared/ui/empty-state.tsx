import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";
import { messages } from "~/shared/messages";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "./empty";

export interface EmptyStateProps {
  /** Frase do que falta, ex.: "Nenhum boletim publicado ainda." */
  title?: string;
  description?: ReactNode;
  /** Ação possível (link ou botão), ex.: "Criar o primeiro boletim". */
  action?: ReactNode;
  icon?: ReactNode;
  /** Nível do título; a tela decide para manter a hierarquia. */
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
}

/** Lista ou seção sem itens (Frontend → Estados de tela: "Vazio"). */
export function EmptyState({
  title = messages.states.emptyList,
  description,
  action,
  icon,
  headingLevel: Heading = "h2",
  className,
}: EmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon" aria-hidden="true">
          {icon ?? <InboxIcon />}
        </EmptyMedia>
        <Heading className="font-heading text-lg font-extrabold text-balance">{title}</Heading>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
