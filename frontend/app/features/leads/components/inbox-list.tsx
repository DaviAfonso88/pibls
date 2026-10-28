import { useQuery } from "@tanstack/react-query";
import { type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { formatDate, formatTime } from "~/shared/format";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { buttonClassName } from "~/shared/ui/button-variants";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { Input } from "~/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { StatusBadge, type StatusTone } from "~/shared/ui/status-badge";
import {
  DEFAULT_STATUS_FILTER,
  inboxQuery,
  type Inbox,
  type InboxFilters,
  type LeadListItem,
  type LeadStatus,
} from "../admin-api";
import { inboxMessages } from "../inbox-messages";

const { filters: filterText, list: listText } = inboxMessages;

const STATUS_TONE: Record<LeadStatus, StatusTone> = {
  NOVO: "info",
  EM_ATENDIMENTO: "neutral",
  CONCLUIDO: "success",
};

/** `15/10 · 19h48`, na hora de Brasília (design: AdminContatos). */
export function formatReceived(iso: string): string {
  return `${formatDate(iso).slice(0, 5)} · ${formatTime(iso)}`;
}

/** O caminho de um contato no painel: a caixa de oração tem rota própria (BR-007). */
export function leadPath(inbox: Inbox, id: number): string {
  return `${inbox === "oracao" ? "/admin/oracao" : "/admin/contatos"}/${id}`;
}

/** Lê os filtros da URL (`tipo`, `status`, `resp`, `q`, `pagina`). Sem `status` na URL vale o padrão: contatos abertos. */
export function filtersFromParams(params: URLSearchParams, inbox: Inbox): InboxFilters {
  const page = Number(params.get("pagina"));

  return {
    type: inbox === "geral" ? (params.get("tipo") ?? "") : "",
    status: params.get("status") ?? DEFAULT_STATUS_FILTER,
    assignee: params.get("resp") ?? "",
    q: params.get("q") ?? "",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** O contrário: só vai para a URL o que difere do padrão, para o endereço ficar curto e compartilhável. */
export function paramsFromFilters(filters: Omit<InboxFilters, "page">): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.type) params.set("tipo", filters.type);
  if (filters.status !== DEFAULT_STATUS_FILTER) params.set("status", filters.status);
  if (filters.assignee) params.set("resp", filters.assignee);
  if (filters.q.trim().length > 0) params.set("q", filters.q.trim());
  return params;
}

function Filters({
  inbox,
  current,
  onApply,
}: {
  inbox: Inbox;
  current: InboxFilters;
  onApply: (filters: Omit<InboxFilters, "page">) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    onApply({
      type: text("tipo"),
      status: text("status"),
      assignee: text("resp"),
      q: text("q"),
    });
  }

  const fieldClass = "flex flex-1 basis-44 flex-col gap-1.5";
  const labelClass = "text-sm font-bold";

  return (
    <form
      aria-label={filterText.label}
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-[14px] border border-border bg-card p-4"
    >
      {inbox === "geral" ? (
        <div className={fieldClass}>
          <label htmlFor="f-tipo" className={labelClass}>
            {filterText.type}
          </label>
          <NativeSelect id="f-tipo" name="tipo" className="w-full" defaultValue={current.type}>
            <NativeSelectOption value="">{filterText.allTypes}</NativeSelectOption>
            {(["VISITANTE", "MEMBRO", "CONTATO", "MINISTERIO"] as const).map((type) => (
              <NativeSelectOption key={type} value={type}>
                {inboxMessages.types[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className={fieldClass}>
        <label htmlFor="f-status" className={labelClass}>
          {filterText.status}
        </label>
        <NativeSelect id="f-status" name="status" className="w-full" defaultValue={current.status}>
          <NativeSelectOption value={DEFAULT_STATUS_FILTER}>{filterText.open}</NativeSelectOption>
          <NativeSelectOption value="NOVO">{inboxMessages.statuses.NOVO}</NativeSelectOption>
          <NativeSelectOption value="EM_ATENDIMENTO">
            {inboxMessages.statuses.EM_ATENDIMENTO}
          </NativeSelectOption>
          <NativeSelectOption value="CONCLUIDO">
            {inboxMessages.statuses.CONCLUIDO}
          </NativeSelectOption>
          <NativeSelectOption value="">{filterText.allStatuses}</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className={fieldClass}>
        <label htmlFor="f-resp" className={labelClass}>
          {filterText.assignee}
        </label>
        <NativeSelect id="f-resp" name="resp" className="w-full" defaultValue={current.assignee}>
          <NativeSelectOption value="">{filterText.anyone}</NativeSelectOption>
          <NativeSelectOption value="me">{filterText.me}</NativeSelectOption>
          <NativeSelectOption value="none">{filterText.none}</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex flex-[2_1_14rem] flex-col gap-1.5">
        <label htmlFor="f-busca" className={labelClass}>
          {filterText.search}
        </label>
        <Input
          id="f-busca"
          name="q"
          type="search"
          minLength={2}
          maxLength={100}
          defaultValue={current.q}
          aria-describedby="f-busca-dica"
        />
        <span id="f-busca-dica" className="sr-only">
          {filterText.searchHint}
        </span>
      </div>
      <button
        type="submit"
        className={buttonClassName({ variant: "outline", className: "px-4 font-bold" })}
      >
        {filterText.submit}
      </button>
    </form>
  );
}

function Pagination({
  page,
  lastPage,
  total,
  perPage,
  hrefFor,
}: {
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  hrefFor: (page: number) => string;
}) {
  if (lastPage <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const first = Math.max(1, Math.min(page - 2, lastPage - 4));
  const pages = Array.from({ length: Math.min(5, lastPage) }, (_, index) => first + index);
  const pageClass = (active: boolean) =>
    buttonClassName({
      variant: active ? "default" : "outline",
      className: "min-w-11 justify-center px-3 font-semibold",
    });

  return (
    <nav
      aria-label={listText.pagesLabel}
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
    >
      <span className="text-sm text-muted-foreground">{listText.showing(from, to, total)}</span>
      <span className="flex flex-wrap gap-1.5">
        {page > 1 ? (
          <Link to={hrefFor(page - 1)} className={pageClass(false)} rel="prev">
            {listText.previous}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${pageClass(false)} pointer-events-none opacity-50`}
          >
            {listText.previous}
          </span>
        )}
        {pages.map((number) => (
          <Link
            key={number}
            to={hrefFor(number)}
            aria-current={number === page ? "page" : undefined}
            aria-label={listText.page(number)}
            className={pageClass(number === page)}
          >
            {number}
          </Link>
        ))}
        {page < lastPage ? (
          <Link to={hrefFor(page + 1)} className={pageClass(false)} rel="next">
            {listText.next}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${pageClass(false)} pointer-events-none opacity-50`}
          >
            {listText.next}
          </span>
        )}
      </span>
    </nav>
  );
}

/**
 * A caixa de contatos (design: AdminContatos; CAP-10 e CAP-11): filtros que moram na URL (endereço compartilhável, botão
 * Voltar funciona), tabela com destaque para quem espera há mais de 3 dias (BR-010) e paginação. A caixa de oração é a
 * mesma tela, sem o filtro de tipo. A permissão da caixa é do guard da rota; a API recusa de qualquer jeito (BR-076).
 */
export function InboxList({ inbox }: { inbox: Inbox }) {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params, inbox);
  const query = useQuery(inboxQuery(inbox, filters));
  const text = inbox === "oracao" ? inboxMessages.prayer : inboxMessages.general;

  function apply(next: Omit<InboxFilters, "page">) {
    setParams(paramsFromFilters(next));
  }

  const hrefFor = (page: number) => {
    const next = paramsFromFilters(filters);
    if (page > 1) next.set("pagina", String(page));
    const search = next.toString();
    return `${inbox === "oracao" ? "/admin/oracao" : "/admin/contatos"}${search ? `?${search}` : ""}`;
  };

  const columns: DataTableColumn<LeadListItem>[] = [
    ...(inbox === "geral"
      ? [
          {
            id: "type",
            header: listText.type,
            cell: (lead: LeadListItem) => inboxMessages.types[lead.type],
            className: "whitespace-nowrap",
          },
        ]
      : []),
    {
      id: "name",
      header: listText.name,
      cell: (lead) => (
        <Link
          to={leadPath(inbox, lead.id)}
          className="flex min-h-12 items-center font-bold text-foreground"
        >
          {lead.name ?? listText.anonymous}
        </Link>
      ),
    },
    {
      id: "received",
      header: listText.received,
      className: "whitespace-nowrap",
      cell: (lead) => (
        <span className="flex flex-col">
          <span>{formatReceived(lead.created_at)}</span>
          {lead.waiting_days != null ? (
            <span className="text-[13px] font-bold text-warning-foreground">
              {listText.waiting(lead.waiting_days)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "status",
      header: listText.status,
      cell: (lead) => (
        <StatusBadge tone={STATUS_TONE[lead.status]}>
          {inboxMessages.statuses[lead.status]}
        </StatusBadge>
      ),
    },
    {
      id: "assignee",
      header: listText.assignee,
      cell: (lead) =>
        lead.assigned_to ? (
          <span className={lead.assigned_to.is_active ? undefined : "text-warning-foreground"}>
            {lead.assigned_to.name}
            {lead.assigned_to.is_active ? "" : listText.inactiveSuffix}
          </span>
        ) : (
          <span className="font-semibold text-destructive">{listText.noAssignee}</span>
        ),
    },
  ];

  const total = query.data?.meta.total ?? 0;
  const heading =
    filters.status === DEFAULT_STATUS_FILTER ? text.openCount(total) : text.allCount(total);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${text.title} — Painel PIBLS`}</title>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
          {text.title}
        </h1>
        <p className="m-0 text-muted-foreground">{text.intro}</p>
      </header>

      <Filters key={params.toString()} inbox={inbox} current={filters} onApply={apply} />

      <section
        aria-labelledby="lista"
        className="overflow-hidden rounded-[14px] border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <h2 id="lista" className="m-0 text-[17px] font-extrabold">
            {query.data ? heading : text.title}
          </h2>
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-3 rounded-[3px] border border-warning-foreground/40 bg-warning"
            />
            {listText.stalledLegend}
          </span>
        </div>

        {query.isError && !query.data ? (
          <ErrorState
            headingLevel="h3"
            title={listText.loadError}
            message={isApiError(query.error) ? query.error.message : messages.errors.generic}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : (
          <DataTable
            caption={inbox === "oracao" ? listText.captionPrayer : listText.caption}
            columns={columns}
            rows={query.data?.data ?? []}
            getRowId={(lead) => lead.id}
            isLoading={query.isPending}
            rowClassName={(lead) =>
              lead.waiting_days != null
                ? "bg-warning/40 shadow-[inset_4px_0_0_var(--color-warning-foreground)]"
                : undefined
            }
            empty={
              <EmptyState title={inbox === "oracao" ? listText.emptyPrayer : listText.empty} />
            }
            className="p-3 md:p-0"
          />
        )}

        {query.data ? (
          <Pagination
            page={query.data.meta.page}
            lastPage={query.data.meta.last_page}
            total={query.data.meta.total}
            perPage={query.data.meta.per_page}
            hrefFor={hrefFor}
          />
        ) : null}
      </section>
    </div>
  );
}
