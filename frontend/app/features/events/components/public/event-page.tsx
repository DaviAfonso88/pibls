import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, CalendarIcon, CheckIcon, ClockIcon, MapPinIcon } from "lucide-react";
import { lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { formatDateTime } from "~/shared/format";
import { isApiError } from "~/shared/http/errors";
import { LazyForm } from "~/shared/layout/form-page";
import { messages } from "~/shared/messages";
import { pageTitle } from "~/shared/seo/title";
import { badgeVariants } from "~/shared/ui/badge-variants";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { SanitizedHtml } from "~/shared/ui/sanitized-html";
import { formatWhen, registrationStatus } from "../../event-presentation";
import { publicEventQuery, type PublicEvent } from "../../public-api";
import { publicEventMessages as text } from "../../public-messages";
import type { RegistrationDone } from "./registration-form";

// O formulário (React Hook Form + Zod) vem por `React.lazy`, fora do JS inicial da página (orçamento de bundle, RNF-05)
const RegistrationForm = lazy(() => import("./registration-form"));

const backLink =
  "inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary underline-offset-4 hover:text-primary-hover hover:underline";

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 flex-none">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** "Evento não encontrado": rascunho, endereço que não existe ou flag desligada (a API responde 404 nos três). */
export function EventNotFound() {
  return (
    <div className="container flex max-w-[35rem] flex-col gap-4 py-14">
      {/* O título da aba e o noindex: uma página que não existe não entra no Google */}
      <title>{pageTitle(text.notFoundTitle)}</title>
      <meta name="robots" content="noindex" />
      <p className="m-0 text-sm font-bold tracking-wider text-primary uppercase">
        {text.notFoundEyebrow}
      </p>
      <h1 className="m-0 text-balance">{text.notFoundTitle}</h1>
      <p className="m-0 text-lg text-muted-foreground">{text.notFoundText}</p>
      <Link
        to="/eventos"
        className={buttonClassName({ size: "lg", className: "self-start px-5 font-bold" })}
      >
        {text.allEvents}
      </Link>
    </div>
  );
}

/**
 * Confirmação depois da inscrição (design: "Inscrição confirmada!"). Anunciada como `status`, e o foco vai para o título:
 * o formulário que tinha o foco sumiu. O servidor devolve o resumo; no caso do honeypot só vem `received`, então o que
 * falta sai do evento e do que a pessoa digitou.
 */
function RegistrationSuccess({ event, done }: { event: PublicEvent; done: RegistrationDone }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const { receipt } = done;

  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-2xl border border-success-foreground/30 bg-success p-6 text-success-foreground"
    >
      <div className="flex items-center gap-2.5">
        <CheckIcon aria-hidden="true" className="size-6 flex-none" strokeWidth={2.5} />
        <h2
          ref={heading}
          tabIndex={-1}
          className="m-0 text-[22px] leading-tight text-success-foreground"
        >
          {text.successTitle}
        </h2>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="font-bold">{text.successEvent}</dt>
        <dd className="m-0">{receipt.event_title ?? event.title}</dd>
        <dt className="font-bold">{text.successDate}</dt>
        <dd className="m-0">{formatDateTime(receipt.starts_at ?? event.starts_at)}</dd>
        <dt className="font-bold">{text.successParticipant}</dt>
        <dd className="m-0">{receipt.participant_name ?? done.participantName}</dd>
      </dl>
      <p className="m-0">{text.successEmail}</p>
      <Link
        to="/eventos"
        className="inline-flex min-h-11 items-center self-start font-bold underline"
      >
        {text.seeOthers}
      </Link>
    </div>
  );
}

/** O aviso no lugar do formulário: vagas esgotadas, inscrições encerradas ou evento já realizado. */
function ClosedNotice({
  event,
  status,
}: {
  event: PublicEvent;
  status: "full" | "closed" | "held";
}) {
  const deadline = event.registration.deadline;
  const deadlinePassed = deadline != null && new Date(deadline) <= new Date();

  if (status === "full") {
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded-2xl border border-border-strong bg-muted p-6"
      >
        <h2 className="m-0 text-xl">{text.fullTitle}</h2>
        <p className="m-0 text-muted-foreground">{text.fullText}</p>
        <Link
          to="/contato"
          className="inline-flex min-h-11 items-center self-start font-bold text-primary underline"
        >
          {text.talkToMinistry}
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-2xl border border-warning-foreground/30 bg-warning p-6 text-warning-foreground"
    >
      <h2 className="m-0 text-xl text-warning-foreground">
        {status === "held" ? text.heldTitle : text.closedTitle}
      </h2>
      <p className="m-0">
        {status === "held"
          ? text.heldText
          : deadlinePassed && deadline
            ? text.closedText(formatDateTime(deadline))
            : text.closedStarted}
      </p>
    </div>
  );
}

/** O evento carregado: o cabeçalho, a descrição e, conforme a situação, o formulário, o aviso ou a confirmação. */
function EventContent({ event }: { event: PublicEvent }) {
  const [done, setDone] = useState<RegistrationDone | null>(null);
  const status = registrationStatus(event);
  const { spots_left: spotsLeft, deadline } = event.registration;

  return (
    <article className="container pt-2 pb-12">
      <div className="mx-auto flex max-w-[47.5rem] flex-col gap-5">
        <title>{pageTitle(event.title)}</title>

        {event.banner_url ? (
          <img
            src={event.banner_url}
            alt=""
            width={1600}
            height={900}
            decoding="async"
            className="aspect-video w-full rounded-2xl object-cover"
          />
        ) : null}

        <header className="flex flex-col gap-2.5">
          {event.ministry ? (
            <p className="m-0 text-sm font-bold text-primary">{event.ministry.name}</p>
          ) : null}
          <h1 className="m-0 text-balance">{event.title}</h1>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-muted-foreground">
            <Fact icon={<CalendarIcon className="size-5" />}>
              <span className="sr-only">{text.whenLabel}: </span>
              {formatWhen(event.starts_at, event.ends_at)}
            </Fact>
            <Fact icon={<MapPinIcon className="size-5" />}>
              <span className="sr-only">{text.whereLabel}: </span>
              {event.location}
            </Fact>
            {deadline ? (
              <Fact icon={<ClockIcon className="size-5" />}>
                {text.deadlineUntil(formatDateTime(deadline))}
              </Fact>
            ) : null}
          </ul>
          {status === "open" && spotsLeft != null ? (
            <span className={badgeVariants({ variant: "success", className: "self-start" })}>
              {text.spotsLeft(spotsLeft)}
            </span>
          ) : null}
        </header>

        <SanitizedHtml html={event.description} />

        {done ? (
          <RegistrationSuccess event={event} done={done} />
        ) : status === "open" ? (
          <LazyForm>
            <RegistrationForm event={event} onRegistered={setDone} />
          </LazyForm>
        ) : (
          <ClosedNotice event={event} status={status} />
        )}
      </div>
    </article>
  );
}

/**
 * A página de um evento (design: Evento e inscrição; CAP-19, R2): lê o evento pelo endereço, mostra as vagas atualizadas a
 * cada 30 s e escolhe entre o formulário, o aviso de esgotado ou encerrado e a confirmação. Evento que não existe ou não
 * está publicado mostra "Evento não encontrado".
 */
export function EventPage({ slug }: { slug: string }) {
  const query = useQuery(publicEventQuery(slug));
  const notFound = query.isError && isApiError(query.error) && query.error.status === 404;

  if (notFound) return <EventNotFound />;

  return (
    <>
      <div className="container pt-2">
        <div className="mx-auto max-w-[47.5rem]">
          <Link to="/eventos" className={backLink}>
            <ArrowLeftIcon aria-hidden="true" className="size-[18px] flex-none" />
            {text.allEvents}
          </Link>
        </div>
      </div>

      {query.isError ? (
        <div className="container py-8">
          <ErrorState
            message={isApiError(query.error) ? query.error.message : messages.errors.generic}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        </div>
      ) : query.isPending ? (
        <div className="container py-6">
          <LoadingBlock count={4} itemClassName="h-24" />
        </div>
      ) : (
        <EventContent event={query.data} />
      )}
    </>
  );
}
