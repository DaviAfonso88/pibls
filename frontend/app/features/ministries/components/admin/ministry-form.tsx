import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleAlertIcon, LockIcon } from "lucide-react";
import { Suspense, lazy, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { isApiError } from "~/shared/http/errors";
import { useUnsavedWarning } from "~/shared/lib/use-unsaved-warning";
import { applyApiErrors } from "~/shared/http/forms";
import { messages } from "~/shared/messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { ConfirmDialog } from "~/shared/ui/confirm-dialog";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Spinner } from "~/shared/ui/spinner";
import {
  createMinistry,
  deleteMinistry,
  updateMinistry,
  type AdminMinistry,
  type MinistryCategory,
  type MinistryInput,
} from "../../admin-api";
import { ministriesAdminMessages } from "../../admin-messages";
import { ministrySchema, type MinistryValues } from "../../admin-schema";

// O TipTap pesa: só a tela de edição o carrega (Frontend → Lazy loading)
const RichTextEditor = lazy(() =>
  import("~/shared/ui/rich-text-editor").then((module) => ({ default: module.RichTextEditor })),
);

const text = ministriesAdminMessages.form;

const FIELDS = [
  "name",
  "description",
  "leaders_text",
  "schedule_text",
  "neighborhood",
  "contact_phone",
  "private_address",
  "contact_email",
] as const;

function toValues(ministry: AdminMinistry | null): MinistryValues {
  return {
    name: ministry?.name ?? "",
    description: ministry?.description ?? "",
    leaders_text: ministry?.leaders_text ?? "",
    schedule_text: ministry?.schedule_text ?? "",
    neighborhood: ministry?.neighborhood ?? "",
    contact_phone: ministry?.contact_phone ?? "",
    private_address: ministry?.private_address ?? "",
    contact_email: ministry?.contact_email ?? "",
  };
}

const orNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

function toInput(category: MinistryCategory, values: MinistryValues): MinistryInput {
  return {
    category,
    name: values.name.trim(),
    description: orNull(values.description),
    leaders_text: orNull(values.leaders_text),
    schedule_text: category === "MINISTERIO" ? null : orNull(values.schedule_text),
    neighborhood: category === "CELULA" ? orNull(values.neighborhood) : null,
    contact_phone: orNull(values.contact_phone),
    private_address: category === "CELULA" ? orNull(values.private_address) : null,
    contact_email: orNull(values.contact_email),
  };
}

/**
 * Formulário de um ministério, grupo ou célula (design: AdminMinisterios, coluna da direita; CAP-16). Os campos
 * "Só para a equipe" (endereço da reunião e e-mail interno) nunca aparecem no site (BR-048). A descrição é texto
 * formatado e o servidor a sanitiza (BR-046). Excluir só funciona para item sem vínculos (BR-047).
 */
export function MinistryForm({
  category,
  ministry,
  onSaved,
  onDeleted,
}: {
  category: MinistryCategory;
  /** `null` = item novo. */
  ministry: AdminMinistry | null;
  onSaved: (saved: AdminMinistry, created: boolean) => void;
  onDeleted: () => void;
}) {
  const resolver = useMemo(() => zodResolver(ministrySchema(category)), [category]);
  const form = useForm<MinistryValues>({ resolver, defaultValues: toValues(ministry) });
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = form;
  useUnsavedWarning(isDirty);

  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMutation({
    mutationFn: (values: MinistryValues) => {
      const input = toInput(category, values);
      return ministry === null ? createMinistry(input) : updateMinistry(ministry.id, input);
    },
    onSuccess: (result) => {
      setProblem(null);
      setSaved(true);
      onSaved(result, ministry === null);
    },
    onError: (error) => {
      setSaved(false);
      setProblem(applyApiErrors(error, setError, FIELDS).general);
    },
  });

  async function remove(): Promise<void> {
    if (ministry === null) return;
    try {
      await deleteMinistry(ministry.id);
      setConfirmDelete(false);
      onDeleted();
    } catch (error) {
      // Um item em uso volta com a frase da BR-047 (409): aparece na tela, com a saída de desativar
      setConfirmDelete(false);
      setProblem(isApiError(error) ? error.message : messages.errors.generic);
    }
  }

  const title =
    ministry === null ? ministriesAdminMessages.newLabel[category] : text.editTitle(ministry.name);
  const showSchedule = category !== "MINISTERIO";
  const isCell = category === "CELULA";

  return (
    <form
      noValidate
      aria-labelledby="t-edicao"
      onSubmit={handleSubmit((values) => {
        setSaved(false);
        setProblem(null);
        save.mutate(values);
      })}
      className="flex min-w-0 flex-[2_1_20rem] flex-col gap-3.5 rounded-[14px] border border-border bg-card p-5"
    >
      <h2 id="t-edicao" className="m-0 text-lg font-extrabold">
        {title}
      </h2>

      {problem ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <CircleAlertIcon aria-hidden="true" />
          {problem}
        </Alert>
      ) : null}

      <FormField id="e-nome" label={text.name} error={errors.name?.message}>
        {(control) => (
          <Input
            {...control}
            type="text"
            maxLength={120}
            {...register("name")}
            autoComplete="off"
          />
        )}
      </FormField>

      <Suspense fallback={<LoadingBlock count={2} aria-label={text.loadingEditor} />}>
        <RichTextEditor
          id="e-desc"
          label={text.description}
          value={watch("description")}
          onChange={(html) => setValue("description", html, { shouldDirty: true })}
          error={errors.description?.message}
          disabled={save.isPending}
        />
      </Suspense>

      {showSchedule ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isCell ? (
            <FormField id="e-bairro" label={text.neighborhood} error={errors.neighborhood?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  maxLength={80}
                  {...register("neighborhood")}
                  autoComplete="off"
                />
              )}
            </FormField>
          ) : null}
          <FormField id="e-quando" label={text.schedule} error={errors.schedule_text?.message}>
            {(control) => (
              <Input
                {...control}
                type="text"
                maxLength={120}
                placeholder={text.schedulePlaceholder}
                {...register("schedule_text")}
                autoComplete="off"
              />
            )}
          </FormField>
        </div>
      ) : null}

      <FormField id="e-lider" label={text.leaders} error={errors.leaders_text?.message}>
        {(control) => (
          <Input
            {...control}
            type="text"
            maxLength={500}
            placeholder={text.leadersPlaceholder}
            {...register("leaders_text")}
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField id="e-fone" label={text.phone} error={errors.contact_phone?.message}>
        {(control) => (
          <Input
            {...control}
            type="tel"
            inputMode="tel"
            {...register("contact_phone")}
            autoComplete="off"
          />
        )}
      </FormField>

      <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-muted/50 p-3.5">
        <legend className="inline-flex items-center gap-1.5 px-1.5 font-extrabold">
          <LockIcon aria-hidden="true" className="size-4" />
          {text.staffOnly}
        </legend>
        {isCell ? (
          <FormField
            id="e-end"
            label={text.address}
            hint={text.addressHint}
            error={errors.private_address?.message}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                autoComplete="off"
                maxLength={300}
                {...register("private_address")}
              />
            )}
          </FormField>
        ) : null}
        <FormField
          id="e-email"
          label={text.email}
          hint={text.emailHint}
          error={errors.contact_email?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="off"
              {...register("contact_email")}
              spellCheck={false}
            />
          )}
        </FormField>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? (
            <>
              <Spinner aria-hidden="true" data-icon="inline-start" />
              {text.saving}
            </>
          ) : (
            text.save
          )}
        </Button>
        {ministry !== null ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={save.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            {text.delete}
          </Button>
        ) : null}
        <span role="status" aria-live="polite" className="font-bold text-success-foreground">
          {saved ? (ministry === null ? text.created : text.saved) : null}
        </span>
      </div>

      {ministry !== null ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={text.deleteTitle(ministry.name)}
          description={text.deleteBody}
          confirmLabel={text.deleteConfirm}
          destructive
          onConfirm={remove}
        />
      ) : null}
    </form>
  );
}
