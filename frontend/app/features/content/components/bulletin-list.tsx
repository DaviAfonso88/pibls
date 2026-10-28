import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { formatFileSize, formatIsoDate } from "~/shared/format";
import { messages } from "~/shared/messages";
import { buttonClassName } from "~/shared/ui/button-variants";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { bulletinsQuery, type BulletinFilters, type PublicBulletin } from "../public-api";
import { publicContentMessages as text } from "../messages";
import { SimplePager } from "./simple-pager";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Quantos anos o filtro oferece, do atual para trás. */
const YEARS_OFFERED = 10;

function toNumber(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

/** Lê o filtro da URL (`ano`, `mes`, `pagina`): valor inválido vira "sem filtro", nunca um erro. */
export function bulletinFiltersFromParams(params: URLSearchParams): BulletinFilters {
  const year = toNumber(params.get("ano"), 1985, 2100);

  return {
    year,
    month: year === null ? null : toNumber(params.get("mes"), 1, 12),
    page: toNumber(params.get("pagina"), 1, 100_000) ?? 1,
  };
}

function paramsFromFilters(filters: BulletinFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.year !== null) params.set("ano", String(filters.year));
  if (filters.year !== null && filters.month !== null) params.set("mes", String(filters.month));
  if (filters.page > 1) params.set("pagina", String(filters.page));
  return params;
}

function BulletinCard({ bulletin }: { bulletin: PublicBulletin }) {
  return (
    <li className="flex flex-[1_1_20rem] flex-col gap-1.5 rounded-2xl border border-border p-5">
      <span className="text-sm font-bold text-primary">
        {text.bulletinMeta(bulletin.edition_number, formatIsoDate(bulletin.reference_date))}
      </span>
      <h2 className="m-0 text-[19px] leading-snug font-extrabold">{bulletin.title}</h2>
      {bulletin.summary_text ? (
        <p className="m-0 text-muted-foreground">{bulletin.summary_text}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3">
        {/* PDF em nova aba, sem entregar `window.opener` ao arquivo */}
        <a
          href={bulletin.pdf_url}
          target="_blank"
          rel="noopener"
          className={buttonClassName({
            size: "lg",
            className: "flex-[1_1_8rem] gap-2 px-3.5 font-bold",
          })}
        >
          <ExternalLinkIcon aria-hidden="true" className="size-[18px]" />
          {text.readBulletin}
          <span className="sr-only"> {text.opensInNewTab}</span>
        </a>
        <a
          href={bulletin.pdf_url}
          download
          className={buttonClassName({
            variant: "outline",
            size: "lg",
            className: "flex-[1_1_8rem] gap-2 px-3.5 font-bold",
          })}
        >
          <DownloadIcon aria-hidden="true" className="size-[18px]" />
          {text.downloadPdf}
          <span className="sr-only"> ({formatFileSize(bulletin.pdf_size_bytes)})</span>
        </a>
      </div>
    </li>
  );
}

/**
 * A lista pública de boletins (design: Boletins; CAP-02): filtro por ano e mês que mora na URL, cards com "Ler boletim"
 * (nova aba) e "Baixar PDF", e paginação de 12 em 12. Boletim agendado não chega aqui (BR-042).
 */
export function BulletinList() {
  const [params, setParams] = useSearchParams();
  const filters = bulletinFiltersFromParams(params);
  const query = useQuery(bulletinsQuery(filters));

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: YEARS_OFFERED }, (_, index) => thisYear - index);
  const filtered = filters.year !== null;
  const hrefFor = (page: number) => {
    const search = paramsFromFilters({ ...filters, page }).toString();
    return `/boletins${search ? `?${search}` : ""}`;
  };

  return (
    <>
      <section aria-label={text.filterLabel} className="container pt-6 pb-2">
        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-wrap gap-3"
          aria-label={text.filterLabel}
        >
          <div className="flex max-w-60 flex-[1_1_8.5rem] flex-col gap-1.5">
            <label htmlFor="filtro-ano" className="text-[15px] font-bold">
              {text.year}
            </label>
            <NativeSelect
              id="filtro-ano"
              className="w-full"
              value={filters.year ?? ""}
              onChange={(event) => {
                const year = toNumber(event.target.value, 1985, 2100);
                setParams(paramsFromFilters({ year, month: null, page: 1 }));
              }}
            >
              <NativeSelectOption value="">{text.allYears}</NativeSelectOption>
              {years.map((year) => (
                <NativeSelectOption key={year} value={year}>
                  {year}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex max-w-60 flex-[1_1_8.5rem] flex-col gap-1.5">
            <label htmlFor="filtro-mes" className="text-[15px] font-bold">
              {text.month}
            </label>
            <NativeSelect
              id="filtro-mes"
              className="w-full"
              value={filters.month ?? ""}
              disabled={!filtered}
              onChange={(event) =>
                setParams(
                  paramsFromFilters({
                    year: filters.year,
                    month: toNumber(event.target.value, 1, 12),
                    page: 1,
                  }),
                )
              }
            >
              <NativeSelectOption value="">{text.allMonths}</NativeSelectOption>
              {MONTHS.map((name, index) => (
                <NativeSelectOption key={name} value={index + 1}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </form>
      </section>

      <section aria-label={text.listLabel} className="container pt-4 pb-12">
        <div className="flex flex-col gap-5">
          {query.isError ? (
            <ErrorState
              message={messages.errors.generic}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : query.isPending ? (
            <LoadingBlock count={4} />
          ) : query.data.data.length === 0 ? (
            <EmptyState
              icon={<FileTextIcon />}
              title={filtered ? text.noBulletinsInPeriod : text.noBulletins}
              description={filtered ? text.chooseAnotherMonth : undefined}
              action={
                filtered ? (
                  <Link
                    to="/boletins"
                    className={buttonClassName({ variant: "outline", size: "lg" })}
                  >
                    {text.seeAllBulletins}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
                {query.data.data.map((bulletin) => (
                  <BulletinCard key={bulletin.id} bulletin={bulletin} />
                ))}
              </ul>
              <SimplePager
                page={query.data.meta.page}
                lastPage={query.data.meta.last_page}
                hrefFor={hrefFor}
              />
            </>
          )}
        </div>
      </section>
    </>
  );
}
