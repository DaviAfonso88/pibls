import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, CircleAlertIcon, FileCheckIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import * as z from "zod";
import {
  formatIsoDateLong,
  formatTime,
  toApiDateTime,
  toDateInput,
  toDateTimeLocal,
} from "~/shared/format";
import { applyApiErrors } from "~/shared/http/forms";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { ruleMessages } from "~/shared/rule-messages";
import { useFormDraft } from "~/shared/drafts";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ConfirmDialog } from "~/shared/ui/confirm-dialog";
import { ErrorState } from "~/shared/ui/error-state";
import { FileDrop } from "~/shared/ui/file-drop";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Progress, ProgressValue } from "~/shared/ui/progress";
import { Spinner } from "~/shared/ui/spinner";
import { Textarea } from "~/shared/ui/textarea";
import {
  adminBulletinQuery,
  createBulletin,
  deleteBulletin,
  replaceBulletinPdf,
  updateBulletin,
  type AdminBulletin,
  type BulletinInput,
} from "../../admin-api";
import { contentAdminMessages } from "../../admin-messages";
import { bulletinSchema, type BulletinValues } from "../../schemas";
import { DraftBanner, FormSection, PublishWhen, SavedNotice, whenLabel } from "./form-parts";

const {
  bulletin: text,
  bulletins: listText,
  draft: draftText,
  schedule: scheduleText,
} = contentAdminMessages;

const PDF_MAX_BYTES = 10 * 1024 * 1024;
const FIELDS = ["edition_number", "reference_date", "title", "summary_text"] as const;

/** O domingo de hoje (ou o próximo), na data de São Paulo: a sugestão do campo "Domingo de referência". */
export function nextSunday(now: Date = new Date()): string {
  const [year, month, day] = toDateInput(now).split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7));
  return date.toISOString().slice(0, 10);
}

const EMPTY: BulletinValues = {
  edition_number: "",
  reference_date: "",
  title: "",
  summary_text: "",
  when: "now",
  scheduled_at: "",
};

/** O rascunho vem do `localStorage`, que o usuário pode editar: confere o formato antes de usar. */
const draftShape = z.object({
  edition_number: z.string(),
  reference_date: z.string(),
  title: z.string(),
  summary_text: z.string(),
  when: z.enum(["now", "schedule"]),
  scheduled_at: z.string(),
});

function parseDraft(value: unknown): BulletinValues | null {
  const parsed = draftShape.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function valuesOf(bulletin: AdminBulletin): BulletinValues {
  return {
    edition_number: String(bulletin.edition_number),
    reference_date: bulletin.reference_date,
    title: bulletin.title,
    summary_text: bulletin.summary_text ?? "",
    when: bulletin.status === "AGENDADO" ? "schedule" : "now",
    scheduled_at: bulletin.status === "AGENDADO" ? toDateTimeLocal(bulletin.published_at) : "",
  };
}

function toInput(values: BulletinValues, editing: AdminBulletin | null): BulletinInput {
  // Boletim já publicado não muda a data de saída; o agendado pode ir para outra data ou sair agora
  const keepsPublication = editing !== null && editing.status === "PUBLICADO";

  return {
    edition_number: Number(values.edition_number),
    reference_date: values.reference_date,
    title: values.title.trim(),
    summary_text: values.summary_text,
    published_at: keepsPublication
      ? null
      : values.when === "schedule"
        ? toApiDateTime(values.scheduled_at)
        : editing !== null
          ? new Date().toISOString()
          : null,
  };
}

/** O PDF que a pessoa enviou, com a barra de progresso e o cancelamento (design: AdminBoletim). */
function UploadProgress({
  name,
  percent,
  onCancel,
}: {
  name: string;
  percent: number;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <Progress value={percent} aria-label={text.uploading(name)}>
        <span className="font-semibold">{text.uploading(name)}</span>
        <ProgressValue>{() => text.uploadPercent(percent)}</ProgressValue>
      </Progress>
      <Button type="button" variant="link" className="self-start px-0" onClick={onCancel}>
        {text.cancelUpload}
      </Button>
    </div>
  );
}

/**
 * Cadastro e edição de boletim (design: AdminBoletim; CAP-02): edição, domingo, título, resumo, PDF com progresso,
 * quando publicar e a prévia de como aparece no site. O rascunho dos campos de texto fica no navegador (FR-077); o PDF
 * nunca. BR-040 (edição única), BR-041 (PDF verdadeiro até 10 MB) e BR-042 (agendado fica invisível) valem no servidor.
 */
export function BulletinForm({ id, userId }: { id: number | null; userId: number }) {
  const editing = id !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ ...adminBulletinQuery(id ?? 0), enabled: editing });
  const bulletin = query.data ?? null;

  const form = useForm<BulletinValues>({
    resolver: zodResolver(bulletinSchema),
    defaultValues: { ...EMPTY, reference_date: nextSunday() },
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = form;

  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | undefined>();
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ title: string; note: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const values = watch();
  const draft = useFormDraft<BulletinValues>({
    userId,
    form: "boletim",
    id: id ?? "novo",
    values,
    dirty: isDirty && saved === null,
    parse: parseDraft,
    enabled: !editing || bulletin !== null,
  });

  // O registro chegou: preenche o formulário com ele (uma vez)
  useEffect(() => {
    register("when");
    register("scheduled_at");
  }, [register]);

  const loaded = useRef(false);
  useEffect(() => {
    if (bulletin && !loaded.current) {
      loaded.current = true;
      reset(valuesOf(bulletin));
    }
  }, [bulletin, reset]);

  function restoreDraft() {
    const restored = draft.restore();
    if (restored) reset(restored, { keepDefaultValues: true });
  }

  const save = useMutation({
    mutationFn: async (formValues: BulletinValues) => {
      const input = toInput(formValues, bulletin);
      abort.current = new AbortController();
      const upload = {
        signal: abort.current.signal,
        onProgress: (fraction: number) => setProgress(Math.round(fraction * 100)),
      };

      if (!editing) {
        if (pdf === null) throw new Error(text.fileRequired);
        return createBulletin(input, pdf, upload);
      }

      const updated = await updateBulletin(id, input);
      if (pdf !== null) {
        try {
          return await replaceBulletinPdf(id, pdf, upload);
        } catch (error) {
          throw new PdfReplaceError(error);
        }
      }
      return updated;
    },
    onSuccess: async (result) => {
      draft.clear();
      await queryClient.invalidateQueries({ queryKey: ["admin", "bulletins"] });
      void queryClient.invalidateQueries({ queryKey: ["public", "bulletins"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot", "home"] });

      if (editing) {
        toast.success(text.updated);
        void navigate("/admin/boletins");
        return;
      }
      setSaved({
        title:
          result.status === "AGENDADO"
            ? text.createdScheduled(whenLabel(result.published_at))
            : text.createdNow,
        note: text.siteUpdated,
      });
    },
    onSettled: () => {
      setProgress(null);
      abort.current = null;
    },
  });

  function onSubmit(formValues: BulletinValues): void {
    setProblem(null);
    setPdfError(undefined);

    if (!editing && pdf === null) {
      setPdfError(text.fileRequired);
      return;
    }

    // A barra de progresso aparece já ao começar a enviar o PDF, antes do primeiro aviso de progresso
    if (pdf !== null) setProgress(0);
    save.mutate(formValues, { onError: (error) => showError(error) });
  }

  function showError(error: unknown): void {
    if (isAbort(error)) return;

    if (error instanceof PdfReplaceError) {
      setPdfError(error.message);
      setProblem(error.message);
      return;
    }

    if (isApiError(error) && error.code === "DUPLICATE_EDITION") {
      setError("edition_number", { type: "server", message: error.message }, { shouldFocus: true });
      return;
    }

    if (isApiError(error) && error.isValidation) {
      const fieldErrors = error.fieldErrors();
      if (fieldErrors.pdf) setPdfError(fieldErrors.pdf);
      if (fieldErrors.published_at) {
        setError("scheduled_at", { type: "server", message: fieldErrors.published_at });
      }
    }

    const applied = applyApiErrors(error, setError, FIELDS);
    if (applied.general && !(isApiError(error) && error.fieldErrors().pdf)) {
      setProblem(applied.general);
    }
  }

  const remove = useMutation({
    mutationFn: () => deleteBulletin(id ?? 0),
    onSuccess: async () => {
      draft.clear();
      await queryClient.invalidateQueries({ queryKey: ["admin", "bulletins"] });
      void queryClient.invalidateQueries({ queryKey: ["public", "bulletins"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot", "home"] });
      toast.success(text.deleted);
      void navigate("/admin/boletins");
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : messages.errors.generic);
    },
  });

  const title = editing
    ? bulletin
      ? text.editTitle(bulletin.edition_number)
      : text.editTitle(id)
    : text.newTitle;

  if (editing && query.isError) {
    const missing = isApiError(query.error) && query.error.status === 404;
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <title>{`${text.newTitle} — Painel PIBLS`}</title>
        <Link
          to="/admin/boletins"
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-[18px]" />
          {text.back}
        </Link>
        <ErrorState
          message={missing ? text.notFound : text.loadError}
          onRetry={missing ? undefined : () => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  if (editing && bulletin === null) {
    return <LoadingBlock count={4} className="mx-auto max-w-3xl" />;
  }

  const whenValue = values.when;
  const alreadyPublished = bulletin?.status === "PUBLICADO";
  const percent = progress ?? 0;
  const busy = save.isPending;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${title} — Painel PIBLS`}</title>
      <Link
        to="/admin/boletins"
        className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-[18px]" />
        {text.back}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
        {draft.savedAt !== null ? (
          <span className="text-sm text-muted-foreground" role="status">
            {draftText.savedAt(formatTime(new Date(draft.savedAt)))}
          </span>
        ) : null}
      </header>

      {draft.offered ? <DraftBanner onRestore={restoreDraft} onDiscard={draft.discard} /> : null}

      {saved ? (
        <SavedNotice
          title={saved.title}
          links={[
            { to: "/boletins", label: text.seeInSite, external: true },
            { to: "/admin/boletins", label: text.backToList },
          ]}
        >
          {saved.note}
        </SavedNotice>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <form
            noValidate
            aria-label={text.formLabel}
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-w-0 flex-[3_1_27rem] flex-col gap-5"
          >
            {problem ? (
              <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                <CircleAlertIcon aria-hidden="true" />
                {problem}
              </Alert>
            ) : null}

            <FormSection>
              <div className="flex flex-wrap gap-4">
                <div className="flex-[1_1_9rem]">
                  <FormField
                    id="edicao"
                    label={text.edition}
                    error={errors.edition_number?.message}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        {...register("edition_number")}
                      />
                    )}
                  </FormField>
                </div>
                <div className="flex-[1_1_12rem]">
                  <FormField
                    id="domingo"
                    label={text.reference}
                    error={errors.reference_date?.message}
                  >
                    {(control) => (
                      <Input {...control} type="date" {...register("reference_date")} />
                    )}
                  </FormField>
                </div>
              </div>
              <FormField id="titulo" label={text.titleField} error={errors.title?.message}>
                {(control) => (
                  <Input {...control} type="text" maxLength={150} {...register("title")} />
                )}
              </FormField>
              <FormField
                id="resumo"
                label={text.summary}
                optionalLabel={messages.common.optional}
                hint={text.summaryHint}
                error={errors.summary_text?.message}
              >
                {(control) => (
                  <Textarea {...control} rows={3} maxLength={300} {...register("summary_text")} />
                )}
              </FormField>
            </FormSection>

            <FormSection title={text.fileSection} id="t-pdf">
              {progress !== null ? (
                <UploadProgress
                  name={pdf?.name ?? ""}
                  percent={percent}
                  onCancel={() => abort.current?.abort()}
                />
              ) : (
                <FileDrop
                  id="pdf"
                  label={text.fileLabel}
                  hint={text.fileHint}
                  accept={["application/pdf"]}
                  maxBytes={PDF_MAX_BYTES}
                  file={pdf}
                  onFileChange={(file) => {
                    setPdf(file);
                    setPdfError(undefined);
                  }}
                  typeMessage={ruleMessages.pdfType}
                  sizeMessage={ruleMessages.pdfSize}
                  error={pdfError}
                  disabled={busy}
                />
              )}
              {bulletin ? (
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <FileCheckIcon aria-hidden="true" className="size-4" />
                  {text.currentFile}:{" "}
                  <a href={bulletin.pdf_url} target="_blank" rel="noopener" className="font-bold">
                    {text.openCurrent}
                  </a>
                </p>
              ) : null}
            </FormSection>

            {alreadyPublished && bulletin ? (
              <FormSection>
                <p className="m-0">
                  {scheduleText.alreadyPublished(whenLabel(bulletin.published_at))}
                </p>
              </FormSection>
            ) : (
              <FormSection>
                <PublishWhen
                  name="quando"
                  when={whenValue}
                  scheduledAt={values.scheduled_at}
                  onWhenChange={(next) => setValue("when", next, { shouldDirty: true })}
                  onScheduledAtChange={(next) =>
                    setValue("scheduled_at", next, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.scheduled_at?.message}
                  disabled={busy}
                />
              </FormSection>
            )}

            <div className="flex flex-wrap gap-2.5">
              <Button type="submit" size="lg" className="px-5 font-bold" disabled={busy}>
                {busy ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
                {busy
                  ? text.saving
                  : editing
                    ? text.save
                    : whenValue === "schedule"
                      ? text.schedulePublish
                      : text.publishNow}
              </Button>
              {editing ? null : (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="px-5 font-bold"
                  disabled={busy || !isDirty || draft.offered !== null}
                  onClick={() => draft.saveNow()}
                >
                  {draftText.save}
                </Button>
              )}
              {editing ? (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="gap-2 px-5 font-bold text-destructive"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2Icon aria-hidden="true" className="size-[18px]" />
                  {text.delete}
                </Button>
              ) : null}
            </div>
            {!editing && pdf === null && !pdfError ? (
              <p className="m-0 text-sm text-muted-foreground">{text.fileRequired}</p>
            ) : null}
          </form>

          <aside
            aria-labelledby="t-previa"
            className="flex min-w-0 flex-[2_1_17rem] flex-col gap-3"
          >
            <h2 id="t-previa" className="m-0 text-lg font-extrabold">
              {text.preview}
            </h2>
            <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-4.5">
              <span className="text-sm font-bold text-primary">
                {previewMeta(values.reference_date, Number(values.edition_number))}
              </span>
              <span className="text-lg font-extrabold">{values.title || text.previewTitle}</span>
              <span className="text-[15px] text-muted-foreground">
                {values.summary_text || text.previewSummary}
              </span>
              <span className="mt-1 flex gap-2">
                <span
                  className={buttonClassName({ className: "pointer-events-none px-3.5 font-bold" })}
                >
                  {text.previewRead}
                </span>
                <span
                  className={buttonClassName({
                    variant: "outline",
                    className: "pointer-events-none px-3.5 font-bold",
                  })}
                >
                  {text.previewDownload}
                </span>
              </span>
            </div>
            <p className="m-0 text-sm text-muted-foreground">{draftText.note}</p>
          </aside>
        </div>
      )}

      {editing ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={text.deleteTitle(bulletin?.edition_number ?? 0)}
          description={text.deleteBody}
          confirmLabel={text.deleteConfirm}
          destructive
          onConfirm={async () => {
            await remove.mutateAsync();
          }}
        />
      ) : null}
    </div>
  );
}

/** A troca do PDF falhou depois de os dados serem salvos: a tela avisa as duas coisas. */
class PdfReplaceError extends Error {
  constructor(cause: unknown) {
    super(
      `Os dados foram salvos, mas o PDF não foi trocado. ${isApiError(cause) ? (cause.fieldErrors().pdf ?? cause.message) : messages.errors.generic}`,
    );
    this.name = "PdfReplaceError";
  }
}

function isAbort(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === "AbortError";
}

/** A linha de cima da prévia: a data do boletim e o número da edição, só do que já foi preenchido. */
function previewMeta(referenceDate: string, edition: number): string {
  return [
    referenceDate ? formatIsoDateLong(referenceDate) : null,
    edition > 0 ? listText.edition(edition) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}
