import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon, CircleCheckIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { digitsOnly, formatCnpj, formatDateTime, maskCnpj } from "~/shared/format";
import { isApiError } from "~/shared/http/errors";
import { applyApiErrors } from "~/shared/http/forms";
import { messages } from "~/shared/messages";
import { ruleMessages } from "~/shared/rule-messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/shared/ui/dialog";
import { ErrorState } from "~/shared/ui/error-state";
import { FileDrop } from "~/shared/ui/file-drop";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Spinner } from "~/shared/ui/spinner";
import { Textarea } from "~/shared/ui/textarea";
import { adminPixQuery, updatePix, type AdminPix } from "../../pix-api";
import { pixAdminMessages as text } from "../../pix-messages";
import { pixSchema, type PixValues } from "../../schemas";

const FIELDS = ["pix_key", "beneficiary_name", "copy_paste_code"] as const;
const QR_MAX_BYTES = 1024 * 1024;

/** Um bloco da tela (design: cartão branco com título). */
function Card({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5"
    >
      <h2 id={id} className="m-0 text-lg font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** "No site agora" e o histórico das alterações (design: AdminPix, coluna da direita). */
function Sidebar({
  current,
  history,
}: {
  current: AdminPix;
  history: readonly {
    id: number;
    occurred_at: string;
    actor?: { id: number; name: string } | null;
    fields: string[];
  }[];
}) {
  return (
    <aside className="flex min-w-0 flex-[2_1_17rem] flex-col gap-5">
      <Card title={text.siteNow} id="t-site">
        <span className="text-sm text-muted-foreground">{text.siteKey}</span>
        <span className="text-xl font-extrabold tracking-wide">{formatCnpj(current.pix_key)}</span>
        <span className="text-[15px]">{current.beneficiary_name}</span>
        <Link to="/contribua" className="inline-flex min-h-11 items-center self-start font-bold">
          {text.seeContribua}
        </Link>
      </Card>
      <Card title={text.history} id="t-hist">
        {history.length === 0 ? (
          <p className="m-0 text-muted-foreground">{text.historyEmpty}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-col border-b border-border py-2.5 last:border-b-0"
              >
                <span className="font-semibold">
                  {text.historyItem(item.actor?.name ?? null, item.fields)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(item.occurred_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </aside>
  );
}

/**
 * Chave PIX no painel (design: AdminPix; CAP-18). Salvar abre o pedido da senha (BR-060); o servidor confere a senha, os
 * destinatários do alerta no `.env` (BR-063), o CNPJ (BR-061), o Copia e Cola (BR-062) e o QR (BR-045), grava a auditoria e
 * enfileira o alerta. Sem rascunho local: é a única tela de dados do site que nunca guarda nada no navegador (FR-077).
 * A senha existe só no diálogo e na requisição; não vai para URL, cache, log nem armazenamento.
 */
export function PixForm() {
  const queryClient = useQueryClient();
  const query = useQuery(adminPixQuery());
  const current = query.data?.data ?? null;

  const form = useForm<PixValues>({
    resolver: zodResolver(pixSchema),
    defaultValues: { pix_key: "", beneficiary_name: "", copy_paste_code: "" },
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = form;

  const [qr, setQr] = useState<File | null>(null);
  const [qrError, setQrError] = useState<string | undefined>();
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState<PixValues | null>(null);
  const [password, setPassword] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  const loaded = useRef(false);
  useEffect(() => {
    if (current && !loaded.current) {
      loaded.current = true;
      reset({
        pix_key: formatCnpj(current.pix_key),
        beneficiary_name: current.beneficiary_name,
        copy_paste_code: current.copy_paste_code ?? "",
      });
    }
  }, [current, reset]);

  const save = useMutation({
    mutationFn: ({ values, secret }: { values: PixValues; secret: string }) =>
      updatePix(
        {
          pix_key: digitsOnly(values.pix_key),
          beneficiary_name: values.beneficiary_name,
          copy_paste_code: values.copy_paste_code,
          current_password: secret,
        },
        qr,
      ),
    onSuccess: async (result) => {
      setPending(null);
      setPassword("");
      setDialogError(null);
      setQr(null);
      setQrError(undefined);
      setProblem(null);
      setSaved(true);
      reset({
        pix_key: formatCnpj(result.pix_key),
        beneficiary_name: result.beneficiary_name,
        copy_paste_code: result.copy_paste_code ?? "",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "pix"] });
      void queryClient.invalidateQueries({ queryKey: ["snapshot", "settings"] });
    },
    onError: (error) => {
      setSaved(false);

      if (isApiError(error) && error.code === "PASSWORD_CONFIRMATION_FAILED") {
        // O diálogo fica aberto para tentar de novo, com a frase da BR-060
        setDialogError(error.message);
        setPassword("");
        passwordInput.current?.focus();
        return;
      }
      if (isApiError(error) && error.status === 429) {
        setDialogError(error.message || text.tooManyAttempts);
        setPassword("");
        return;
      }

      // Qualquer outra recusa: fecha o diálogo e mostra na tela (a senha já não é necessária)
      setPending(null);
      setPassword("");
      setDialogError(null);

      if (isApiError(error) && error.code === "PIX_ALERT_NOT_CONFIGURED") {
        setProblem(error.message || ruleMessages.pixAlertBlocked);
        return;
      }
      if (isApiError(error) && error.isValidation) {
        const fieldErrors = error.fieldErrors();
        if (fieldErrors.qr_image) setQrError(fieldErrors.qr_image);
        const applied = applyApiErrors(error, setError, FIELDS);
        setProblem(applied.general && !fieldErrors.qr_image ? applied.general : null);
        return;
      }
      setProblem(isApiError(error) ? error.message : messages.errors.generic);
    },
  });

  function onValid(values: PixValues): void {
    setProblem(null);
    setSaved(false);

    if (current?.qr_image_url == null && qr === null) {
      setQrError(text.qrRequired);
      return;
    }

    setDialogError(null);
    setPassword("");
    setPending(values);
  }

  function confirm(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending === null || password === "") return;
    save.mutate({ values: pending, secret: password });
  }

  function closeDialog(): void {
    if (save.isPending) return;
    setPending(null);
    setPassword("");
    setDialogError(null);
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

  if (!current || !query.data) return <LoadingBlock count={4} className="mx-auto max-w-6xl" />;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${text.title} — Painel PIBLS`}</title>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
          {text.title}
        </h1>
        <p className="m-0 text-muted-foreground">{text.intro}</p>
      </header>

      <Alert variant="warning" role="note" className="flex items-start gap-3 rounded-xl">
        <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-5 flex-none" />
        <span>{text.notice}</span>
      </Alert>

      {saved ? (
        <Alert variant="success" role="status" className="flex items-start gap-2.5 rounded-xl">
          <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-5 flex-none" />
          <span>
            <strong>{text.saved}</strong> {text.savedAlert}
          </span>
        </Alert>
      ) : null}

      {problem ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <CircleAlertIcon aria-hidden="true" />
          {problem}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <form
          noValidate
          aria-label={text.formLabel}
          onSubmit={handleSubmit(onValid)}
          className="flex min-w-0 flex-[3_1_26rem] flex-col gap-4 rounded-[14px] border border-border bg-card p-5"
        >
          <h2 className="m-0 text-lg font-extrabold">{text.formHeading}</h2>

          <FormField id="tipo" label={text.keyType}>
            {(control) => <Input {...control} readOnly value={text.keyTypeValue} />}
          </FormField>
          <FormField
            id="chave"
            label={text.key}
            hint={text.keyHint}
            error={errors.pix_key?.message}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                className="text-lg tracking-wide"
                {...register("pix_key", {
                  onChange: (event) => setValue("pix_key", maskCnpj(event.target.value)),
                })}
              />
            )}
          </FormField>
          <FormField
            id="favorecido"
            label={text.beneficiary}
            hint={text.beneficiaryHint}
            error={errors.beneficiary_name?.message}
          >
            {(control) => (
              <Input {...control} type="text" maxLength={120} {...register("beneficiary_name")} />
            )}
          </FormField>

          <div className="flex flex-col gap-3">
            <span className="font-bold">{text.qr}</span>
            <div className="flex flex-wrap items-center gap-4">
              {current.qr_image_url ? (
                <img
                  src={current.qr_image_url}
                  alt={text.qrCurrent}
                  width={112}
                  height={112}
                  className="size-28 flex-none rounded-[10px] border border-border bg-background object-contain"
                />
              ) : (
                <span className="flex size-28 flex-none items-center justify-center rounded-[10px] border border-dashed border-border-strong p-2 text-center text-[13px] font-bold text-muted-foreground">
                  {text.qrNone}
                </span>
              )}
              <div className="min-w-0 flex-1 basis-60">
                <FileDrop
                  id="qr"
                  label={text.qrFile}
                  hint={text.qrHint}
                  accept={["image/png", "image/jpeg"]}
                  maxBytes={QR_MAX_BYTES}
                  file={qr}
                  onFileChange={(file) => {
                    setQr(file);
                    setQrError(undefined);
                  }}
                  typeMessage={ruleMessages.qrImage}
                  sizeMessage={ruleMessages.qrImage}
                  error={qrError}
                  disabled={save.isPending}
                />
              </div>
            </div>
          </div>

          <FormField
            id="copia-e-cola"
            label={text.code}
            optionalLabel={messages.common.optional}
            hint={text.codeHint}
            error={errors.copy_paste_code?.message}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                maxLength={512}
                spellCheck={false}
                className="font-mono text-sm"
                {...register("copy_paste_code")}
              />
            )}
          </FormField>

          <Button type="submit" size="lg" className="self-start px-5 font-bold">
            {text.save}
          </Button>
        </form>

        <Sidebar current={current} history={query.data.history} />
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent showCloseButton={false}>
          <form onSubmit={confirm} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold">{text.confirmTitle}</DialogTitle>
              <DialogDescription className="text-base">{text.confirmBody}</DialogDescription>
            </DialogHeader>
            <FormField id="senha" label={text.password} error={dialogError ?? undefined}>
              {(control) => (
                <Input
                  {...control}
                  ref={passwordInput}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setDialogError(null);
                  }}
                />
              )}
            </FormField>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={closeDialog}
              >
                {text.cancel}
              </Button>
              <Button type="submit" disabled={save.isPending || password === ""}>
                {save.isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
                {save.isPending ? text.saving : text.confirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
