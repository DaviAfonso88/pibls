import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { formatDateTime } from "~/shared/format";
import { buttonClassName } from "~/shared/ui/button-variants";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { FormField } from "~/shared/ui/form-field";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { StatusBadge, type StatusTone } from "~/shared/ui/status-badge";
import {
  EVENT_STATES,
  adminEventsQuery,
  type AdminEvent,
  type AdminEventFilters,
  type EventState,
} from "../../admin-api";
import { eventAdminMessages } from "../../admin-messages";
import { registrationsAdminMessages as registrationsText } from "../../registrations-messages";
import { PageLinks } from "./form-parts";
import type { MinistryOption } from "./event-form";

const { list: text, stateShort } = eventAdminMessages;

const STATE_TONE: Record<EventState, StatusTone> = {
  RASCUNHO: "neutral",
  INSCRICOES_ABERTAS: "success",
  INSCRICOES_ENCERRADAS: "warning",
  REALIZADO: "info",
};

function isState(value: string | null): value is EventState {
  return value !== null && (EVENT_STATES as readonly string[]).includes(value);
}

function filtersFromParams(params: URLSearchParams): AdminEventFilters {
  const state = params.get("situacao");
  const page = Number(params.get("pagina"));
  const ministry = Number(params.get("ministerio"));

  return {
    state: isState(state) ? state : null,
    ministryId: Number.isInteger(ministry) && ministry >= 1 ? ministry : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

function hrefFor(filters: AdminEventFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.state !== null) params.set("situacao", filters.state);
  if (filters.ministryId !== null) params.set("ministerio", String(filters.ministryId));
  if (page > 1) params.set("pagina", String(page));

  const query = params.toString();
  return `/admin/eventos${query === "" ? "" : `?${query}`}`;
}

/**
 * A lista de eventos no painel (CAP-12): do início mais distante ao mais próximo, com a situação, o ministério e as vagas.
 * Os filtros moram na URL (endereço compartilhável, botão voltar). Quem só tem `eventos.write.own` recebe do servidor
 * apenas os eventos do próprio ministério (BR-030). A permissão é do guard da rota; a API recusa de qualquer jeito (BR-076).
 */
export function EventAdminList({ ministries }: { ministries: readonly MinistryOption[] }) {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const query = useQuery(adminEventsQuery(filters));
  const filtered = filters.state !== null || filters.ministryId !== null;

  function setFilter(name: "situacao" | "ministerio", value: string) {
    const next = new URLSearchParams(params);
    if (value === "") next.delete(name);
    else next.set(name, value);
    next.delete("pagina");
    setParams(next);
  }

  const columns: DataTableColumn<AdminEvent>[] = [
    {
      id: "title",
      header: text.columns.title,
      cell: (event) => (
        <Link
          to={`/admin/eventos/${event.id}`}
          className="flex min-h-12 items-center font-bold text-foreground"
        >
          {event.title}
        </Link>
      ),
    },
    {
      id: "date",
      header: text.columns.date,
      className: "whitespace-nowrap tabular-nums",
      cell: (event) => formatDateTime(event.starts_at),
    },
    {
      id: "ministry",
      header: text.columns.ministry,
      cell: (event) => event.ministry?.name ?? "—",
    },
    {
      id: "status",
      header: text.columns.status,
      cell: (event) => (
        <StatusBadge tone={STATE_TONE[event.registration.state]}>
          {stateShort[event.registration.state]}
        </StatusBadge>
      ),
    },
    {
      id: "spots",
      header: text.columns.spots,
      className: "whitespace-nowrap tabular-nums",
      cell: (event) => text.spots(event.registrations_count, event.max_spots ?? null),
    },
    {
      id: "actions",
      header: text.actions,
      align: "end",
      hideInCard: true,
      cell: (event) => (
        <span className="inline-flex flex-wrap justify-end gap-1">
          <Link
            to={`/admin/eventos/${event.id}/inscritos`}
            aria-label={registrationsText.viewRegistrationsOf(event.title)}
            className="inline-flex min-h-12 items-center px-2 font-bold"
          >
            {registrationsText.title}
          </Link>
          <Link
            to={`/admin/eventos/${event.id}`}
            aria-label={text.editEvent(event.title)}
            className="inline-flex min-h-12 items-center px-2 font-bold"
          >
            {text.edit}
          </Link>
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${text.title} — Painel PIBLS`}</title>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
            {text.title}
          </h1>
          <p className="m-0 text-muted-foreground">{text.intro}</p>
        </div>
        <Link
          to="/admin/eventos/novo"
          className={buttonClassName({ size: "lg", className: "gap-2 px-4.5 font-bold" })}
        >
          <PlusIcon aria-hidden="true" className="size-[18px]" />
          {text.newEvent}
        </Link>
      </header>

      <form
        role="search"
        aria-label={text.filtersLabel}
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-wrap items-end gap-4 rounded-[14px] border border-border bg-card p-4"
      >
        <FormField id="filtro-situacao" label={text.state}>
          {(control) => (
            <NativeSelect
              {...control}
              value={filters.state ?? ""}
              onChange={(event) => setFilter("situacao", event.target.value)}
            >
              <NativeSelectOption value="">{text.allStates}</NativeSelectOption>
              {EVENT_STATES.map((state) => (
                <NativeSelectOption key={state} value={state}>
                  {stateShort[state]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        {ministries.length > 1 ? (
          <FormField id="filtro-ministerio" label={text.ministryFilter}>
            {(control) => (
              <NativeSelect
                {...control}
                value={filters.ministryId === null ? "" : String(filters.ministryId)}
                onChange={(event) => setFilter("ministerio", event.target.value)}
              >
                <NativeSelectOption value="">{text.allMinistries}</NativeSelectOption>
                {ministries.map((ministry) => (
                  <NativeSelectOption key={ministry.id} value={String(ministry.id)}>
                    {ministry.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        ) : null}
      </form>

      <section className="overflow-hidden rounded-[14px] border border-border bg-card">
        {query.isError ? (
          <div className="p-5">
            <ErrorState
              message={text.loadError}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          </div>
        ) : (
          <>
            <DataTable
              caption={text.title}
              columns={columns}
              rows={query.data?.data ?? []}
              getRowId={(event) => event.id}
              isLoading={query.isPending}
              empty={
                <EmptyState
                  title={filtered ? text.emptyFiltered : text.empty}
                  description={filtered ? undefined : text.emptyHint}
                />
              }
            />
            {query.data ? (
              <PageLinks
                page={query.data.meta.page}
                lastPage={query.data.meta.last_page}
                total={query.data.meta.total}
                perPage={query.data.meta.per_page}
                hrefFor={(target) => hrefFor(filters, target)}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
