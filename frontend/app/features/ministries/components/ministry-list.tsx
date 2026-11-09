import { ChevronDownIcon, ChevronRightIcon, ClockIcon } from "lucide-react";
import { Link } from "react-router";
import { messages } from "~/shared/messages";
import { buttonClassName } from "~/shared/ui/button-variants";
import { SanitizedHtml } from "~/shared/ui/sanitized-html";
import type { Ministry } from "../api";
import { ministriesMessages as text } from "../messages";

/**
 * A liderança vem de `leaders_text`: um cargo por trecho, separados por " · " ("Coordenador: Ana e Bia · Vice: Caio"). Cada
 * trecho vira uma linha, com o cargo em destaque; sem cargo ("Dirce Rodrigues Pinheiro"), só os nomes. São parágrafos, e
 * não uma lista, para o item expansível continuar sendo o único `listitem` do catálogo.
 */
function Leadership({ text: leaders }: { text: string }) {
  const roles = leaders
    .split("·")
    .map((role) => role.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted p-4 text-[15px] text-foreground/80">
      <strong className="text-[13px] font-bold tracking-wider text-primary uppercase">
        {text.leadership}
      </strong>
      {roles.map((role) => {
        const colon = role.indexOf(":");
        return (
          <p key={role} className="m-0 break-words">
            {colon > 0 ? (
              <>
                <span className="font-semibold text-foreground">{role.slice(0, colon)}:</span>{" "}
                {role.slice(colon + 1).trim()}
              </>
            ) : (
              role
            )}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Catálogo de ministérios em cartões expansíveis (design: Ministerios, redesenhado a pedido do responsável), em duas
 * colunas no desktop. Cada cartão abre para a descrição, o horário, a liderança e o atalho "Falar com este ministério",
 * que leva ao formulário já com o ministério escolhido (FR-005). Usa `<details>`: o navegador cuida do teclado e do leitor
 * de tela, e funciona antes de o JavaScript carregar. `items-start`: abrir um cartão não estica o vizinho.
 */
export function MinistryList({ items }: { items: readonly Ministry[] }) {
  return (
    <ul className="m-0 grid list-none items-start gap-3 p-0 md:grid-cols-2">
      {items.map((ministry) => (
        <li key={ministry.id}>
          <details className="group rounded-2xl border border-border bg-background transition-[border-color,box-shadow] open:border-info-border open:shadow-lg open:shadow-primary/5">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 text-lg font-bold transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 break-words">{ministry.name}</span>
              <span
                aria-hidden="true"
                className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-foreground transition-[rotate,background-color,color] group-open:rotate-180 group-open:bg-primary group-open:text-primary-foreground motion-reduce:transition-none"
              >
                <ChevronDownIcon className="size-5" />
              </span>
            </summary>
            <div className="flex flex-col gap-3 px-5 pb-5">
              {ministry.description ? (
                <SanitizedHtml html={ministry.description} className="text-foreground/80" />
              ) : null}
              {ministry.schedule_text ? (
                <p className="m-0 flex items-start gap-2 text-[15px] text-muted-foreground">
                  <ClockIcon
                    aria-hidden="true"
                    className="mt-0.5 size-[18px] flex-none text-primary"
                  />
                  <span>
                    <strong className="text-foreground">{text.when}:</strong>{" "}
                    {ministry.schedule_text}
                  </span>
                </p>
              ) : null}
              {ministry.leaders_text ? <Leadership text={ministry.leaders_text} /> : null}
              <Link
                to={`/contato?ministerio=${ministry.id}`}
                aria-label={`${messages.pages.talkToMinistry}: ${ministry.name}`}
                className={buttonClassName({
                  variant: "outline",
                  size: "lg",
                  className: "mt-1 self-start px-5 font-bold",
                })}
              >
                {messages.pages.talkToMinistry}
                <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
