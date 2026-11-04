import { homeMessages } from "../messages";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  HandHeartIcon,
  MapPinIcon,
  MessageCircleIcon,
  PlayCircleIcon,
  PlayIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { institution } from "~/content/institution";
import { photos } from "~/content/photos";
import { formatDate, formatIsoDate, formatScheduleTime } from "~/shared/format";
import { messages } from "~/shared/messages";
import { safeHttpUrl, whatsappUrl } from "~/shared/site/links";
import { scheduleDetail, shortDay, sortSchedule, type ScheduleItem } from "~/shared/site/schedule";
import type { PublicSettings } from "~/shared/site/settings";
import { buttonClassName } from "~/shared/ui/button-variants";
import { Photo } from "~/shared/ui/photo";
import { Skeleton } from "~/shared/ui/skeleton";
import type { HomeHighlights } from "../api";

const sectionTitle = "m-0 text-2xl leading-tight tracking-tight md:text-3xl";
const eyebrow = "m-0 text-sm font-bold tracking-wider text-primary uppercase";
// Seções sobre o fundo branco; as faixas coloridas (horários) têm mais respiro
const plainSection = "py-8 md:py-10";

function ExternalAnchor({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> {messages.forms.opensInNewTab}</span>
    </a>
  );
}

/** O dia abreviado e a hora de um item do quadro, no selo que abre cada linha de horário. */
function ScheduleBadge({ item }: { item: ScheduleItem }) {
  return (
    <div className="flex w-[72px] flex-none flex-col items-center rounded-lg bg-info px-1 py-2 leading-tight text-info-foreground">
      <span className="text-[13px] font-bold tracking-wide uppercase">{shortDay(item.day)}</span>
      <span className="text-[19px] font-extrabold tabular-nums">
        {formatScheduleTime(item.time)}
      </span>
    </div>
  );
}

/**
 * Boas-vindas e as duas chamadas principais: planejar a visita e assistir ao vivo (design: Main, seção inicial). O texto
 * e a foto da congregação dividem a faixa e, em telas estreitas, a foto desce para depois dos botões.
 */
export function HomeHero() {
  const since = new Date(institution.foundedOn).getUTCFullYear();

  return (
    <section
      aria-labelledby="boas-vindas"
      className="bg-linear-to-b from-muted to-background pt-8 pb-10 md:pt-16 md:pb-14"
    >
      <div className="container grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-12">
        <div className="flex flex-col items-start gap-5">
          <p className="m-0 rounded-full bg-background px-3.5 py-1.5 text-[13px] font-bold tracking-wider text-primary uppercase ring-1 ring-border">
            {homeMessages.homeEyebrow(since)}
          </p>
          {/* `text-pretty`, e não o `balance` da base: equilibrar as linhas quebrava "bem-vindo" no hífen */}
          <h1
            id="boas-vindas"
            className="m-0 tracking-tight text-pretty md:text-5xl md:leading-[1.08]"
          >
            {homeMessages.homeTitle}
          </h1>
          <p className="m-0 max-w-xl text-lg text-pretty text-foreground/80 md:text-xl">
            {homeMessages.homeLead}
          </p>
          <div className="mt-1 flex w-full flex-wrap gap-3">
            <Link
              to="/como-chegar"
              className={buttonClassName({
                size: "lg",
                className: "min-w-52 flex-1 px-5 font-bold sm:flex-none",
              })}
            >
              <MapPinIcon data-icon="inline-start" aria-hidden="true" />
              {homeMessages.planVisit}
            </Link>
            <Link
              to="/#ao-vivo"
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                className: "min-w-52 flex-1 px-5 font-bold sm:flex-none",
              })}
            >
              <PlayCircleIcon data-icon="inline-start" aria-hidden="true" />
              {homeMessages.watchLive}
            </Link>
          </div>
        </div>
        <Photo
          photo={photos.welcome}
          priority
          sizes="(min-width: 1152px) 496px, (min-width: 768px) calc(48vw - 2.5rem), calc(100vw - 2rem)"
          className="aspect-3/2 rounded-3xl shadow-xl shadow-footer/15"
          imgClassName="object-[50%_40%]"
        />
      </div>
    </section>
  );
}

/** Avisos da campanha (com chamada para `/contribua`) e da Ceia, só quando ativos. */
export function NoticesSection({ settings }: { settings: PublicSettings | undefined }) {
  const campaign = settings?.campaign_notice?.active ? settings.campaign_notice : null;
  const supper = settings?.lords_supper_notice?.active ? settings.lords_supper_notice : null;
  if (!campaign && !supper) return null;

  return (
    <section aria-labelledby="avisos" className={plainSection}>
      <div className="container flex flex-col gap-5">
        <h2 id="avisos" className={sectionTitle}>
          {homeMessages.notices}
        </h2>
        <div className="flex flex-wrap gap-4">
          {campaign ? (
            <article className="flex min-w-[min(100%,21rem)] flex-[2_1_21rem] flex-col gap-3 rounded-3xl bg-footer p-6 text-footer-text md:p-8">
              <p className="m-0 text-[13px] font-bold tracking-widest text-highlight uppercase">
                {homeMessages.campaign}
              </p>
              {campaign.title ? (
                <h3 className="m-0 text-[22px] leading-tight text-footer-foreground">
                  {campaign.title}
                </h3>
              ) : null}
              {campaign.text ? <p className="m-0">{campaign.text}</p> : null}
              <Link
                to="/contribua"
                className={buttonClassName({
                  variant: "highlight",
                  size: "lg",
                  className: "mt-1 self-start px-5 font-bold",
                })}
              >
                {homeMessages.contributePix}
                <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </article>
          ) : null}
          {supper ? (
            <article className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-2.5 rounded-3xl border border-info-border bg-info p-6 text-info-foreground md:p-8">
              <div className="flex items-center gap-2.5">
                <CalendarIcon aria-hidden="true" className="size-[22px] flex-none" />
                <h3 className="m-0 text-xl leading-tight">{homeMessages.lordsSupper}</h3>
              </div>
              {supper.text ? <p className="m-0">{supper.text}</p> : null}
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Quadro de horários (âncora `#horarios`), vindo das configurações. */
export function ScheduleSection({
  schedule,
  isPending,
}: {
  schedule: PublicSettings["schedule"] | undefined;
  isPending: boolean;
}) {
  const items = schedule ? sortSchedule(schedule) : [];

  return (
    <section
      id="horarios"
      aria-labelledby="horarios-titulo"
      className="scroll-mt-4 bg-muted py-12 md:py-16"
    >
      <div className="container flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="horarios-titulo" className={sectionTitle}>
            {homeMessages.schedule}
          </h2>
          <p className="m-0 text-muted-foreground">{homeMessages.scheduleHint}</p>
        </div>

        {isPending ? (
          <div role="status" className="flex flex-wrap gap-3">
            <span className="sr-only">{messages.a11y.loadingContent}</span>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-[78px] min-w-[min(100%,19rem)] flex-1" />
            ))}
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {items.map((item) => (
              <li
                key={`${item.day}-${item.time}-${item.activity}`}
                className="flex min-w-[min(100%,19rem)] flex-1 items-center gap-4 rounded-2xl bg-background p-4 shadow-xs"
              >
                <ScheduleBadge item={item} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-bold">{item.activity}</span>
                  <span className="text-[15px] text-muted-foreground">{scheduleDetail(item)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/grupos"
          className="inline-flex min-h-11 items-center gap-1.5 self-start font-bold text-primary underline-offset-4 hover:underline"
        >
          {homeMessages.seeGroups}
          <ChevronRightIcon aria-hidden="true" className="size-[18px]" />
        </Link>
      </div>
    </section>
  );
}

/**
 * Convite para a Ficha de Visitante, logo depois dos horários: quem vê quando vir descobre aqui como se apresentar. Sem
 * fundo próprio, entre a faixa dos horários e o banner escuro das transmissões. Só chama; o formulário é a página própria.
 */
export function VisitorSection() {
  return (
    <section aria-labelledby="visitante" className={`${plainSection} md:pt-14`}>
      <div className="container grid items-center gap-6 md:grid-cols-2 md:gap-12">
        <Photo
          photo={photos.visitor}
          sizes="(min-width: 1152px) 520px, (min-width: 768px) calc(50vw - 2.5rem), calc(100vw - 2rem)"
          className="aspect-3/2 rounded-3xl"
        />
        <div className="flex flex-col items-start gap-5">
          <div className="flex flex-col gap-2">
            <p className={eyebrow}>{homeMessages.visitorEyebrow}</p>
            <h2 id="visitante" className={sectionTitle}>
              {homeMessages.visitorTitle}
            </h2>
            <p className="m-0 text-foreground/80">{homeMessages.visitorLead}</p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {homeMessages.visitorOptions.map((option) => (
              <li key={option} className="flex items-start gap-2.5 font-semibold">
                <CheckIcon aria-hidden="true" className="mt-[3px] size-5 flex-none text-primary" />
                {option}
              </li>
            ))}
          </ul>
          <Link
            to="/sou-visitante"
            className={buttonClassName({
              size: "lg",
              className: "w-full px-5 font-bold sm:w-auto",
            })}
          >
            {homeMessages.visitorCta}
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
          <p className="m-0 text-[15px] text-muted-foreground">{homeMessages.visitorPrivacy}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Convite para o pedido de oração, ao lado do atendimento. Só chama; o formulário é a página própria. É uma seção à parte
 * (com o próprio título) para quem navega por regiões.
 */
function PrayerCard() {
  return (
    <section
      aria-labelledby="pedido-oracao"
      className="flex flex-col items-start gap-4 rounded-3xl border border-info-border bg-info p-6 text-info-foreground md:p-8"
    >
      <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-background">
        <HandHeartIcon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 id="pedido-oracao" className="m-0 text-[22px] leading-tight">
          {homeMessages.prayerTitle}
        </h2>
        <p className="m-0">{homeMessages.prayerHint}</p>
        <p className="m-0 text-[15px]">{homeMessages.prayerPrivacy}</p>
      </div>
      <Link
        to="/pedido-de-oracao"
        className={buttonClassName({
          size: "lg",
          className: "mt-auto w-full px-5 font-bold sm:w-auto",
        })}
      >
        {homeMessages.prayerCta}
        <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
      </Link>
    </section>
  );
}

/**
 * Transmissões no YouTube, atendimento pelo WhatsApp e pedido de oração (âncora `#ao-vivo`). O canal é o destaque: um
 * banner escuro, com a foto do culto como link para a transmissão (ou o canal); embaixo, lado a lado em telas largas, os
 * cartões do WhatsApp e do pedido de oração. Sem nenhum link do YouTube, só os dois cartões aparecem.
 */
export function LiveSection({ settings }: { settings: PublicSettings | undefined }) {
  const live = safeHttpUrl(settings?.youtube_links?.live_url);
  const channel = safeHttpUrl(settings?.youtube_links?.channel_url);
  const whatsapp = whatsappUrl(settings?.whatsapp);
  const watchUrl = live ?? channel;

  return (
    <section
      id="ao-vivo"
      aria-label={homeMessages.liveAndContact}
      className={`scroll-mt-4 ${plainSection}`}
    >
      <div className="container flex flex-col gap-4">
        {watchUrl ? (
          <article className="grid overflow-hidden rounded-3xl bg-footer text-footer-text md:grid-cols-2">
            <div className="flex flex-col justify-center gap-4 p-6 md:p-12">
              <p className="m-0 flex items-center gap-2 text-[13px] font-bold tracking-widest text-highlight uppercase">
                <PlayCircleIcon aria-hidden="true" className="size-5 flex-none" />
                {homeMessages.youtubeEyebrow}
              </p>
              <h2 className="m-0 text-[28px] leading-tight tracking-tight text-footer-foreground md:text-[2rem]">
                {homeMessages.watchServices}
              </h2>
              <p className="m-0 max-w-prose">{homeMessages.watchServicesHint}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {live ? (
                  <ExternalAnchor
                    href={live}
                    className={buttonClassName({
                      variant: "highlight",
                      size: "lg",
                      className: "min-w-40 flex-1 px-5 font-bold sm:flex-none",
                    })}
                  >
                    <PlayCircleIcon data-icon="inline-start" aria-hidden="true" />
                    {homeMessages.live}
                  </ExternalAnchor>
                ) : null}
                {channel ? (
                  <ExternalAnchor
                    href={channel}
                    className={buttonClassName({
                      variant: "outline",
                      size: "lg",
                      // O botão claro fica sobre o banner escuro, cujo texto é claro: a cor do botão é a do corpo
                      className: "min-w-40 flex-1 px-5 font-bold text-foreground sm:flex-none",
                    })}
                  >
                    {homeMessages.channel}
                  </ExternalAnchor>
                ) : null}
              </div>
            </div>

            <div className="relative min-h-56">
              <Photo
                photo={photos.worship}
                sizes="(min-width: 1152px) 544px, (min-width: 768px) 50vw, calc(100vw - 2rem)"
                className="absolute inset-0 aspect-auto rounded-none"
                imgClassName="object-[50%_40%]"
              />
              {/* A foto também leva à transmissão; os botões ao lado já cobrem o teclado e o leitor de tela */}
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={-1}
                aria-hidden="true"
                className="group absolute inset-0 flex items-center justify-center bg-footer/25 transition-colors hover:bg-footer/10"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-highlight text-highlight-foreground shadow-lg transition-transform group-hover:scale-105">
                  <PlayIcon className="size-8" />
                </span>
              </a>
            </div>
          </article>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <article className="flex flex-col items-start gap-4 rounded-3xl border border-border p-6 md:p-8">
            <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-success text-success-foreground">
              <MessageCircleIcon aria-hidden="true" className="size-6" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="m-0 text-[22px] leading-tight">{homeMessages.talkToUs}</h2>
              <p className="m-0 text-muted-foreground">{homeMessages.talkToUsHint}</p>
            </div>
            {whatsapp ? (
              <div className="mt-auto flex w-full flex-wrap items-center gap-x-5 gap-y-2">
                <ExternalAnchor
                  href={whatsapp}
                  className={buttonClassName({
                    variant: "whatsapp",
                    size: "lg",
                    className: "w-full px-5 font-bold sm:w-auto",
                  })}
                >
                  <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
                  {messages.pages.callWhatsapp}
                </ExternalAnchor>
                <Link
                  to="/contato"
                  className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline"
                >
                  {homeMessages.talkToUsForm}
                </Link>
              </div>
            ) : (
              <Link
                to="/contato"
                className={buttonClassName({
                  variant: "outline",
                  size: "lg",
                  className: "mt-auto w-full px-5 font-bold sm:w-auto",
                })}
              >
                {messages.nav.contact}
              </Link>
            )}
          </article>
          <PrayerCard />
        </div>
      </div>
    </section>
  );
}

/**
 * Juventude Salt, o ministério de jovens e adolescentes, que tem site próprio: a foto, o lema, os pilares, o Culto Salt do
 * quadro de horários (quando existir) e o link para o site, em nova aba. Fica entre o atendimento e os destaques.
 */
export function YouthSection({ schedule }: { schedule: PublicSettings["schedule"] | undefined }) {
  const meeting = schedule?.find((item) => /\bsalt\b/i.test(item.activity));
  const { name, url } = institution.youthSite;

  return (
    <section aria-labelledby="juventude" className={plainSection}>
      <div className="container">
        <div className="grid overflow-hidden rounded-3xl bg-muted md:grid-cols-2">
          <div className="relative aspect-3/2 md:aspect-auto">
            <Photo
              photo={photos.salt}
              sizes="(min-width: 1152px) 544px, (min-width: 768px) 50vw, calc(100vw - 2rem)"
              className="absolute inset-0 aspect-auto rounded-none"
            />
          </div>
          <div className="flex flex-col items-start gap-5 p-6 md:p-12">
            <div className="flex flex-col gap-2">
              <p className={eyebrow}>{homeMessages.youthEyebrow}</p>
              <h2 id="juventude" className={sectionTitle} translate="no">
                {name}
              </h2>
              <p className="m-0 text-foreground/80">{homeMessages.youthLead}</p>
            </div>
            <ul
              aria-label={homeMessages.youthPillarsLabel}
              className="m-0 flex list-none flex-wrap gap-2 p-0"
            >
              {homeMessages.youthPillars.map((pillar) => (
                <li
                  key={pillar}
                  className="rounded-full bg-background px-3.5 py-1.5 text-[15px] font-semibold text-accent-foreground"
                >
                  {pillar}
                </li>
              ))}
            </ul>
            <blockquote className="m-0 border-l-[3px] border-primary pl-4">
              <p className="m-0 italic">{homeMessages.youthVerse}</p>
              <cite className="text-[15px] text-muted-foreground not-italic">
                {homeMessages.youthVerseRef}
              </cite>
            </blockquote>
            {meeting ? (
              <div className="flex w-full items-center gap-4 rounded-2xl bg-background p-4">
                <ScheduleBadge item={meeting} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-bold">{meeting.activity}</span>
                  <span className="text-[15px] text-muted-foreground">
                    {scheduleDetail(meeting)}
                  </span>
                </div>
              </div>
            ) : null}
            <ExternalAnchor
              href={url}
              className={buttonClassName({
                size: "lg",
                className: "mt-auto w-full px-5 font-bold sm:w-auto",
              })}
            >
              {homeMessages.youthCta}
              <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
            </ExternalAnchor>
          </div>
        </div>
      </div>
    </section>
  );
}

/** O primeiro Instagram com endereço válido, e o @ que sai dele (`instagram.com/pib_ls/` → `@pib_ls`), se der para saber. */
function instagramProfile(
  links: PublicSettings["social_links"],
): { url: string; handle: string | null } | null {
  const url = links
    .filter((link) => /instagram/i.test(link.network))
    .map((link) => safeHttpUrl(link.url))
    .find((candidate) => candidate !== null);
  if (!url) return null;

  const [name, ...rest] = new URL(url).pathname.split("/").filter(Boolean);
  return { url, handle: name && rest.length === 0 ? `@${name.replace(/^@/, "")}` : null };
}

/** O Lucide não traz mais ícones de marca: este é desenhado aqui, com o mesmo traço dos outros. */
function InstagramIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

/**
 * Convite para o Instagram da igreja, com o endereço das redes sociais (Configurações do painel): sem Instagram cadastrado,
 * a seção não aparece. Só leva ao perfil, em nova aba: mostrar as publicações aqui exigiria script e cookies de terceiro.
 */
export function InstagramSection({
  socialLinks,
}: {
  socialLinks: PublicSettings["social_links"] | undefined;
}) {
  const profile = instagramProfile(socialLinks ?? []);
  if (!profile) return null;

  return (
    <section aria-labelledby="instagram" className={plainSection}>
      <div className="container">
        <div className="flex flex-col items-start gap-6 border-y border-border py-8 md:flex-row md:items-center md:justify-between md:gap-12 md:py-10">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-3 font-bold text-primary">
              <span className="flex size-11 flex-none items-center justify-center rounded-full ring-1 ring-border">
                <InstagramIcon className="size-[22px]" />
              </span>
              {profile.handle ? (
                <span className="min-w-0 break-words" translate="no">
                  {profile.handle}
                </span>
              ) : null}
            </div>
            <h2 id="instagram" className={sectionTitle}>
              {homeMessages.instagramTitle}
            </h2>
            <p className="m-0 max-w-prose text-muted-foreground">{homeMessages.instagramHint}</p>
          </div>
          <ExternalAnchor
            href={profile.url}
            className={buttonClassName({
              variant: "outline",
              size: "lg",
              className: "w-full flex-none px-5 font-bold md:w-auto",
            })}
          >
            {homeMessages.instagramCta}
            <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
          </ExternalAnchor>
        </div>
      </div>
    </section>
  );
}

function HighlightCard({
  to,
  icon,
  meta,
  title,
  action,
}: {
  to: string;
  icon: ReactNode;
  meta: string;
  title: string;
  action: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-[min(100%,19rem)] flex-1 items-start gap-4 rounded-3xl border border-border bg-background p-5 text-foreground no-underline transition-[border-color,box-shadow,translate] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md md:p-6"
    >
      <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-info text-info-foreground">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">{meta}</span>
        <span className="font-bold break-words">{title}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-[15px] font-bold text-primary">
          {action}
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  );
}

/**
 * Destaques de `home.json` (design: Main, "Para ler nesta semana"): o último boletim, a última mensagem e, com a flag
 * ligada, o próximo evento. Fica no fim da página e sempre mostra o boletim e a mensagem: sem nenhum publicado, o cartão
 * leva à lista.
 */
export function HighlightsSection({
  highlights,
  eventsEnabled,
}: {
  highlights: HomeHighlights | undefined;
  eventsEnabled: boolean;
}) {
  const bulletin = highlights?.latest_bulletin ?? null;
  const post = highlights?.latest_posts[0] ?? null;
  const event = eventsEnabled ? (highlights?.upcoming_events[0] ?? null) : null;
  // Sem os destaques (carregando ou falha) a seção some; carregados e vazios, os cartões levam às listas
  if (highlights === undefined) return null;

  return (
    <section aria-labelledby="destaques" className="pt-8 pb-14 md:pt-10 md:pb-20">
      <div className="container flex flex-col gap-5">
        <h2 id="destaques" className={sectionTitle}>
          {homeMessages.highlights}
        </h2>
        <div className="flex flex-wrap gap-4">
          {bulletin ? (
            <HighlightCard
              to="/boletins"
              icon={<FileTextIcon aria-hidden="true" className="size-[22px]" />}
              meta={`${homeMessages.bulletinNumber(bulletin.edition_number)} · ${formatIsoDate(bulletin.reference_date)}`}
              title={bulletin.title}
              action={homeMessages.readBulletin}
            />
          ) : (
            <HighlightCard
              to="/boletins"
              icon={<FileTextIcon aria-hidden="true" className="size-[22px]" />}
              meta={homeMessages.bulletinEmptyMeta}
              title={homeMessages.bulletinEmptyTitle}
              action={homeMessages.seeBulletins}
            />
          )}
          {post ? (
            <HighlightCard
              to={`/palavra-viva/${post.slug}`}
              icon={<BookOpenIcon aria-hidden="true" className="size-[22px]" />}
              meta={`${messages.nav.palavraViva} · ${formatDate(post.published_at)}`}
              title={post.title}
              action={homeMessages.readMessage}
            />
          ) : (
            <HighlightCard
              to="/palavra-viva"
              icon={<BookOpenIcon aria-hidden="true" className="size-[22px]" />}
              meta={homeMessages.messageEmptyMeta}
              title={homeMessages.messageEmptyTitle}
              action={homeMessages.seeMessages}
            />
          )}
          {event ? (
            <HighlightCard
              to={`/eventos/${event.slug}`}
              icon={<CalendarIcon aria-hidden="true" className="size-[22px]" />}
              meta={`${homeMessages.nextEvent} · ${formatDate(event.starts_at)}`}
              title={event.title}
              action={homeMessages.seeAndRegister}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
