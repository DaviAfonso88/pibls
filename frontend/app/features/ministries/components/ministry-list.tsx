import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Link } from "react-router";
import { messages } from "~/shared/messages";
import { SanitizedHtml } from "~/shared/ui/sanitized-html";
import type { Ministry } from "../api";

/**
 * A liderança vem de `leaders_text`: um cargo por trecho, separados por " · " ("Coordenador: Ana e Bia · Vice: Caio"). Cada
 * trecho vira uma linha, com o cargo em destaque; sem cargo ("Dirce Rodrigues Pinheiro"), só os nomes. São parágrafos, e
 * não uma lista, para o item expansível continuar sendo o único `listitem` do catálogo.
 */
function Leadership({ text }: { text: string }) {
  const roles = text
    .split("·")
    .map((role) => role.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted p-3.5 text-[15px] text-foreground/80">
      <strong className="text-foreground">Liderança</strong>
      {roles.map((role) => {
        const colon = role.indexOf(":");
        return (
          <p key={role} className="m-0">
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
 * Catálogo de ministérios em lista expansível (design: Ministerios). Cada item abre para a descrição, a liderança e o
 * atalho "Falar com este ministério", que leva ao formulário já com o ministério escolhido (FR-005). Usa `<details>`: o
 * navegador cuida do teclado e do leitor de tela, e funciona antes de o JavaScript carregar.
 */
export function MinistryList({ items }: { items: readonly Ministry[] }) {
  return (
    <ul className="m-0 mx-auto max-w-3xl list-none border-t border-border p-0">
      {items.map((ministry) => (
        <li key={ministry.id} className="border-b border-border">
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-1 text-lg font-bold [&::-webkit-details-marker]:hidden">
              <span>{ministry.name}</span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 flex-none text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="flex flex-col gap-2 px-1 pb-5">
              {ministry.description ? (
                <SanitizedHtml html={ministry.description} className="text-foreground/80" />
              ) : null}
              {ministry.schedule_text ? (
                <p className="m-0 text-[15px] text-muted-foreground">
                  <strong className="text-foreground">Quando:</strong> {ministry.schedule_text}
                </p>
              ) : null}
              {ministry.leaders_text ? <Leadership text={ministry.leaders_text} /> : null}
              <Link
                to={`/contato?ministerio=${ministry.id}`}
                aria-label={`${messages.pages.talkToMinistry}: ${ministry.name}`}
                className="inline-flex min-h-11 items-center gap-1.5 self-start font-bold text-primary underline-offset-4 hover:underline"
              >
                {messages.pages.talkToMinistry}
                <ChevronRightIcon aria-hidden="true" className="size-[18px]" />
              </Link>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
