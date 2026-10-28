import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, CheckIcon, CircleAlertIcon, Trash2Icon } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import * as z from "zod";
import { formatTime, toApiDateTime, toDateTimeLocal } from "~/shared/format";
import { useFormDraft } from "~/shared/drafts";
import { isApiError } from "~/shared/http/errors";
import { applyApiErrors } from "~/shared/http/forms";
import { messages } from "~/shared/messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { ConfirmDialog } from "~/shared/ui/confirm-dialog";
import { ErrorState } from "~/shared/ui/error-state";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Spinner } from "~/shared/ui/spinner";
import { ruleMessages } from "~/shared/rule-messages";
import {
  adminPostQuery,
  createPost,
  deletePost,
  updatePost,
  type AdminPost,
  type PostInput,
  type SavedPost,
} from "../../admin-api";
import { contentAdminMessages } from "../../admin-messages";
import { postSchema, type PostValues } from "../../schemas";
import { slugify } from "../../slug";
import { youtubeVideoId } from "../../youtube";
import { DraftBanner, FormSection, PublishWhen, SavedNotice, whenLabel } from "./form-parts";

// O TipTap pesa: só a tela de edição o carrega (Frontend → Lazy loading)
const RichTextEditor = lazy(() =>
  import("~/shared/ui/rich-text-editor").then((module) => ({ default: module.RichTextEditor })),
);

const { post: text, draft: draftText } = contentAdminMessages;

const FIELDS = ["title", "slug", "body", "author_display", "youtube_url"] as const;

const EMPTY: PostValues = {
  title: "",
  slug: "",
  body: "",
  author_display: "",
  youtube_url: "",
  when: "now",
  scheduled_at: "",
};

/** O rascunho vem do `localStorage`, que o usuário pode editar: confere o formato antes de usar. */
const draftShape = z.object({
  title: z.string(),
  slug: z.string(),
  body: z.string(),
  author_display: z.string(),
  youtube_url: z.string(),
  when: z.enum(["now", "schedule"]),
  scheduled_at: z.string(),
});

function parseDraft(value: unknown): PostValues | null {
  const parsed = draftShape.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function valuesOf(post: AdminPost): PostValues {
  return {
    title: post.title,
    slug: post.slug,
    body: post.body,
    author_display: post.author_display ?? "",
    youtube_url: post.youtube_url ?? "",
    when: post.status === "AGENDADO" ? "schedule" : "now",
    scheduled_at: post.status === "AGENDADO" ? toDateTimeLocal(post.published_at) : "",
  };
}

function toInput(values: PostValues, editing: AdminPost | null): PostInput {
  const keepsPublication = editing !== null && editing.status === "PUBLICADO";

  return {
    title: values.title.trim(),
    slug: values.slug,
    body: values.body,
    author_display: values.author_display,
    youtube_url: values.youtube_url,
    published_at: keepsPublication
      ? null
      : values.when === "schedule"
        ? toApiDateTime(values.scheduled_at)
        : editing !== null
          ? new Date().toISOString()
          : null,
  };
}

/**
 * Cadastro e edição de mensagem da Palavra Viva (design: AdminPalavraViva; CAP-03): título, endereço gerado do título,
 * pregador, texto formatado (editor restrito), vídeo do YouTube e quando publicar. O rascunho fica no navegador (FR-077).
 * O servidor sanitiza o texto de novo e avisa se removeu algo (`sanitization_warning`, BR-046).
 */
export function PostForm({ id, userId }: { id: number | null; userId: number }) {
  const editing = id !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ ...adminPostQuery(id ?? 0), enabled: editing });
  const post = query.data ?? null;

  const form = useForm<PostValues>({
    resolver: zodResolver(postSchema),
    defaultValues: EMPTY,
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
  const [saved, setSaved] = useState<{ title: string; slug: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const values = watch();
  const videoId = youtubeVideoId(values.youtube_url);
  const draft = useFormDraft<PostValues>({
    userId,
    form: "mensagem",
    id: id ?? "novo",
    values,
    dirty: isDirty && saved === null,
    parse: parseDraft,
    enabled: !editing || post !== null,
  });

  // Campos controlados por setValue (sem input próprio) precisam estar registrados para entrar no envio e na validação
  useEffect(() => {
    register("body");
    register("when");
    register("scheduled_at");
  }, [register]);

  const loaded = useRef(false);
  useEffect(() => {
    if (post && !loaded.current) {
      loaded.current = true;
      reset(valuesOf(post));
    }
  }, [post, reset]);

  // O endereço acompanha o título enquanto a mensagem é nova e ele não foi mexido; depois de criada, não muda
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

  const save = useMutation({
    mutationFn: (formValues: PostValues): Promise<SavedPost> => {
      const input = toInput(formValues, post);
      return editing ? updatePost(id, input) : createPost(input);
    },
    onSuccess: async (result) => {
      draft.clear();
      setWarning(result.sanitizationWarning);
      await queryClient.invalidateQueries({ queryKey: ["admin", "palavra-viva"] });
      void queryClient.invalidateQueries({ queryKey: ["public", "palavra-viva"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot", "home"] });

      if (editing) {
        toast.success(text.updated);
        // O corpo voltou sanitizado: mostra o que ficou e avisa se algo saiu
        reset(valuesOf(result.post));
        return;
      }
      setSaved({
        title:
          result.post.status === "AGENDADO"
            ? text.createdScheduled(whenLabel(result.post.published_at))
            : text.createdNow,
        slug: result.post.slug,
      });
    },
  });

  function onSubmit(formValues: PostValues): void {
    setProblem(null);
    setSlugConflict(false);

    if (formValues.body.trim() === "") {
      setError("body", { type: "required", message: text.bodyRequired }, { shouldFocus: true });
      return;
    }

    save.mutate(formValues, {
      onError: (error) => {
        if (isApiError(error) && error.code === "DUPLICATE_SLUG") {
          // O endereço já existe: libera o campo para a pessoa ajustar (o design o deixa travado)
          setSlugConflict(true);
          setSlugTouched(true);
          setError("slug", { type: "server", message: error.message }, { shouldFocus: true });
          return;
        }

        const applied = applyApiErrors(error, setError, FIELDS);
        if (isApiError(error) && error.fieldErrors().published_at) {
          setError("scheduled_at", { type: "server", message: error.fieldErrors().published_at });
        }
        if (applied.general) setProblem(applied.general);
      },
    });
  }

  const remove = useMutation({
    mutationFn: () => deletePost(id ?? 0),
    onSuccess: async () => {
      draft.clear();
      await queryClient.invalidateQueries({ queryKey: ["admin", "palavra-viva"] });
      void queryClient.invalidateQueries({ queryKey: ["public", "palavra-viva"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot", "home"] });
      toast.success(text.deleted);
      void navigate("/admin/palavra-viva");
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : messages.errors.generic);
    },
  });

  const title = editing ? text.editTitle : text.newTitle;

  if (editing && query.isError) {
    const missing = isApiError(query.error) && query.error.status === 404;
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <title>{`${text.editTitle} — Painel PIBLS`}</title>
        <Link
          to="/admin/palavra-viva"
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

  if (editing && post === null) return <LoadingBlock count={4} className="mx-auto max-w-3xl" />;

  const busy = save.isPending;
  const alreadyPublished = post?.status === "PUBLICADO";
  // O endereço vem do título e não se digita; só destrava num conflito (BR-032) ou se o rascunho trouxe um endereço próprio
  const slugLocked = editing || (!slugConflict && !slugTouched);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${title} — Painel PIBLS`}</title>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            to="/admin/palavra-viva"
            className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-[18px]" />
            {text.back}
          </Link>
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
        </div>
        {draft.savedAt !== null ? (
          <span
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            role="status"
          >
            <CheckIcon aria-hidden="true" className="size-4" />
            {draftText.savedAt(formatTime(new Date(draft.savedAt)))}
          </span>
        ) : null}
      </header>

      {draft.offered ? <DraftBanner onRestore={restoreDraft} onDiscard={draft.discard} /> : null}

      {saved ? (
        <SavedNotice
          title={saved.title}
          links={[
            { to: `/palavra-viva/${saved.slug}`, label: text.openInSite, external: true },
            { to: "/admin/palavra-viva", label: text.backToList },
          ]}
        >
          {text.address(saved.slug)}
        </SavedNotice>
      ) : (
        <form
          noValidate
          aria-label={text.formLabel}
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-wrap items-start gap-6"
        >
          <div className="flex min-w-0 flex-[3_1_28rem] flex-col gap-5">
            {problem ? (
              <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                <CircleAlertIcon aria-hidden="true" />
                {problem}
              </Alert>
            ) : null}

            <FormSection>
              <FormField id="titulo" label={text.titleField} error={errors.title?.message}>
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
                      className="min-w-0 flex-1 rounded-none border-0"
                      {...register("slug", { onChange: () => setSlugTouched(true) })}
                    />
                  </span>
                )}
              </FormField>
              <div className="flex flex-wrap gap-4">
                <div className="flex-[1_1_14rem]">
                  <FormField
                    id="pregador"
                    label={text.preacher}
                    optionalLabel={messages.common.optional}
                    error={errors.author_display?.message}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="text"
                        maxLength={120}
                        {...register("author_display")}
                      />
                    )}
                  </FormField>
                </div>
              </div>
            </FormSection>

            <FormSection title={text.textSection} id="t-texto">
              <Suspense fallback={<LoadingBlock count={2} aria-label={text.loadingEditor} />}>
                <RichTextEditor
                  id="corpo"
                  label={text.bodyLabel}
                  value={values.body}
                  onChange={(html) =>
                    setValue("body", html, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.body?.message}
                  sanitizationWarning={warning}
                  disabled={busy}
                />
              </Suspense>
            </FormSection>
          </div>

          <aside className="flex min-w-0 flex-[2_1_18rem] flex-col gap-5">
            <FormSection title={text.videoSection} id="t-video">
              <FormField
                id="youtube"
                label={text.youtube}
                optionalLabel={messages.common.optional}
                hint={videoId ? text.youtubeOk : text.youtubeHint}
                error={errors.youtube_url?.message}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="url"
                    inputMode="url"
                    placeholder="https://www.youtube.com/watch?v=…"
                    {...register("youtube_url")}
                  />
                )}
              </FormField>
              {values.youtube_url.trim() !== "" && videoId === null && !errors.youtube_url ? (
                <p className="m-0 text-sm font-semibold text-destructive" role="alert">
                  {ruleMessages.youtube}
                </p>
              ) : null}
            </FormSection>

            <FormSection>
              {alreadyPublished && post ? (
                <p className="m-0">
                  {contentAdminMessages.schedule.alreadyPublished(whenLabel(post.published_at))}
                </p>
              ) : (
                <PublishWhen
                  name="quando"
                  when={values.when}
                  scheduledAt={values.scheduled_at}
                  onWhenChange={(next) => setValue("when", next, { shouldDirty: true })}
                  onScheduledAtChange={(next) =>
                    setValue("scheduled_at", next, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.scheduled_at?.message}
                  disabled={busy}
                />
              )}
              <Button type="submit" size="lg" className="px-5 font-bold" disabled={busy}>
                {busy ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
                {busy
                  ? text.saving
                  : editing
                    ? text.save
                    : values.when === "schedule"
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
              {editing && post ? (
                <>
                  <a
                    href={`/palavra-viva/${post.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-11 items-center justify-center font-bold"
                  >
                    {text.preview}
                  </a>
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
                </>
              ) : null}
              <p className="m-0 text-sm text-muted-foreground">{draftText.note}</p>
            </FormSection>
          </aside>
        </form>
      )}

      {editing && post ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={text.deleteTitle(post.title)}
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
