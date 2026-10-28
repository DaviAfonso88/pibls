import { homeMessages } from "../messages";
import {
  BookOpenIcon,
  CalendarIcon,
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
import { cn } from "~/shared/lib/utils";
import { messages } from "~/shared/messages";
import { safeHttpUrl, whatsappUrl } from "~/shared/site/links";
import { scheduleDetail, shortDay, sortSchedule } from "~/shared/site/schedule";
import type { PublicSettings } from "~/shared/site/settings";
import { buttonClassName } from "~/shared/ui/button-variants";
import { Photo } from "~/shared/ui/photo";
import { Skeleton } from "~/shared/ui/skeleton";
import type { HomeHighlights } from "../api";

const sectionTitle = "m-0 text-2xl leading-tight";

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

/**
 * Boas-vindas e as duas chamadas principais: planejar a visita e assistir ao vivo (design: Main, seção inicial). O texto
 * e a foto da congregação dividem a faixa e, em telas estreitas, a foto desce para depois dos botões.
 */
export function HomeHero() {
  const since = new Date(institution.foundedOn).getUTCFullYear();

  return (
    <section aria-labelledby="boas-vindas" className="border-b border-border bg-muted pt-8 pb-10">
      <div className="container flex flex-wrap items-center gap-x-8 gap-y-6">
        <div className="flex min-w-[min(100%,21rem)] flex-[1_1_21rem] flex-col gap-4">
          <p className="m-0 text-sm font-bold tracking-wider text-primary uppercase">
            {homeMessages.homeEyebrow(since)}
          </p>
          <h1 id="boas-vindas" className="m-0 text-balance">
            {homeMessages.homeTitle}
          </h1>
          <p className="m-0 text-lg text-foreground/80">{homeMessages.homeLead}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Link
              to="/como-chegar"
              className={buttonClassName({
                size: "lg",
                className: "min-w-52 flex-1 px-5 font-bold",
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
                className: "min-w-52 flex-1 px-5 font-bold",
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
          sizes="(min-width: 1152px) 540px, (min-width: 704px) calc(50vw - 3rem), calc(100vw - 2rem)"
          className="aspect-3/2 min-w-[min(100%,21rem)] flex-[1_1_21rem] rounded-2xl"
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
    <section aria-labelledby="avisos" className="py-10">
      <div className="container flex flex-col gap-4">
        <h2 id="avisos" className={sectionTitle}>
          {homeMessages.notices}
        </h2>
        <div className="flex flex-wrap gap-4">
          {campaign ? (
            <article className="flex min-w-[min(100%,21rem)] flex-[2_1_21rem] flex-col gap-3 rounded-2xl bg-footer p-6 text-footer-text">
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
            <article className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-2.5 rounded-2xl border border-info-border bg-info p-6 text-info-foreground">
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
      className="scroll-mt-4 border-y border-border bg-muted py-10"
    >
      <div className="container flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 id="horarios-titulo" className={sectionTitle}>
            {homeMessages.schedule}
          </h2>
          <p className="m-0 text-muted-foreground">{homeMessages.scheduleHint}</p>
        </div>

        {isPending ? (
          <div role="status" className="flex flex-wrap gap-3">
            <span className="sr-only">{messages.a11y.loadingContent}</span>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-[74px] min-w-[min(100%,19rem)] flex-1" />
            ))}
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {items.map((item) => (
              <li
                key={`${item.day}-${item.time}-${item.activity}`}
                className="flex min-w-[min(100%,19rem)] flex-1 items-center gap-3.5 rounded-[14px] border border-border bg-background px-4 py-3.5"
              >
                <div className="flex w-[72px] flex-none flex-col items-center rounded-[10px] bg-info px-1 py-2 leading-tight text-info-foreground">
                  <span className="text-[13px] font-bold tracking-wide uppercase">
                    {shortDay(item.day)}
                  </span>
                  <span className="text-[19px] font-extrabold">
                    {formatScheduleTime(item.time)}
                  </span>
                </div>
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
 * Transmissões no YouTube e atendimento pelo WhatsApp (âncora `#ao-vivo`). O canal é o destaque: um banner escuro, com a
 * foto do culto como link para a transmissão (ou o canal), que fica antes do cartão do WhatsApp. Sem nenhum dos dois
 * links, só o cartão do WhatsApp (ou do contato) aparece.
 */
export function LiveSection({ settings }: { settings: PublicSettings | undefined }) {
  const live = safeHttpUrl(settings?.youtube_links?.live_url);
  const channel = safeHttpUrl(settings?.youtube_links?.channel_url);
  const whatsapp = whatsappUrl(settings?.whatsapp);
  const watchUrl = live ?? channel;

  return (
    <section id="ao-vivo" aria-label={homeMessages.liveAndContact} className="scroll-mt-4 py-10">
      <div className="container flex flex-col gap-4">
        {watchUrl ? (
          <article className="grid overflow-hidden rounded-2xl bg-footer text-footer-text md:grid-cols-2">
            <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
              <p className="m-0 flex items-center gap-2 text-[13px] font-bold tracking-widest text-highlight uppercase">
                <PlayCircleIcon aria-hidden="true" className="size-5 flex-none" />
                {homeMessages.youtubeEyebrow}
              </p>
              <h2 className="m-0 text-[28px] leading-tight text-footer-foreground">
                {homeMessages.watchServices}
              </h2>
              <p className="m-0 max-w-prose">{homeMessages.watchServicesHint}</p>
              <div className="mt-1 flex flex-wrap gap-3">
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
                sizes="(min-width: 1152px) 560px, (min-width: 768px) 50vw, calc(100vw - 2rem)"
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
                className="absolute inset-0 flex items-center justify-center bg-footer/25 hover:bg-footer/10"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-highlight text-highlight-foreground shadow-lg">
                  <PlayIcon className="size-8" />
                </span>
              </a>
            </div>
          </article>
        ) : null}

        <article className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border border-border p-6">
          <div className="flex min-w-[min(100%,18rem)] flex-1 flex-col gap-1.5">
            <h2 className="m-0 text-[22px] leading-tight">{homeMessages.talkToUs}</h2>
            <p className="m-0 text-muted-foreground">{homeMessages.talkToUsHint}</p>
          </div>
          {whatsapp ? (
            <ExternalAnchor
              href={whatsapp}
              className={buttonClassName({
                variant: "whatsapp",
                size: "lg",
                className: "min-w-52 flex-1 px-5 font-bold sm:flex-none",
              })}
            >
              <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
              {messages.pages.callWhatsapp}
            </ExternalAnchor>
          ) : (
            <Link
              to="/contato"
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                className: "min-w-52 flex-1 px-5 font-bold sm:flex-none",
              })}
            >
              {messages.nav.contact}
            </Link>
          )}
        </article>
      </div>
    </section>
  );
}

/** Convite para o pedido de oração, entre o atendimento e os destaques. Só chama; o formulário é a página própria. */
export function PrayerSection() {
  return (
    <section aria-labelledby="pedido-oracao" className="pb-10">
      <div className="container">
        <article className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border border-info-border bg-info p-6 text-info-foreground">
          <div className="flex min-w-[min(100%,18rem)] flex-[2_1_18rem] items-start gap-3.5">
            <HandHeartIcon aria-hidden="true" className="mt-0.5 size-7 flex-none" />
            <div className="flex flex-col gap-1.5">
              <h2 id="pedido-oracao" className="m-0 text-[22px] leading-tight">
                {homeMessages.prayerTitle}
              </h2>
              <p className="m-0">{homeMessages.prayerHint}</p>
              <p className="m-0 text-[15px]">{homeMessages.prayerPrivacy}</p>
            </div>
          </div>
          <Link
            to="/pedido-de-oracao"
            className={buttonClassName({
              size: "lg",
              className: "min-w-52 flex-1 px-5 font-bold sm:flex-none",
            })}
          >
            {homeMessages.prayerCta}
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </article>
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
      className={cn(
        "flex min-w-[min(100%,19rem)] flex-1 items-start gap-3.5 rounded-2xl border border-border bg-muted p-5 text-foreground no-underline hover:border-border-strong",
      )}
    >
      <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-info text-info-foreground">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">{meta}</span>
        <span className="font-bold">{title}</span>
        <span className="text-[15px] font-bold text-primary">{action}</span>
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
    <section aria-labelledby="destaques" className="pt-2 pb-12">
      <div className="container flex flex-col gap-4">
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
