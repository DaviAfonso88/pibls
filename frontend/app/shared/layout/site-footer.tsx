import type { ReactNode } from "react";
import { Link } from "react-router";
import { PlayCircleIcon } from "lucide-react";
import { institution } from "~/content/institution";
import { formatCnpj, formatPhone } from "~/shared/format";
import { messages } from "~/shared/messages";
import { addressLines, safeHttpUrl, summarizeServices, whatsappUrl } from "~/shared/site/links";
import type { PublicSettings } from "~/shared/site/settings";
import { buttonClassName } from "~/shared/ui/button-variants";
import { BrandSymbol } from "~/shared/ui/brand-logo";

// `gap-1.5`: num `inline-flex` o espaço entre o texto e o <span> seguinte some, e "WhatsApp" colava no número
const linkClass =
  "inline-flex min-h-11 items-center gap-1.5 text-footer-foreground hover:underline";
const headingClass = "m-0 text-[13px] font-bold tracking-widest text-footer-muted uppercase";

/** Linhas de texto separadas por quebra de linha, sem `key` repetida. */
function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <p className="m-0">
      {lines.map((line, index) => (
        <span key={line}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </p>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
      <span className="sr-only"> {messages.forms.opensInNewTab}</span>
    </a>
  );
}

/**
 * Rodapé do site (design: SiteFooter). Endereço, cultos, WhatsApp e redes vêm das configurações públicas; sem elas
 * (carregando ou com o servidor fora), ficam os títulos e os links fixos, e nunca um texto de exemplo.
 */
export function SiteFooter({ settings }: { settings: PublicSettings | undefined }) {
  const address = addressLines(settings?.address);
  const services = summarizeServices(settings?.schedule ?? []);
  const whatsapp = whatsappUrl(settings?.whatsapp);
  const youtube = safeHttpUrl(settings?.youtube_links?.channel_url);
  // Redes cuja URL é http(s) válida; o resto é ignorado
  const social = (settings?.social_links ?? []).flatMap((link) => {
    const href = safeHttpUrl(link.url);
    return href ? [{ network: link.network, href }] : [];
  });

  return (
    <footer
      aria-label={messages.a11y.footer}
      className="bg-footer px-4 pt-10 pb-8 text-[15px] leading-relaxed text-footer-text"
    >
      <div className="container flex flex-col gap-7 px-0">
        <div className="flex items-center gap-3">
          <BrandSymbol className="size-12" />
          <span className="text-[22px] leading-none font-extrabold tracking-wide text-footer-foreground">
            {institution.shortName}
          </span>
        </div>

        {youtube ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-2xl border border-footer-border bg-primary/25 p-5">
            <span
              aria-hidden="true"
              className="flex size-12 flex-none items-center justify-center rounded-full bg-highlight text-highlight-foreground"
            >
              <PlayCircleIcon className="size-7" />
            </span>
            <div className="flex min-w-48 flex-1 flex-col gap-0.5">
              <h2 className="m-0 text-lg leading-snug font-extrabold text-footer-foreground">
                {messages.site.footerYoutubeTitle}
              </h2>
              <p className="m-0 text-footer-text">{messages.site.footerYoutubeText}</p>
            </div>
            <a
              href={youtube}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({
                variant: "highlight",
                size: "lg",
                className: "min-w-40 flex-1 px-5 font-bold sm:flex-none",
              })}
            >
              {messages.site.footerYoutubeCta}
              <span className="sr-only"> {messages.forms.opensInNewTab}</span>
            </a>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-x-6 gap-y-7">
          <section className="flex min-w-40 flex-1 flex-col gap-1.5">
            <h2 className={headingClass}>{messages.site.footerWhere}</h2>
            {address.length > 0 ? <Lines lines={address} /> : null}
            <Link to="/como-chegar" className={`${linkClass} font-bold`}>
              {messages.site.directions}
            </Link>
          </section>

          <section className="flex min-w-40 flex-1 flex-col gap-1.5">
            <h2 className={headingClass}>{messages.site.footerServices}</h2>
            {services.length > 0 ? <Lines lines={services} /> : null}
            <Link to="/#horarios" className={`${linkClass} font-bold`}>
              {messages.site.allSchedules}
            </Link>
          </section>

          <section className="flex min-w-40 flex-1 flex-col gap-1.5">
            <h2 className={headingClass}>{messages.site.footerContact}</h2>
            {whatsapp && settings?.whatsapp ? (
              <ExternalLink href={whatsapp}>
                WhatsApp{" "}
                <span className="whitespace-nowrap">{formatPhone(settings.whatsapp.phone)}</span>
              </ExternalLink>
            ) : null}
            {social.map((link) => (
              <ExternalLink key={link.href} href={link.href}>
                <span className="capitalize">{link.network}</span>
              </ExternalLink>
            ))}
            {!whatsapp && social.length === 0 ? (
              <Link to="/contato" className={linkClass}>
                {messages.nav.contact}
              </Link>
            ) : null}
          </section>

          <section className="flex min-w-40 flex-1 flex-col gap-1.5">
            <h2 className={headingClass}>{messages.site.footerParticipate}</h2>
            <Link to="/sou-visitante" className={linkClass}>
              {messages.nav.visitor}
            </Link>
            <Link to="/quero-ser-membro" className={linkClass}>
              {messages.nav.member}
            </Link>
            <Link to="/pedido-de-oracao" className={linkClass}>
              {messages.nav.prayer}
            </Link>
          </section>
        </div>

        <div className="flex flex-wrap justify-between gap-x-5 gap-y-2 border-t border-footer-border pt-5 text-sm text-footer-muted">
          <span>
            CNPJ {formatCnpj(institution.cnpj)} · {institution.affiliation}
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacidade" className={`${linkClass} text-footer-text`}>
              {messages.site.privacy}
            </Link>
            <Link to="/admin/entrar" className={`${linkClass} text-footer-text`}>
              {messages.site.staffAccess}
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
