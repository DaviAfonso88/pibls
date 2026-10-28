import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { Link } from "react-router";
import { isApiError } from "~/shared/http/errors";
import { useUnsavedWarning } from "~/shared/lib/use-unsaved-warning";
import { applyApiErrors } from "~/shared/http/forms";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Spinner } from "~/shared/ui/spinner";
import { adminSettingsQuery, updateSettings, type AdminSettingsResult } from "../../settings-api";
import { LEAD_TYPES, settingsMessages as text, type LeadTypeCode } from "../../settings-messages";
import {
  SECTION_KEYS,
  changedSections,
  toFormValues,
  toPatch,
  validateSections,
  type SectionIssue,
  type SettingsFormValues,
} from "../../settings-model";
import { FormSection } from "./form-parts";
import { RecipientsEditor } from "./recipients-editor";
import {
  AddressSection,
  ChannelsSection,
  NoticesSection,
  ScheduleSection,
} from "./settings-sections";

const EMPTY: SettingsFormValues = {
  schedule: [],
  campaign_notice: { active: false, title: "", text: "" },
  lords_supper_notice: { active: false, text: "" },
  address: {
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip: "",
  },
  map_links: { google_maps_url: "", waze_url: "", embed_url: "" },
  whatsapp: { phone: "", default_text: "" },
  youtube_links: { channel_url: "", live_url: "" },
  social_links: [],
  notification_recipients: { VISITANTE: [], MEMBRO: [], ORACAO: [], CONTATO: [], MINISTERIO: [] },
};

function leadTypeOf(path: string): LeadTypeCode | null {
  const type = path.split(".")[1];
  return LEAD_TYPES.find((item) => item === type) ?? null;
}

/**
 * Configurações do site no painel (design: AdminConfiguracoes; CAP-17). Uma tela para as nove chaves; o botão salva só as
 * seções que mudaram, e só elas são validadas. Assim um valor provisório que ainda não foi trocado (o CEP do conteúdo
 * inicial, por exemplo) não impede de salvar um horário. O servidor é a validação final (BR-051 etc.) e substitui cada
 * chave enviada por inteiro. Sem rascunho local: o formulário tem e-mails e endereços de contato.
 */
export function SettingsForm() {
  const queryClient = useQueryClient();
  const query = useQuery(adminSettingsQuery());
  const form = useForm<SettingsFormValues>({ defaultValues: EMPTY });
  const { handleSubmit, reset, setError, clearErrors, watch, setValue } = form;
  useUnsavedWarning(form.formState.isDirty);

  const baseline = useRef<SettingsFormValues | null>(null);
  const [status, setStatus] = useState<"saved" | "unchanged" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [recipientErrors, setRecipientErrors] = useState<Partial<Record<LeadTypeCode, string>>>({});

  useEffect(() => {
    if (query.data && baseline.current === null) {
      baseline.current = toFormValues(query.data.data);
      reset(baseline.current);
    }
  }, [query.data, reset]);

  /** Põe cada problema no campo dele; o que não pertence a um campo vai para o aviso geral. */
  function showIssues(issues: readonly SectionIssue[]): void {
    clearErrors();
    const byType: Partial<Record<LeadTypeCode, string>> = {};
    const general: string[] = [];
    let focused = false;

    for (const issue of issues) {
      const root = issue.path.split(".")[0];
      if (!SECTION_KEYS.some((key) => key === root) || !issue.path.includes(".")) {
        general.push(issue.message);
      } else if (root === "notification_recipients") {
        const type = leadTypeOf(issue.path);
        if (type !== null) byType[type] ??= issue.message;
        else general.push(issue.message);
      } else {
        // O caminho vem do esquema ou do servidor (`address.zip`, `schedule.0.time`), os mesmos nomes dos campos
        setError(
          issue.path as FieldPath<SettingsFormValues>,
          { type: "validate", message: issue.message },
          { shouldFocus: !focused },
        );
        focused = true;
      }
    }

    setRecipientErrors(byType);
    setProblem(general.length > 0 ? general.join(" ") : null);
  }

  const save = useMutation({
    mutationFn: updateSettings,
    onSuccess: async (result: AdminSettingsResult) => {
      queryClient.setQueryData(adminSettingsQuery().queryKey, result);
      baseline.current = toFormValues(result.data);
      reset(baseline.current);
      clearErrors();
      setRecipientErrors({});
      setProblem(null);
      setStatus("saved");
      // O site público lê o snapshot `settings`: a próxima leitura já traz o valor novo
      void queryClient.invalidateQueries({ queryKey: ["snapshot", "settings"] });
    },
    onError: (error) => {
      setStatus(null);

      if (isApiError(error) && error.isValidation) {
        showIssues(
          Object.entries(error.fieldErrors()).map(([path, message]) => ({ path, message })),
        );
        return;
      }
      setProblem(applyApiErrors(error, setError, []).general);
    },
  });

  function onValid(values: SettingsFormValues): void {
    const saved = baseline.current;
    if (saved === null) return;

    setStatus(null);
    setProblem(null);
    const keys = changedSections(values, saved);

    if (keys.length === 0) {
      clearErrors();
      setRecipientErrors({});
      setStatus("unchanged");
      return;
    }

    const issues = validateSections(values, keys);
    if (issues.length > 0) {
      showIssues(issues);
      return;
    }

    clearErrors();
    setRecipientErrors({});
    save.mutate(toPatch(values, keys));
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          message={text.loadError}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  if (!query.data) return <LoadingBlock count={4} className="mx-auto max-w-6xl" />;

  const recipients = watch("notification_recipients");

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
        <div role="status" aria-live="polite" className="min-h-6">
          {status === "saved" ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-success-foreground">
              <CircleCheckIcon aria-hidden="true" className="size-[18px]" />
              {text.saved}
            </span>
          ) : null}
          {status === "unchanged" ? (
            <span className="font-semibold text-muted-foreground">{text.nothingToSave}</span>
          ) : null}
        </div>
      </header>

      {query.data.warnings.length > 0 ? (
        <Alert
          variant="destructive"
          role="alert"
          className="flex flex-col gap-2 rounded-xl border-destructive/40 bg-destructive/5"
        >
          {query.data.warnings.map((warning) => (
            <div
              key={warning.lead_type}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="flex items-start gap-2.5">
                <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-5 flex-none" />
                <span>
                  <strong>{text.warning.title(text.recipients.types[warning.lead_type])}</strong>{" "}
                  {text.warning.text}
                </span>
              </span>
              <a
                href="#destinatarios"
                className="inline-flex min-h-11 items-center font-bold text-destructive underline-offset-2 hover:underline"
              >
                {text.warning.fix}
              </a>
            </div>
          ))}
        </Alert>
      ) : null}

      {problem ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <CircleAlertIcon aria-hidden="true" />
          {problem}
        </Alert>
      ) : null}

      <form
        noValidate
        aria-label={text.formLabel}
        onSubmit={handleSubmit(onValid)}
        className="flex flex-col gap-5"
      >
        <ScheduleSection form={form} />
        <NoticesSection form={form} />
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <AddressSection form={form} />
          <ChannelsSection form={form} />
        </div>

        <section
          id="destinatarios"
          aria-labelledby="t-dest"
          className="flex scroll-mt-4 flex-col gap-3 rounded-[14px] border border-border bg-card p-5"
        >
          <div className="flex flex-col gap-0.5">
            <h2 id="t-dest" className="m-0 text-lg font-extrabold">
              {text.recipients.title}
            </h2>
            <p className="m-0 text-[15px] text-muted-foreground">{text.recipients.intro}</p>
          </div>
          <RecipientsEditor
            value={recipients}
            errors={recipientErrors}
            onChange={(type, next) => {
              setValue(`notification_recipients.${type}`, next, {
                shouldDirty: true,
                shouldTouch: true,
              });
              setRecipientErrors((current) => ({ ...current, [type]: undefined }));
            }}
          />
          <p className="m-0 text-sm text-muted-foreground">
            {text.recipients.footnote.split(text.recipients.footnoteLink)[0]}
            <Link to="/admin/ministerios">{text.recipients.footnoteLink}</Link>
            {text.recipients.footnote.split(text.recipients.footnoteLink)[1]}
          </p>
        </section>

        <FormSection>
          <div className="flex flex-wrap items-center gap-3">
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
            <span className="text-sm text-muted-foreground">{text.saveHint}</span>
          </div>
        </FormSection>
      </form>
    </div>
  );
}
