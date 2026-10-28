import { MessageCircleIcon, PlayCircleIcon } from "lucide-react";
import { Link, NavLink } from "react-router";
import { institution } from "~/content/institution";
import { messages } from "~/shared/messages";
import { buttonClassName } from "~/shared/ui/button-variants";
import { BrandSymbol } from "~/shared/ui/brand-logo";
import type { NavItem } from "./nav";

/**
 * Cabeçalho do site (design: SiteHeader). O símbolo e a sigla à esquerda; à direita, o canal do YouTube (quando houver)
 * e o atalho de contato; embaixo, o menu em uma linha que rola de lado no celular, com a página atual destacada
 * (`aria-current="page"`, posto pelo NavLink). O nome por extenso fica só para leitores de tela: está no rodapé do
 * documento e no título da aba, e o espaço do cabeçalho é pouco no celular.
 */
export function SiteHeader({
  items,
  youtubeUrl,
}: {
  items: readonly NavItem[];
  /** Canal do YouTube já validado (http/https); sem ele, o botão não aparece. */
  youtubeUrl?: string | null;
}) {
  return (
    <header className="border-b border-border bg-background">
      <div className="container flex min-h-[68px] items-center justify-between gap-3 py-2">
        <Link to="/" className="flex min-h-11 items-center gap-2.5 text-foreground no-underline">
          <BrandSymbol className="size-12" />
          {/* A cor do rodapé é o azul-petróleo escuro do texto do logotipo */}
          <span className="text-[22px] leading-none font-extrabold tracking-wide text-footer">
            {institution.shortName}
          </span>
          {/* O nome acessível precisa conter o texto visível (WCAG 2.5.3); por isso um complemento, e não um aria-label */}
          <span className="sr-only">
            , {institution.name}, {messages.site.homeLinkHint}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {youtubeUrl ? (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({
                variant: "outline",
                className: "gap-1.5 px-3 font-bold",
              })}
            >
              <PlayCircleIcon
                data-icon="inline-start"
                aria-hidden="true"
                className="text-primary"
              />
              {messages.site.youtube}
              <span className="sr-only"> {messages.forms.opensInNewTab}</span>
            </a>
          ) : null}
          <Link
            to="/contato"
            aria-label={messages.site.contactLink}
            className="flex size-11 flex-none items-center justify-center rounded-xl border border-border-strong text-whatsapp hover:bg-muted"
          >
            <MessageCircleIcon aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </div>

      <nav aria-label={messages.a11y.mainNavigation} className="container">
        <ul className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-2.5 whitespace-nowrap">
          {items.map((item) => (
            <li key={item.id} className="flex-none">
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "inline-flex min-h-11 items-center rounded-full px-3.5 text-[15px] no-underline",
                    isActive
                      ? "bg-primary font-bold text-primary-foreground"
                      : "font-semibold text-foreground hover:bg-muted",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
