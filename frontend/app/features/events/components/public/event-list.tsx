import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { formatDate } from "~/shared/format";
import { messages } from "~/shared/messages";
import { badgeVariants } from "~/shared/ui/badge-variants";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { isApiError } from "~/shared/http/errors";
import { formatCardDate, registrationStatus, statusLabel } from "../../event-presentation";
import { publicEventsQuery, type PublicEventSummary } from "../../public-api";
import { publicEventMessages as text } from "../../public-messages";

function pageFromParams(params: URLSearchParams): number {
  const value = params.get("pagina");
  if (value === null || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= 100_000 ? page : 1;
}

const BADGE_BY_STATUS = {
  open: "success",
  full: "secondary",
  closed: "warning",
  held: "secondary",
} as const;

function EventCard({ event }: { event: PublicEventSummary }) {
  const status = registrationStatus(event);

  return (
    <li className="flex flex-[1_1_20rem] flex-col overflow-hidden rounded-2xl border border-border">
      {event.banner_small_url ? (
        <img
          src={event.banner_small_url}
          alt=""
          width={800}
          height={450}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={text.bannerPlaceholder}
          className="flex aspect-video items-center justify-center bg-muted text-muted-foreground"
        >
          <CalendarIcon aria-hidden="true" className="size-10" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5 px-5 pt-4 pb-5">
        <span className="text-sm font-bold text-primary">{formatCardDate(event.starts_at)}</span>
        <h3 className="m-0 text-[19px] leading-snug font-extrabold">{event.title}</h3>
        {event.ministry ? (
          <span className="text-[15px] text-muted-foreground">{event.ministry.name}</span>
        ) : null}
        <span className={badgeVariants({ variant: BADGE_BY_STATUS[status], className: "mt-1" })}>
          {statusLabel(event)}
        </span>
        <Link
          to={`/eventos/${event.slug}`}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 self-start font-bold text-primary underline-offset-4 hover:text-primary-hover hover:underline"
        >
          {text.seeEvent}
          <span className="sr-only">: {event.title}</span>
          <ChevronRightIcon aria-hidden="true" className="size-[18px] flex-none" />
        </Link>
      </div>
    </li>
  );
}

/**
 * A lista pública de eventos (design: Eventos; CAP-18, R2): os próximos em cartões, com a situação das inscrições, e os
 * anteriores numa lista simples. Vem de uma consulta só (`include_past`): os próximos primeiro, em ordem de data, e os
 * que já aconteceram depois, do mais recente ao mais antigo. A paginação é de 12 em 12, com o número na URL. `unavailable`
 * é o que se mostra quando a API responde 404 (funcionalidade desligada).
 */
export function EventList({ unavailable }: { unavailable: ReactNode }) {
  const [params] = useSearchParams();
  const page = pageFromParams(params);
  const query = useQuery(publicEventsQuery(page));

  // Com a flag `events` desligada a API responde 404: a página é a de "não encontrado", como se não existisse
  if (query.isError && isApiError(query.error) && query.error.status === 404) return unavailable;

  if (query.isError) {
    return (
      <section aria-label={text.listLabel} className="container py-8">
        <ErrorState
          message={isApiError(query.error) ? query.error.message : messages.errors.generic}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </section>
    );
  }

  if (query.isPending) {
    return (
      <section aria-label={text.listLabel} className="container py-8">
        <LoadingBlock count={3} itemClassName="h-40" />
      </section>
    );
  }

  const upcoming = query.data.data.filter((event) => registrationStatus(event) !== "held");
  const past = query.data.data.filter((event) => registrationStatus(event) === "held");
  const { last_page: lastPage } = query.data.meta;

  return (
    <>
      <section aria-labelledby="proximos" className="container pt-6 pb-2">
        <div className="flex flex-col gap-4">
          <h2 id="proximos" className="m-0 text-[22px] leading-tight">
            {text.upcoming}
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon />}
              title={past.length === 0 ? text.noEvents : text.noUpcoming}
              description={text.noUpcomingHint}
            />
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="anteriores" className="container pt-8 pb-12">
          <div className="flex flex-col gap-3">
            <h2 id="anteriores" className="m-0 text-[22px] leading-tight">
              {text.past}
            </h2>
            <ul className="m-0 list-none border-t border-border p-0">
              {past.map((event) => (
                <li key={event.id} className="border-b border-border">
                  <Link
                    to={`/eventos/${event.slug}`}
                    className="flex min-h-16 flex-col justify-center px-1 py-2 text-foreground no-underline hover:bg-muted"
                  >
                    <span className="font-bold">{event.title}</span>
                    <span className="text-[15px] text-muted-foreground">
                      {formatDate(event.starts_at)}
                      {event.ministry ? ` · ${event.ministry.name}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {lastPage > 1 ? (
        <nav
          aria-label={text.pagination}
          className="container flex items-center justify-between gap-3 pb-12"
        >
          {page > 1 ? (
            <Link
              to={page - 1 === 1 ? "/eventos" : `/eventos?pagina=${page - 1}`}
              rel="prev"
              className="inline-flex min-h-11 items-center px-3.5 font-semibold text-primary hover:underline"
            >
              {text.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[15px] text-muted-foreground">{text.pageOf(page, lastPage)}</span>
          {page < lastPage ? (
            <Link
              to={`/eventos?pagina=${page + 1}`}
              rel="next"
              className="inline-flex min-h-11 items-center px-3.5 font-bold text-primary hover:underline"
            >
              {text.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
