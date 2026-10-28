import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { isApiError } from "~/shared/http/errors";
import { downloadFile, saveBlob } from "~/shared/http/download";
import { Button } from "~/shared/ui/button";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { Input } from "~/shared/ui/input";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Spinner } from "~/shared/ui/spinner";
import { adminEventQuery } from "../../admin-api";
import { eventAdminMessages } from "../../admin-messages";
import { pdfFilename, renderRegistrationsPdf } from "../../pdf-export";
import { registrationColumns } from "../../registration-columns";
import {
  cancelRegistration,
  fetchAllRegistrations,
  registrationsCsvPath,
  registrationsQuery,
  type AdminRegistration,
  type CancelReason,
  type RegistrationsFilters,
} from "../../registrations-api";
import { registrationsAdminMessages as text } from "../../registrations-messages";
import { CancelRegistrationDialog } from "./cancel-registration-dialog";
import { PageLinks } from "./form-parts";

const SEARCH_DELAY_MS = 350;

function filtersFromParams(params: URLSearchParams): RegistrationsFilters {
  const page = Number(params.get("pagina"));

  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    search: (params.get("busca") ?? "").trim(),
  };
}

function hrefFor(eventId: number, filters: RegistrationsFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.search !== "") params.set("busca", filters.search);
  if (page > 1) params.set("pagina", String(page));

  const query = params.toString();
  return `/admin/eventos/${eventId}/inscritos${query === "" ? "" : `?${query}`}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}

/**
 * Os inscritos de um evento no painel (design: AdminInscritos; CAP-15, FR-060 a FR-062): o contador de vagas, a lista com as
 * respostas na ordem do formulário, a busca, a exportação em CSV (gerada no servidor) e em PDF (gerada aqui, com o
 * `pdfmake` carregado só no clique) e o cancelamento com confirmação, que devolve a vaga. A permissão de ver é do guard da
 * rota e a de cancelar, de `canCancel`; o servidor confere as duas de novo (BR-076).
 */
export function RegistrationsPage({ eventId, canCancel }: { eventId: number; canCancel: boolean }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const [term, setTerm] = useState(filters.search);
  const [target, setTarget] = useState<AdminRegistration | null>(null);
  const [status, setStatus] = useState("");

  const eventQuery = useQuery(adminEventQuery(eventId));
  const listQuery = useQuery(registrationsQuery(eventId, filters));
  const event = eventQuery.data;

  // A busca vai para a URL um instante depois de a pessoa parar de digitar
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === filters.search) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (trimmed === "") next.delete("busca");
      else next.set("busca", trimmed);
      next.delete("pagina");
      setParams(next, { replace: true });
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [term, filters.search, params, setParams]);

  const csv = useMutation({
    mutationFn: async () => {
      const file = await downloadFile(registrationsCsvPath(eventId));
      saveBlob(file.blob, file.filename ?? `inscritos-${event?.slug ?? eventId}.csv`);
    },
    onSuccess: () => toast.success(text.csvDone),
    onError: (error) => toast.error(errorMessage(error, text.csvFailed)),
  });

  const pdf = useMutation({
    mutationFn: async () => {
      if (event === undefined) return;
      const all = await fetchAllRegistrations(eventId);
      const now = new Date();
      const blob = await renderRegistrationsPdf(event, all.data, now);
      saveBlob(blob, pdfFilename(event.slug, now));
    },
    onSuccess: () => toast.success(text.pdfDone),
    onError: (error) => toast.error(errorMessage(error, text.pdfFailed)),
  });

  const cancel = useMutation({
    mutationFn: ({
      registration,
      reason,
    }: {
      registration: AdminRegistration;
      reason: CancelReason;
    }) => cancelRegistration(eventId, registration.id, reason),
    onSuccess: async (_data, { reason }) => {
      const unlimited = listQuery.data?.meta.spots_total == null;
      setStatus(
        reason === "TITULAR_REQUEST"
          ? text.erased
          : unlimited
            ? text.cancelledUnlimited
            : text.cancelled,
      );
      // A última linha de uma página que não é a primeira: volta uma página
      if (filters.page > 1 && listQuery.data?.data.length === 1) {
        const next = new URLSearchParams(params);
        if (filters.page - 1 > 1) next.set("pagina", String(filters.page - 1));
        else next.delete("pagina");
        setParams(next, { replace: true });
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    },
    onError: (error) => toast.error(errorMessage(error, text.cancelFailed)),
  });

  if (eventQuery.isError) {
    const missing = isApiError(eventQuery.error) && eventQuery.error.status === 404;

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Link
          to="/admin/eventos"
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-[18px]" />
          {eventAdminMessages.list.title}
        </Link>
        <ErrorState
          message={missing ? text.eventNotFound : text.eventLoadError}
          onRetry={missing ? undefined : () => void eventQuery.refetch()}
          retrying={eventQuery.isFetching}
        />
      </div>
    );
  }

  if (event === undefined) return <LoadingBlock count={4} className="mx-auto max-w-6xl" />;

  const meta = listQuery.data?.meta;
  const total = meta?.spots_total ?? null;
  const filled = meta?.spots_filled ?? event.registrations_count;
  const percent =
    total === null || total === 0 ? 0 : Math.min(100, Math.round((filled / total) * 100));

  // O nome vai primeiro (é o título do cartão no celular); as demais seguem a ordem do CSV e do PDF
  const shared = registrationColumns(event);
  const ordered = [
    ...shared.filter((column) => column.id === "participant_name"),
    ...shared.filter((column) => column.id !== "participant_name"),
  ];
  const columns: DataTableColumn<AdminRegistration>[] = ordered.map((column) => ({
    id: column.id,
    header: column.header,
    className:
      column.id === "participant_name"
        ? "font-bold"
        : ["created_at", "phone", "guardian_phone"].includes(column.id)
          ? "whitespace-nowrap tabular-nums"
          : "break-words",
    cell: (registration) => column.text(registration) || "—",
  }));

  if (canCancel) {
    columns.push({
      id: "actions",
      header: text.actions,
      align: "end",
      hideInCard: false,
      cell: (registration) => (
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-label={text.cancelOf(registration.participant_name)}
          onClick={() => setTarget(registration)}
          className="border-destructive/30 font-bold text-destructive"
        >
          {text.cancel}
        </Button>
      ),
    });
  }

  const searching = filters.search !== "";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${text.title} — ${event.title} — Painel PIBLS`}</title>
      <Link
        to={`/admin/eventos/${eventId}`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-[18px] flex-none" />
        <span className="sr-only">{text.backTo(event.title)}</span>
        <span aria-hidden="true">{event.title}</span>
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-64 flex-1 basis-80 flex-col gap-2">
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
            {text.title}
          </h1>
          <span className="font-bold tabular-nums">{text.spotsFilled(filled, total)}</span>
          {total === null ? null : (
            <div
              role="progressbar"
              aria-label={text.progressLabel}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={Math.min(filled, total)}
              className="h-2.5 max-w-[420px] overflow-hidden rounded-full bg-border"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={csv.isPending}
            onClick={() => csv.mutate()}
            className="gap-2 font-bold"
          >
            {csv.isPending ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : (
              <DownloadIcon aria-hidden="true" className="size-[18px]" />
            )}
            {text.exportCsv}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pdf.isPending}
            onClick={() => pdf.mutate()}
            className="gap-2 font-bold"
          >
            {pdf.isPending ? (
              <Spinner aria-hidden="true" data-icon="inline-start" />
            ) : (
              <PrinterIcon aria-hidden="true" className="size-[18px]" />
            )}
            {pdf.isPending ? text.generatingPdf : text.exportPdf}
          </Button>
        </div>
      </header>

      <p className="m-0 rounded-xl border border-border bg-card px-4 py-3 text-[15px] text-muted-foreground">
        {text.privacyNote}
      </p>

      <section
        aria-labelledby="lista-inscricoes"
        className="overflow-hidden rounded-[14px] border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id="lista-inscricoes" className="m-0 text-[17px] font-extrabold">
            {text.listTitle}
          </h2>
          <form
            role="search"
            onSubmit={(submitEvent) => submitEvent.preventDefault()}
            className="flex items-center gap-2"
          >
            <label htmlFor="busca-inscritos" className="text-sm font-bold">
              {text.search}
            </label>
            <Input
              id="busca-inscritos"
              name="busca"
              type="search"
              value={term}
              placeholder={text.searchHint}
              maxLength={120}
              autoComplete="off"
              onChange={(changeEvent) => setTerm(changeEvent.target.value)}
              className="w-56"
            />
          </form>
        </div>

        <div
          role="status"
          className={
            status === ""
              ? undefined
              : "border-b border-success-foreground/30 bg-success px-5 py-3 font-semibold text-success-foreground"
          }
        >
          {status}
        </div>

        {listQuery.isError ? (
          <div className="p-5">
            <ErrorState
              message={text.loadError}
              onRetry={() => void listQuery.refetch()}
              retrying={listQuery.isFetching}
            />
          </div>
        ) : (
          <>
            <DataTable
              caption={text.listTitle}
              columns={columns}
              rows={listQuery.data?.data ?? []}
              getRowId={(registration) => registration.id}
              isLoading={listQuery.isPending}
              empty={
                <EmptyState
                  title={searching ? text.emptySearch : text.empty}
                  description={searching ? undefined : text.emptyHint}
                />
              }
            />
            {listQuery.data ? (
              <PageLinks
                page={listQuery.data.meta.page}
                lastPage={listQuery.data.meta.last_page}
                total={listQuery.data.meta.total}
                perPage={listQuery.data.meta.per_page}
                hrefFor={(page) => hrefFor(eventId, filters, page)}
              />
            ) : null}
          </>
        )}
      </section>

      {target === null ? null : (
        <CancelRegistrationDialog
          key={target.id}
          name={target.participant_name}
          open
          onOpenChange={(open) => {
            if (!open) setTarget(null);
          }}
          onConfirm={(reason) => cancel.mutateAsync({ registration: target, reason })}
        />
      )}
    </div>
  );
}
