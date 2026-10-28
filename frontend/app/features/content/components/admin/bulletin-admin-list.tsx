import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { formatIsoDate } from "~/shared/format";
import { messages } from "~/shared/messages";
import { buttonClassName } from "~/shared/ui/button-variants";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { StatusBadge } from "~/shared/ui/status-badge";
import { contentAdminMessages } from "../../admin-messages";
import { adminBulletinsQuery, type AdminBulletin } from "../../admin-api";
import { PageLinks, whenLabel } from "./form-parts";

const { bulletins: text, list: listText } = contentAdminMessages;

const YEARS_OFFERED = 10;

function filtersFromParams(params: URLSearchParams): { year: number | null; page: number } {
  const year = Number(params.get("ano"));
  const page = Number(params.get("pagina"));

  return {
    year: Number.isInteger(year) && year >= 1985 && year <= 2100 ? year : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * A lista de boletins do painel (design: AdminBoletins; CAP-02): todas as edições, inclusive as agendadas, com filtro de
 * ano na URL e paginação. A permissão (`boletins.write`) é do guard da rota; a API recusa de qualquer jeito (BR-076).
 */
export function BulletinAdminList() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const query = useQuery(adminBulletinsQuery(filters));

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: YEARS_OFFERED }, (_, index) => thisYear - index);
  const hrefFor = (page: number) => {
    const next = new URLSearchParams();
    if (filters.year !== null) next.set("ano", String(filters.year));
    if (page > 1) next.set("pagina", String(page));
    const search = next.toString();
    return `/admin/boletins${search ? `?${search}` : ""}`;
  };

  const columns: DataTableColumn<AdminBulletin>[] = [
    {
      id: "edition",
      header: text.columns.edition,
      className: "whitespace-nowrap",
      cell: (bulletin) => (
        <Link
          to={`/admin/boletins/${bulletin.id}`}
          className="flex min-h-12 items-center font-bold text-foreground"
        >
          {text.edition(bulletin.edition_number)}
        </Link>
      ),
    },
    {
      id: "sunday",
      header: text.columns.sunday,
      className: "whitespace-nowrap",
      cell: (bulletin) => formatIsoDate(bulletin.reference_date),
    },
    { id: "title", header: text.columns.title, cell: (bulletin) => bulletin.title },
    {
      id: "status",
      header: text.columns.status,
      cell: (bulletin) => (
        <span className="flex flex-col items-start gap-0.5 py-2">
          <StatusBadge tone={bulletin.status === "PUBLICADO" ? "success" : "info"}>
            {bulletin.status === "PUBLICADO" ? listText.published : listText.scheduled}
          </StatusBadge>
          <span className="text-[13px] text-muted-foreground">
            {bulletin.status === "PUBLICADO"
              ? listText.publishedAt(whenLabel(bulletin.published_at))
              : listText.scheduledFor(whenLabel(bulletin.published_at))}
          </span>
        </span>
      ),
    },
    {
      id: "actions",
      header: listText.actions,
      align: "end",
      hideInCard: true,
      cell: (bulletin) => (
        <Link
          to={`/admin/boletins/${bulletin.id}`}
          aria-label={text.editBulletin(bulletin.edition_number)}
          className="inline-flex min-h-12 items-center px-2 font-bold"
        >
          {text.edit}
        </Link>
      ),
    },
  ];

  const total = query.data?.meta.total ?? 0;

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
          to="/admin/boletins/novo"
          className={buttonClassName({ size: "lg", className: "gap-2 px-4.5 font-bold" })}
        >
          <PlusIcon aria-hidden="true" className="size-[18px]" />
          {text.newBulletin}
        </Link>
      </header>

      <section
        aria-labelledby="t-lista"
        className="overflow-hidden rounded-[14px] border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 id="t-lista" className="m-0 text-[17px] font-extrabold">
            {text.editionsOf(filters.year)}
          </h2>
          <span className="flex items-center gap-2">
            <label htmlFor="f-ano" className="text-sm font-bold">
              {text.year}
            </label>
            <NativeSelect
              id="f-ano"
              value={filters.year ?? ""}
              onChange={(event) => {
                const year = Number(event.target.value);
                setParams(event.target.value === "" ? {} : { ano: String(year) });
              }}
            >
              <NativeSelectOption value="">{text.allYears}</NativeSelectOption>
              {years.map((year) => (
                <NativeSelectOption key={year} value={year}>
                  {year}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </span>
        </div>

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
              getRowId={(bulletin) => bulletin.id}
              isLoading={query.isPending}
              empty={<EmptyState title={text.empty} description={text.emptyHint} />}
            />
            {query.data ? (
              <PageLinks
                page={query.data.meta.page}
                lastPage={query.data.meta.last_page}
                total={total}
                perPage={query.data.meta.per_page}
                hrefFor={hrefFor}
              />
            ) : null}
          </>
        )}
      </section>
      <p className="sr-only" aria-live="polite">
        {query.isFetching && !query.isPending ? messages.common.loading : ""}
      </p>
    </div>
  );
}
