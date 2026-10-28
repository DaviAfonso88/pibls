import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, CheckIcon, CircleAlertIcon, Trash2Icon } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import * as z from "zod";
import { formatTime, toDateTimeLocal } from "~/shared/format";
import { useFormDraft } from "~/shared/drafts";
import { isApiError } from "~/shared/http/errors";
import { applyApiErrors } from "~/shared/http/forms";
import { slugify } from "~/shared/lib/slug";
import { messages } from "~/shared/messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ConfirmDialog } from "~/shared/ui/confirm-dialog";
import { ErrorState } from "~/shared/ui/error-state";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { Spinner } from "~/shared/ui/spinner";
import { StatusBadge, type StatusTone } from "~/shared/ui/status-badge";
import {
  FORM_FIELD_TYPES,
  adminEventQuery,
  createEvent,
  deleteEvent,
  removeEventBanner,
  setEventPublished,
  setRegistrationDeadline,
  updateEvent,
  uploadEventBanner,
  type EventState,
  type SavedEvent,
} from "../../admin-api";
import { eventAdminMessages } from "../../admin-messages";
import { canReopenRegistration, emptyValues, toInput, valuesOf } from "../../event-model";
import { registrationsAdminMessages as registrationsText } from "../../registrations-messages";
import { eventSchema, type EventValues } from "../../schemas";
import { BannerField } from "./banner-field";
import { FormBuilder, type FieldErrors } from "./form-builder";
import { DraftBanner, FormSection } from "./form-parts";

// O TipTap pesa: só a tela de edição o carrega (Frontend → Lazy loading)
const RichTextEditor = lazy(() =>
  import("~/shared/ui/rich-text-editor").then((module) => ({ default: module.RichTextEditor })),
);

const { form: text, actions: actionText, draft: draftText, state: stateText } = eventAdminMessages;

export interface MinistryOption {
  id: number;
  name: string;
}

const FIELDS = [
  "title",
  "slug",
  "ministry_id",
  "description",
  "starts_at",
  "ends_at",
  "location",
  "max_spots",
  "registration_deadline",
  "has_minors",
  "form_schema",
] as const;

const STATE_TONE: Record<EventState, StatusTone> = {
  RASCUNHO: "neutral",
  INSCRICOES_ABERTAS: "success",
  INSCRICOES_ENCERRADAS: "warning",
  REALIZADO: "info",
};

/** Uma pergunta do rascunho: só o formato, sem as regras de conteúdo (uma pergunta em branco ainda vale como rascunho). */
const draftFieldShape = z.object({
  uid: z.string(),
  key: z.string(),
  label: z.string(),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean(),
  help_text: z.string(),
  sensitive: z.boolean(),
  min: z.string(),
  max: z.string(),
  options: z.string(),
});

/** O rascunho vem do `localStorage`, que o usuário pode editar: confere o formato antes de usar. */
const draftShape = z.object({
  title: z.string(),
  slug: z.string(),
  ministry_id: z.string(),
  description: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  location: z.string(),
  max_spots: z.string(),
  registration_deadline: z.string(),
  has_minors: z.boolean(),
  form_schema: z.array(draftFieldShape),
});

let draftSequence = 0;

function parseDraft(value: unknown): EventValues | null {
  const parsed = draftShape.safeParse(value);
  if (!parsed.success) return null;

  // Os identificadores de pergunta são só da sessão: o rascunho ganha novos
  return {
    ...parsed.data,
    form_schema: parsed.data.form_schema.map((field) => {
      draftSequence += 1;
      return { ...field, uid: `rascunho-${draftSequence}` };
    }),
  };
}

/** O prazo de inscrição (hora de Brasília, sem fuso) já passou? Compara com o agora, na mesma hora de Brasília. */
function deadlinePassed(local: string, now: Date = new Date()): boolean {
  return local !== "" && local <= toDateTimeLocal(now);
}

/**
 * Cadastro e edição de evento (design: AdminEvento; CAP-12): dados, imagem de capa, vagas e prazo, formulário de inscrição
 * (construtor) e publicação. O rascunho fica no navegador, sem a imagem (FR-077). Quem só tem `eventos.write.own` tem o
 * ministério fixo no próprio (`lockedMinistryId`); o servidor confere do mesmo jeito (BR-030).
 */
export function EventForm({
  id,
  userId,
  ministries,
  lockedMinistryId,
}: {
  id: number | null;
  userId: number;
  ministries: readonly MinistryOption[];
  lockedMinistryId: number | null;
}) {
  const editing = id !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ ...adminEventQuery(id ?? 0), enabled: editing });
  const event = query.data ?? null;

  const form = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: emptyValues(lockedMinistryId),
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

  const [problem, setProblem] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugConflict, setSlugConflict] = useState(false);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [expiredFor, setExpiredFor] = useState<"form" | "action" | null>(null);
  const [needsSchemaConfirmation, setNeedsSchemaConfirmation] = useState(false);
  const intent = useRef<"draft" | "publish">("draft");
  const pendingValues = useRef<EventValues | null>(null);
  // Ref e não estado: a confirmação vale já no reenvio, sem esperar outra renderização (BR-029)
  const schemaConfirmed = useRef(false);

  const values = watch();
  const draft = useFormDraft<EventValues>({
    userId,
    form: "evento",
    id: id ?? "novo",
    values,
    dirty: isDirty,
    parse: parseDraft,
    enabled: !editing || event !== null,
  });

  // Campos controlados por setValue (sem input próprio) precisam estar registrados para entrar no envio e na validação
  useEffect(() => {
    register("description");
    register("form_schema");
  }, [register]);

  const loaded = useRef(false);
  useEffect(() => {
    if (event && !loaded.current) {
      loaded.current = true;
      reset(valuesOf(event));
    }
  }, [event, reset]);

  // O endereço acompanha o nome enquanto o evento é novo e ele não foi mexido; depois de criado, não muda
  useEffect(() => {
    if (!editing && !slugTouched) {
      setValue("slug", slugify(values.title), { shouldDirty: false });
    }
  }, [editing, slugTouched, values.title, setValue]);

  function restoreDraft() {
    const restored = draft.restore();
    if (restored) {
      reset(restored, { keepDefaultValues: true });
      setSlugTouched(restored.slug !== "" && restored.slug !== slugify(restored.title));
    }
  }

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    void queryClient.invalidateQueries({ queryKey: ["public", "events"] });
    void queryClient.invalidateQueries({ queryKey: ["snapshot", "home"] });
  }

  const save = useMutation({
    mutationFn: async ({
      formValues,
      publish,
    }: {
      formValues: EventValues;
      publish: boolean;
    }): Promise<{ saved: SavedEvent; bannerFailed: boolean }> => {
      const input = toInput(formValues);
      const saved = editing
        ? await updateEvent(id, input, schemaConfirmed.current)
        : await createEvent(input, publish);

      // A imagem é outra chamada (multipart): se falhar, o evento já está salvo e a tela avisa
      let bannerFailed = false;
      try {
        if (banner !== null) {
          await uploadEventBanner(saved.event.id, banner);
        } else if (bannerRemoved && saved.event.banner_url) {
          await removeEventBanner(saved.event.id);
        }
      } catch {
        bannerFailed = true;
      }

      return { saved, bannerFailed };
    },
    onSuccess: ({ saved, bannerFailed }, variables) => {
      draft.clear();
      setWarning(saved.sanitizationWarning);
      schemaConfirmed.current = false;
      setBanner(null);
      setBannerRemoved(false);
      refresh();

      if (bannerFailed) toast.error(text.bannerFailed);

      if (editing) {
        toast.success(text.updated);
        // A descrição voltou sanitizada: mostra o que ficou e avisa se algo saiu
        reset(valuesOf(saved.event));
        return;
      }

      toast.success(variables.publish ? text.createdPublished : text.created);
      void navigate(`/admin/eventos/${saved.event.id}`);
    },
  });

  function submitValues(formValues: EventValues, publish: boolean): void {
    setProblem(null);
    setSlugConflict(false);
    setNeedsSchemaConfirmation(false);

    save.mutate(
      { formValues, publish },
      {
        onError: (error) => {
          if (isApiError(error) && error.code === "DUPLICATE_SLUG") {
            // O endereço já existe: libera o campo para a pessoa ajustar
            setSlugConflict(true);
            setSlugTouched(true);
            setError("slug", { type: "server", message: error.message }, { shouldFocus: true });
            return;
          }

          if (isApiError(error) && error.code === "SPOTS_BELOW_REGISTRATIONS") {
            setError(
              "max_spots",
              { type: "server", message: error.message },
              { shouldFocus: true },
            );
            return;
          }

          if (isApiError(error) && error.code === "SCHEMA_CHANGE_NEEDS_CONFIRMATION") {
            // Outra pessoa recebeu inscrições enquanto esta tela estava aberta: pede a confirmação agora
            setNeedsSchemaConfirmation(true);
            return;
          }

          const applied = applyApiErrors(error, setError, FIELDS);
          if (applied.general) setProblem(applied.general);
        },
      },
    );
  }

  function onSubmit(formValues: EventValues): void {
    if (formValues.description.trim() === "") {
      setError(
        "description",
        { type: "required", message: text.descriptionRequired },
        { shouldFocus: true },
      );
      return;
    }

    const publish = !editing && intent.current === "publish";

    // BR-033: publicar com o prazo vencido deixa o evento com as inscrições encerradas; a pessoa confirma antes
    if (publish && deadlinePassed(formValues.registration_deadline)) {
      pendingValues.current = formValues;
      setExpiredFor("form");
      return;
    }

    submitValues(formValues, publish);
  }

  /** Publicar, despublicar, encerrar ou reabrir as inscrições: um PATCH só com o que muda. */
  const act = useMutation({
    mutationFn: (kind: "publish" | "unpublish" | "close" | "reopen"): Promise<SavedEvent> => {
      switch (kind) {
        case "publish":
          return setEventPublished(id ?? 0, true);
        case "unpublish":
          return setEventPublished(id ?? 0, false);
        case "close":
          return setRegistrationDeadline(id ?? 0, new Date().toISOString());
        case "reopen":
          return setRegistrationDeadline(id ?? 0, null);
      }
    },
    onSuccess: (saved, kind) => {
      queryClient.setQueryData(adminEventQuery(id ?? 0).queryKey, saved.event);
      // O prazo mudou no servidor: o campo acompanha, sem contar como edição da pessoa
      setValue(
        "registration_deadline",
        saved.event.registration_deadline ? toDateTimeLocal(saved.event.registration_deadline) : "",
        { shouldDirty: false },
      );
      refresh();
      toast.success(
        {
          publish: actionText.published,
          unpublish: actionText.unpublished,
          close: actionText.closed,
          reopen: actionText.reopened,
        }[kind],
      );
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : messages.errors.generic);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteEvent(id ?? 0),
    onSuccess: () => {
      draft.clear();
      refresh();
      toast.success(text.deleted);
      void navigate("/admin/eventos");
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : messages.errors.generic);
    },
  });

  function requestPublish(): void {
    if (
      event?.registration_deadline &&
      deadlinePassed(toDateTimeLocal(event.registration_deadline))
    ) {
      setExpiredFor("action");
      return;
    }
    act.mutate("publish");
  }

  const title = editing ? text.editTitle : text.newTitle;

  if (editing && query.isError) {
    const missing = isApiError(query.error) && query.error.status === 404;
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <title>{`${text.editTitle} — Painel PIBLS`}</title>
        <Link
          to="/admin/eventos"
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

  if (editing && event === null) return <LoadingBlock count={4} className="mx-auto max-w-3xl" />;

  const busy = save.isPending || act.isPending || remove.isPending;
  const slugLocked = editing || (!slugConflict && !slugTouched);
  const registrations = event?.registrations_count ?? 0;
  const state = event?.registration.state ?? "RASCUNHO";

  const fieldErrors: FieldErrors[] = values.form_schema.map((_, index) => {
    const own = errors.form_schema?.[index];
    return {
      label: own?.label?.message,
      help_text: own?.help_text?.message,
      options: own?.options?.message,
      min: own?.min?.message,
      max: own?.max?.message,
    };
  });
  const schemaError = errors.form_schema?.message ?? errors.form_schema?.root?.message;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${title} — Painel PIBLS`}</title>

      <Link
        to="/admin/eventos"
        className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-[18px]" />
        {text.back}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-[14px] border border-border bg-card p-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="m-0 text-[26px] leading-tight font-extrabold tracking-tight text-balance">
            {editing && event ? event.title : text.newTitle}
          </h1>
          {editing && event ? (
            <span className="flex flex-wrap items-center gap-2.5">
              <StatusBadge tone={STATE_TONE[state]}>{stateText[state]}</StatusBadge>
              <span className="text-[15px] text-muted-foreground">
                {text.spotsSummary(registrations, event.max_spots ?? null)}
              </span>
            </span>
          ) : null}
        </div>

        {editing && event ? (
          <div role="group" aria-label={actionText.groupLabel} className="flex flex-wrap gap-2">
            <Link
              to={`/admin/eventos/${event.id}/inscritos`}
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                className: "font-bold",
              })}
            >
              {registrationsText.viewRegistrations}
            </Link>
            {state === "RASCUNHO" ? (
              <Button
                type="button"
                size="lg"
                className="px-4.5 font-bold"
                disabled={busy}
                onClick={requestPublish}
              >
                {actionText.publish}
              </Button>
            ) : null}
            {state === "INSCRICOES_ABERTAS" ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="px-4.5 font-bold"
                disabled={busy}
                onClick={() => setConfirmClose(true)}
              >
                {actionText.closeRegistration}
              </Button>
            ) : null}
            {state === "INSCRICOES_ENCERRADAS" && canReopenRegistration(event) ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="px-4.5 font-bold"
                disabled={busy}
                onClick={() => act.mutate("reopen")}
              >
                {actionText.reopenRegistration}
              </Button>
            ) : null}
            {state !== "RASCUNHO" ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="px-4.5 font-bold"
                disabled={busy}
                onClick={() => act.mutate("unpublish")}
              >
                {actionText.unpublish}
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {draft.savedAt !== null ? (
        <p
          className="m-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          role="status"
        >
          <CheckIcon aria-hidden="true" className="size-4" />
          {draftText.savedAt(formatTime(new Date(draft.savedAt)))}
        </p>
      ) : null}

      {draft.offered ? <DraftBanner onRestore={restoreDraft} onDiscard={draft.discard} /> : null}

      <form
        noValidate
        aria-label={text.formLabel}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {problem ? (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
            <CircleAlertIcon aria-hidden="true" />
            {problem}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-start gap-5">
          <FormSection title={text.aboutSection} id="t-sobre" className="min-w-0 flex-[3_1_26rem]">
            <div className="flex flex-col gap-4">
              <FormField id="nome" label={text.titleField} error={errors.title?.message}>
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    maxLength={150}
                    className="min-h-12 text-lg font-bold"
                    {...register("title")}
                  />
                )}
              </FormField>
              <FormField
                id="slug"
                label={text.slugField}
                hint={slugConflict ? text.slugConflictHint : text.slugHint}
                error={errors.slug?.message}
              >
                {(control) => (
                  <span className="flex items-stretch overflow-hidden rounded-lg border border-input bg-background">
                    <span
                      aria-hidden="true"
                      className="flex items-center border-r border-border bg-muted px-3 text-[15px] whitespace-nowrap text-muted-foreground"
                    >
                      {text.slugPrefix}
                    </span>
                    <Input
                      {...control}
                      type="text"
                      readOnly={slugLocked}
                      spellCheck={false}
                      autoCapitalize="none"
                      autoComplete="off"
                      className="min-w-0 flex-1 rounded-none border-0"
                      {...register("slug", { onChange: () => setSlugTouched(true) })}
                    />
                  </span>
                )}
              </FormField>
              <FormField id="ministerio" label={text.ministry} error={errors.ministry_id?.message}>
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full max-w-md"
                    disabled={lockedMinistryId !== null}
                    {...register("ministry_id")}
                  >
                    <NativeSelectOption value="">{text.ministryPlaceholder}</NativeSelectOption>
                    {ministries
                      .filter(
                        (ministry) => lockedMinistryId === null || ministry.id === lockedMinistryId,
                      )
                      .map((ministry) => (
                        <NativeSelectOption key={ministry.id} value={String(ministry.id)}>
                          {ministry.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                )}
              </FormField>
              <div className="flex flex-wrap gap-4">
                <div className="flex-[1_1_14rem]">
                  <FormField
                    id="inicio"
                    label={text.startsAt}
                    hint={text.zone}
                    error={errors.starts_at?.message}
                  >
                    {(control) => (
                      <Input {...control} type="datetime-local" {...register("starts_at")} />
                    )}
                  </FormField>
                </div>
                <div className="flex-[1_1_14rem]">
                  <FormField
                    id="fim"
                    label={text.endsAt}
                    optionalLabel={messages.common.optional}
                    hint={text.optionalEnd}
                    error={errors.ends_at?.message}
                  >
                    {(control) => (
                      <Input {...control} type="datetime-local" {...register("ends_at")} />
                    )}
                  </FormField>
                </div>
              </div>
              <FormField id="local" label={text.location} error={errors.location?.message}>
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    maxLength={200}
                    placeholder={`${text.locationPlaceholder}…`}
                    {...register("location")}
                  />
                )}
              </FormField>
              <Suspense fallback={<LoadingBlock count={2} aria-label={text.loadingEditor} />}>
                <RichTextEditor
                  id="descricao"
                  label={text.descriptionLabel}
                  value={values.description}
                  onChange={(html) =>
                    setValue("description", html, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.description?.message}
                  sanitizationWarning={warning}
                  disabled={busy}
                />
              </Suspense>
            </div>
          </FormSection>

          <aside className="flex min-w-0 flex-[2_1_18rem] flex-col gap-5">
            <FormSection title={text.bannerSection} id="t-capa">
              <BannerField
                currentUrl={event?.banner_small_url ?? null}
                file={banner}
                removed={bannerRemoved}
                onFileChange={setBanner}
                onRemovedChange={setBannerRemoved}
                disabled={busy}
              />
            </FormSection>

            <FormSection title={text.registrationSection} id="t-inscricoes">
              <FormField
                id="vagas"
                label={text.spots}
                hint={text.spotsHint}
                error={errors.max_spots?.message}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="max-w-40"
                    placeholder="Ex.: 60…"
                    {...register("max_spots")}
                  />
                )}
              </FormField>
              <FormField
                id="prazo"
                label={text.deadline}
                optionalLabel={messages.common.optional}
                hint={text.deadlineHint}
                error={errors.registration_deadline?.message}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="datetime-local"
                    {...register("registration_deadline")}
                  />
                )}
              </FormField>
              <label className="flex min-h-11 items-start gap-2.5">
                <input
                  type="checkbox"
                  role="switch"
                  className="mt-3 size-5 flex-none"
                  aria-describedby="menores-dica"
                  {...register("has_minors")}
                />
                <span className="flex flex-col py-2">
                  <strong>{text.minors}</strong>
                  <span id="menores-dica" className="text-[15px] text-muted-foreground">
                    {text.minorsHint}
                  </span>
                </span>
              </label>
            </FormSection>
          </aside>
        </div>

        <FormSection title={eventAdminMessages.builder.section} id="t-formulario">
          <p className="m-0 text-[15px] text-muted-foreground">
            {eventAdminMessages.builder.intro}
          </p>
          {schemaError ? (
            <Alert
              variant="destructive"
              className="border-destructive/40 bg-destructive/5"
              role="alert"
            >
              <CircleAlertIcon aria-hidden="true" />
              {schemaError}
            </Alert>
          ) : null}
          <FormBuilder
            fields={values.form_schema}
            onChange={(next) =>
              setValue("form_schema", next, {
                shouldDirty: true,
                shouldValidate: errors.form_schema !== undefined,
              })
            }
            savedFields={event?.form_schema ?? []}
            registrations={registrations}
            onBreakingChange={() => {
              schemaConfirmed.current = true;
            }}
            errors={fieldErrors}
            disabled={busy}
          />
        </FormSection>

        <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-card px-5 py-4">
          {editing ? (
            <Button type="submit" size="lg" className="px-5 font-bold" disabled={busy}>
              {save.isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              {save.isPending ? text.saving : text.save}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                size="lg"
                className="px-5 font-bold"
                disabled={busy}
                onClick={() => {
                  intent.current = "publish";
                }}
              >
                {save.isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
                {save.isPending ? text.saving : text.saveAndPublish}
              </Button>
              <Button
                type="submit"
                size="lg"
                variant="outline"
                className="px-5 font-bold"
                disabled={busy}
                onClick={() => {
                  intent.current = "draft";
                }}
              >
                {text.saveDraft}
              </Button>
            </>
          )}
          {editing && event?.is_published ? (
            <a
              href={`/eventos/${event.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center px-2 font-bold"
            >
              {text.preview}
            </a>
          ) : null}
          {editing && event ? (
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
          <p className="m-0 w-full text-sm text-muted-foreground">{draftText.note}</p>
        </div>
      </form>

      {editing && event ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={text.deleteTitle(event.title)}
          description={registrations > 0 ? text.hasRegistrations : text.deleteBody}
          confirmLabel={text.deleteConfirm}
          destructive
          confirmDisabled={registrations > 0}
          onConfirm={async () => {
            await remove.mutateAsync();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={actionText.closeTitle}
        description={actionText.closeBody}
        confirmLabel={actionText.closeConfirm}
        onConfirm={async () => {
          await act.mutateAsync("close");
        }}
      />

      <ConfirmDialog
        open={expiredFor !== null}
        onOpenChange={(open) => {
          if (!open) setExpiredFor(null);
        }}
        title={actionText.expiredTitle}
        description={actionText.expiredBody}
        confirmLabel={actionText.expiredConfirm}
        onConfirm={() => {
          const target = expiredFor;
          setExpiredFor(null);

          if (target === "form" && pendingValues.current !== null) {
            submitValues(pendingValues.current, true);
          } else if (target === "action") {
            act.mutate("publish");
          }
        }}
      />

      <ConfirmDialog
        open={needsSchemaConfirmation}
        onOpenChange={setNeedsSchemaConfirmation}
        title={eventAdminMessages.builder.schemaConfirmTitle}
        description={eventAdminMessages.builder.breakingBody}
        confirmLabel={text.save}
        destructive
        onConfirm={() => {
          schemaConfirmed.current = true;
          setNeedsSchemaConfirmation(false);
          void handleSubmit((formValues) => submitValues(formValues, false))();
        }}
      />
    </div>
  );
}
