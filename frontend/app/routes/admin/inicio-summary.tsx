import { useQuery } from "@tanstack/react-query";
import { CalendarCheckIcon, FileTextIcon, MessageSquareTextIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { accessMessages } from "~/features/access/messages";
import type { PermissionRequirement } from "~/features/access/permissions";
import {
  adminBulletinsQuery,
  adminPostsQuery,
  type AdminBulletin,
  type AdminPost,
} from "~/features/content/admin-api";
import { nextOpenEventQuery, todayRegistrationsQuery } from "~/features/events/today-api";
import { newLeadsCountQuery } from "~/features/leads/counts";
import { formatIsoDateLong, formatTime, sundaysAround, toDateInput } from "~/shared/format";
import { messages } from "~/shared/messages";
import { usePublicSettings } from "~/shared/site/settings";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Skeleton } from "~/shared/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/shared/ui/table";

const { home } = accessMessages;

const READ_REGISTRATIONS: PermissionRequirement = [
  "eventos.inscricoes.read",
  "eventos.inscricoes.read.own",
];
const SEE_EVENTS: PermissionRequirement = [
  "eventos.write",
  "eventos.write.own",
  ...READ_REGISTRATIONS,
];

export function Card({ children, className }: { children: ReactNode; className: string }) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-[14px] border border-border bg-card ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({ id, title, link }: { id: string; title: string; link?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
      <h2 id={id} className="m-0 text-lg font-extrabold">
        {title}
      </h2>
      {link}
    </div>
  );
}

type CardState =
  { status: "pending" } | { status: "unavailable" } | { status: "ready"; value: string };

/** O estado de um número que vem de uma consulta: pedindo, indisponível (falha ou rota fora do ar) ou pronto. */
function stateOf<T>(
  query: { isPending: boolean; isError: boolean; data: T | undefined },
  format: (data: T) => string,
): CardState {
  if (query.isError) return { status: "unavailable" };
  if (query.isPending || query.data === undefined) return { status: "pending" };
  return { status: "ready", value: format(query.data) };
}

/** As vagas do próximo evento: "—" sem evento aberto, "Sem limite" sem teto, senão as que sobram. */
function spotsState(query: ReturnType<typeof useNextOpenEvent>): CardState {
  if (query.isError) return { status: "unavailable" };
  if (query.isPending) return { status: "pending" };

  const event = query.data;
  if (event === null || event === undefined)
    return { status: "ready", value: home.cards.unavailable };

  const { spots_total: total, spots_left: left } = event.registration;
  return {
    status: "ready",
    value: total === null || total === undefined ? home.cards.unlimited : String(left ?? 0),
  };
}

function SummaryCard({
  to,
  label,
  action,
  state,
  hint,
}: {
  to: string;
  label: string;
  action: string;
  state: CardState;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-col gap-1 rounded-[14px] border border-border bg-card p-5 text-foreground no-underline hover:bg-muted"
    >
      <span className="text-[15px] text-muted-foreground">{label}</span>
      {state.status === "pending" ? (
        <Skeleton aria-hidden="true" className="my-1 h-9 w-16" />
      ) : (
        <span className="text-4xl leading-tight font-extrabold tabular-nums">
          {state.status === "ready" ? state.value : home.cards.unavailable}
          {state.status === "unavailable" ? (
            <span className="sr-only"> {home.cards.unavailableLabel}</span>
          ) : null}
          {hint === undefined ? null : <span className="sr-only"> {hint}</span>}
        </span>
      )}
      <span className="text-[15px] font-semibold text-primary">{action}</span>
    </Link>
  );
}

/** Os quatro números do dia (design: AdminInicio → Resumo). Cada cartão só existe para quem pode abrir o que ele conta. */
function useNextOpenEvent(enabled: boolean) {
  return useQuery({ ...nextOpenEventQuery(), enabled });
}

export function Summary() {
  const { can } = useAuth();
  const { settings } = usePublicSettings();
  const eventsEnabled = settings?.features.events ?? false;
  const showContacts = can("leads.read");
  const showPrayer = can("leads.oracao.read");
  const showRegistrations = eventsEnabled && can(READ_REGISTRATIONS);
  const showSpots = eventsEnabled && can(SEE_EVENTS);

  const contacts = useQuery({ ...newLeadsCountQuery("geral"), enabled: showContacts });
  const prayer = useQuery({ ...newLeadsCountQuery("oracao"), enabled: showPrayer });
  const registrations = useQuery({ ...todayRegistrationsQuery(), enabled: showRegistrations });
  const nextEvent = useNextOpenEvent(showSpots);

  if (!showContacts && !showPrayer && !showRegistrations && !showSpots) return null;

  // Quem só lê inscritos abre o evento pela lista de inscritos; quem edita, pela edição
  const eventLink = nextEvent.data
    ? can(READ_REGISTRATIONS)
      ? `/admin/eventos/${nextEvent.data.id}/inscritos`
      : `/admin/eventos/${nextEvent.data.id}`
    : "/admin/eventos";

  return (
    <section aria-labelledby="resumo" className="flex flex-col gap-3">
      <h2 id="resumo" className="m-0 text-lg font-extrabold">
        {home.summary}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
        {showContacts ? (
          <SummaryCard
            to="/admin/contatos"
            label={home.cards.contacts.label}
            action={home.cards.contacts.action}
            state={stateOf(contacts, String)}
          />
        ) : null}
        {showPrayer ? (
          <SummaryCard
            to="/admin/oracao"
            label={home.cards.prayer.label}
            action={home.cards.prayer.action}
            state={stateOf(prayer, String)}
          />
        ) : null}
        {showRegistrations ? (
          <SummaryCard
            to="/admin/eventos"
            label={home.cards.registrations.label}
            action={home.cards.registrations.action}
            state={stateOf(registrations, (data) => String(data.meta.total))}
          />
        ) : null}
        {showSpots ? (
          <SummaryCard
            to={eventLink}
            label={home.cards.spots.label}
            action={home.cards.spots.action}
            state={spotsState(nextEvent)}
            hint={nextEvent.data === null ? home.cards.noEvent : undefined}
          />
        ) : null}
      </div>
    </section>
  );
}

/** As últimas inscrições do dia (design: AdminInicio → Inscrições de hoje), com o nome abreviado pelo servidor. */
export function TodayRegistrations() {
  const { can } = useAuth();
  const { settings } = usePublicSettings();
  const enabled = (settings?.features.events ?? false) && can(READ_REGISTRATIONS);
  const query = useQuery({ ...todayRegistrationsQuery(), enabled });

  if (!enabled) return null;

  return (
    <Card className="flex-[1_1_26rem]">
      <SectionHeader
        id="inscricoes-hoje"
        title={home.today.title}
        link={
          <Link to="/admin/eventos" className="text-[15px] font-semibold whitespace-nowrap">
            {home.today.all}
          </Link>
        }
      />

      {query.isPending ? (
        <LoadingBlock count={3} className="p-4" />
      ) : query.isError ? (
        <ErrorState
          headingLevel="h3"
          title={home.today.error}
          message={messages.errors.generic}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data.data.length === 0 ? (
        <p className="m-0 px-5 py-6 text-muted-foreground">{home.today.empty}</p>
      ) : (
        <>
          <Table>
            <TableCaption className="sr-only">{home.today.title}</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5">{home.today.time}</TableHead>
                <TableHead>{home.today.name}</TableHead>
                <TableHead>{home.today.event}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((registration) => (
                <TableRow key={registration.id}>
                  <TableCell className="px-5 py-3 tabular-nums">
                    {formatTime(registration.created_at)}
                  </TableCell>
                  <TableCell className="py-3 font-semibold">{registration.name}</TableCell>
                  <TableCell className="py-3 whitespace-normal">
                    {registration.event.title}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {query.data.meta.total > query.data.data.length ? (
            <p className="m-0 border-t border-border px-5 py-3 text-sm text-muted-foreground">
              {home.today.more(query.data.meta.total - query.data.data.length)}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

function WeekRow({
  icon,
  text,
  detail,
  link,
}: {
  icon: ReactNode;
  text: string;
  detail?: string;
  link?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-muted px-5 py-4 last:border-b-0">
      <span
        aria-hidden="true"
        className="flex size-9 flex-none items-center justify-center rounded-lg bg-info text-info-foreground"
      >
        {icon}
      </span>
      <span className="flex min-w-48 flex-1 flex-col">
        <strong className="font-bold">{text}</strong>
        {detail === undefined ? null : (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
      </span>
      {link}
    </li>
  );
}

const rowLink = "text-[15px] font-semibold whitespace-nowrap";

/** O boletim e a Palavra Viva do domingo (design: AdminInicio → Nesta semana), só para quem publica cada um. */
export function ThisWeek({ now }: { now: Date }) {
  const { can } = useAuth();
  const showBulletin = can("boletins.write");
  const showPost = can("mensagens.write");
  const bulletins = useQuery({
    ...adminBulletinsQuery({ year: null, page: 1 }),
    enabled: showBulletin,
  });
  const posts = useQuery({ ...adminPostsQuery(1), enabled: showPost });

  if (!showBulletin && !showPost) return null;

  const { last, next } = sundaysAround(now);

  return (
    <Card className="flex-[1_1_26rem]">
      <SectionHeader id="nesta-semana" title={home.week.title} />
      <ul aria-labelledby="nesta-semana" className="m-0 list-none p-0">
        {showBulletin ? (
          <BulletinRow
            items={bulletins.data?.data}
            failed={bulletins.isError}
            onRetry={() => void bulletins.refetch()}
            sunday={next}
          />
        ) : null}
        {showPost ? (
          <PostRow
            items={posts.data?.data}
            failed={posts.isError}
            onRetry={() => void posts.refetch()}
            since={last}
          />
        ) : null}
      </ul>
    </Card>
  );
}

function LoadingRow() {
  return (
    <li className="px-5 py-4">
      <Skeleton aria-hidden="true" className="h-9 w-full" />
    </li>
  );
}

function ErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-muted-foreground">
      {home.week.error}
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 cursor-pointer font-semibold text-primary underline"
      >
        {messages.common.retry}
      </button>
    </li>
  );
}

function BulletinRow({
  items,
  failed,
  onRetry,
  sunday,
}: {
  items: AdminBulletin[] | undefined;
  failed: boolean;
  onRetry: () => void;
  sunday: string;
}) {
  if (failed) return <ErrorRow onRetry={onRetry} />;
  if (items === undefined) return <LoadingRow />;

  const bulletin = items.find((item) => item.reference_date.slice(0, 10) === sunday);
  const icon = <FileTextIcon className="size-[18px]" />;

  if (bulletin === undefined) {
    return (
      <WeekRow
        icon={icon}
        text={home.week.bulletinMissing}
        link={
          <Link to="/admin/boletins/novo" className={rowLink}>
            {home.week.bulletinPublish}
          </Link>
        }
      />
    );
  }

  return (
    <WeekRow
      icon={icon}
      text={
        bulletin.status === "PUBLICADO" ? home.week.bulletinPublished : home.week.bulletinScheduled
      }
      detail={formatIsoDateLong(sunday)}
      link={
        <Link to={`/admin/boletins/${bulletin.id}`} className={rowLink}>
          {home.week.bulletinOpen}
        </Link>
      }
    />
  );
}

function PostRow({
  items,
  failed,
  onRetry,
  since,
}: {
  items: AdminPost[] | undefined;
  failed: boolean;
  onRetry: () => void;
  since: string;
}) {
  if (failed) return <ErrorRow onRetry={onRetry} />;
  if (items === undefined) return <LoadingRow />;

  const icon = <MessageSquareTextIcon className="size-[18px]" />;
  // A mensagem do último domingo (ou de hoje, se hoje é domingo) em diante, já publicada
  const post = items.find(
    (item) => item.status === "PUBLICADO" && toDateInput(item.published_at) >= since,
  );

  if (post === undefined) {
    return (
      <WeekRow
        icon={icon}
        text={home.week.postMissing}
        link={
          <Link to="/admin/palavra-viva/nova" className={rowLink}>
            {home.week.postWrite}
          </Link>
        }
      />
    );
  }

  return (
    <WeekRow
      icon={<CalendarCheckIcon className="size-[18px]" />}
      text={home.week.postPublished}
      detail={formatIsoDateLong(toDateInput(post.published_at))}
      link={
        <Link to={`/admin/palavra-viva/${post.id}`} className={rowLink}>
          {home.week.postOpen}
        </Link>
      }
    />
  );
}
