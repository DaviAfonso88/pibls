import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, MessageCircleIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { formatDateTime, formatPhone } from "~/shared/format";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { Button } from "~/shared/ui/button";
import { buttonClassName } from "~/shared/ui/button-variants";
import { Checkbox } from "~/shared/ui/checkbox";
import { ConfirmDialog } from "~/shared/ui/confirm-dialog";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { Spinner } from "~/shared/ui/spinner";
import { StatusBadge, type StatusTone } from "~/shared/ui/status-badge";
import { Textarea } from "~/shared/ui/textarea";
import {
  assigneesQuery,
  eraseLead,
  leadQuery,
  patchLead,
  type Inbox,
  type LeadActivity,
  type LeadDetail as LeadDetailData,
  type LeadPatch,
  type LeadStatus,
} from "../admin-api";
import { inboxMessages } from "../inbox-messages";

const text = inboxMessages.detail;
const NOTE_MAX = 1000;

const STATUS_TONE: Record<LeadStatus, StatusTone> = {
  NOVO: "info",
  EM_ATENDIMENTO: "neutral",
  CONCLUIDO: "success",
};

function Card({
  title,
  id,
  children,
  className,
}: {
  title: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-3 rounded-[14px] border bg-card p-5 ${className ?? "border-border"}`}
    >
      <h2 id={id} className="m-0 text-lg font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return text.fields.notProvided;
  return value ? text.fields.yes : text.fields.no;
}

/** Os dados que o formulário público daquele tipo coleta (CAP-05), na ordem em que a equipe lê. */
export function leadFields(lead: LeadDetailData): Array<{ label: string; value: string }> {
  const phone = lead.phone ? formatPhone(lead.phone) : text.fields.notProvided;
  const email = lead.email ?? text.fields.notProvided;

  switch (lead.type) {
    case "VISITANTE":
      return [
        { label: text.fields.phone, value: phone },
        { label: text.fields.neighborhood, value: lead.neighborhood ?? text.fields.notProvided },
        { label: text.fields.wantsVisit, value: yesNo(lead.wants_visit) },
        { label: text.fields.wantsCellGroup, value: yesNo(lead.wants_cell_group) },
        { label: text.fields.group, value: lead.group?.name ?? text.fields.notProvided },
      ];
    case "MEMBRO":
      return [
        { label: text.fields.phone, value: phone },
        { label: text.fields.email, value: email },
        { label: text.fields.fromOtherChurch, value: yesNo(lead.from_other_baptist_church) },
      ];
    case "ORACAO":
      return [
        { label: text.fields.phone, value: phone },
        { label: text.fields.email, value: email },
      ];
    case "CONTATO":
      return [
        { label: text.fields.phone, value: phone },
        { label: text.fields.email, value: email },
      ];
    case "MINISTERIO":
      return [
        { label: text.fields.ministry, value: lead.ministry?.name ?? text.fields.notProvided },
        { label: text.fields.phone, value: phone },
        { label: text.fields.email, value: email },
      ];
  }
}

/** Uma linha do histórico (CAP-10): o que mudou, quem fez e quando. */
export function activityLines(activity: LeadActivity): string[] {
  const who = activity.actor.name;
  const lines: string[] = [];

  if (activity.to_status && activity.from_status) {
    const label =
      activity.to_status === "EM_ATENDIMENTO"
        ? activity.from_status === "CONCLUIDO"
          ? "Atendimento reaberto"
          : "Atendimento iniciado"
        : activity.to_status === "CONCLUIDO"
          ? "Marcado como concluído"
          : "Devolvido à fila";
    lines.push(text.history.statusBy(label, who));
  } else if (!activity.note) {
    lines.push(text.history.assignedBy(who));
  }

  if (activity.note) lines.push(text.history.noteBy(who));

  return lines;
}

function History({ lead }: { lead: LeadDetailData }) {
  const items = [...lead.activities].reverse();

  return (
    <Card title={text.history.title} id="t-historico">
      <ol className="m-0 flex list-none flex-col p-0">
        {items.map((activity) => (
          <li key={activity.id} className="flex gap-3 border-b border-muted py-2.5 last:border-b-0">
            <span aria-hidden="true" className="mt-2 size-2.5 flex-none rounded-full bg-primary" />
            <span className="flex min-w-0 flex-col">
              {activityLines(activity).map((line) => (
                <span key={line} className="font-semibold">
                  {line}
                </span>
              ))}
              {activity.note ? (
                <span className="break-words whitespace-pre-line text-foreground/90">
                  {activity.note}
                </span>
              ) : null}
              <span className="text-sm text-muted-foreground">
                {formatDateTime(activity.created_at)}
              </span>
            </span>
          </li>
        ))}
        <li className="flex gap-3 py-2.5">
          <span aria-hidden="true" className="mt-2 size-2.5 flex-none rounded-full bg-primary" />
          <span className="flex flex-col">
            <span className="font-semibold">{text.history.received}</span>
            <span className="text-sm text-muted-foreground">{formatDateTime(lead.created_at)}</span>
          </span>
        </li>
      </ol>
    </Card>
  );
}

function NoteForm({
  pending,
  onSave,
}: {
  pending: boolean;
  onSave: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");

  return (
    <Card title={text.note.title} id="t-nota">
      <form
        aria-labelledby="t-nota"
        className="flex flex-col gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(note.trim()).then(() => setNote(""));
        }}
      >
        <label htmlFor="nota" className="text-sm text-muted-foreground">
          {text.note.hint}
        </label>
        <Textarea
          id="nota"
          rows={4}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby="nota-contador"
        />
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span id="nota-contador" aria-live="polite" className="text-sm text-muted-foreground">
            {text.note.counter(note.length)}
          </span>
          <Button
            type="submit"
            variant="outline"
            className="font-bold"
            disabled={pending || note.trim() === ""}
          >
            {pending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
            {pending ? text.note.saving : text.note.save}
          </Button>
        </span>
      </form>
    </Card>
  );
}

function Handling({
  lead,
  currentUser,
  pending,
  onPatch,
}: {
  lead: LeadDetailData;
  currentUser: { id: number; name: string };
  pending: boolean;
  onPatch: (patch: LeadPatch) => Promise<void>;
}) {
  const assignees = useQuery(assigneesQuery(lead.type));
  // Em NOVO o responsável escolhido vale quando o atendimento começa; em atendimento, a troca é imediata
  const [chosen, setChosen] = useState<string>("");
  const current = lead.assigned_to;
  const value = lead.status === "NOVO" ? chosen : current ? String(current.id) : "";

  const options = new Map<number, string>();
  options.set(currentUser.id, text.handling.me(currentUser.name));
  for (const person of assignees.data ?? []) {
    if (!options.has(person.id)) options.set(person.id, person.name);
  }
  if (current && !options.has(current.id)) {
    options.set(
      current.id,
      current.is_active ? current.name : text.handling.inactive(current.name),
    );
  }

  return (
    <Card title={text.handling.title} id="t-status">
      <p className="m-0 text-foreground/90">
        {text.handling.current}{" "}
        <strong>
          <StatusBadge tone={STATUS_TONE[lead.status]}>
            {inboxMessages.statuses[lead.status]}
          </StatusBadge>
        </strong>
      </p>

      {lead.status === "NOVO" ? (
        <Button
          type="button"
          size="lg"
          className="font-bold"
          disabled={pending}
          onClick={() =>
            void onPatch({
              status: "EM_ATENDIMENTO",
              ...(chosen ? { assigned_to: Number(chosen) } : {}),
            })
          }
        >
          {text.handling.start}
        </Button>
      ) : null}
      {lead.status === "EM_ATENDIMENTO" ? (
        <>
          <Button
            type="button"
            size="lg"
            className="font-bold"
            disabled={pending}
            onClick={() => void onPatch({ status: "CONCLUIDO" })}
          >
            {text.handling.finish}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="font-bold"
            disabled={pending}
            onClick={() => void onPatch({ status: "NOVO" })}
          >
            {text.handling.giveBack}
          </Button>
        </>
      ) : null}
      {lead.status === "CONCLUIDO" ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="font-bold"
          disabled={pending}
          onClick={() => void onPatch({ status: "EM_ATENDIMENTO" })}
        >
          {text.handling.reopen}
        </Button>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <label htmlFor="responsavel" className="font-bold">
          {text.handling.assignee}
        </label>
        <NativeSelect
          id="responsavel"
          className="w-full"
          value={value}
          disabled={pending || lead.status === "CONCLUIDO"}
          onChange={(event) => {
            const next = event.target.value;
            if (lead.status === "NOVO") setChosen(next);
            else if (next !== "") void onPatch({ assigned_to: Number(next) });
          }}
        >
          {lead.status === "NOVO" ? (
            <NativeSelectOption value="">{text.handling.unassigned}</NativeSelectOption>
          ) : null}
          {[...options].map(([id, label]) => (
            <NativeSelectOption key={id} value={String(id)}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-sm text-muted-foreground">{text.handling.assigneeHint}</span>
        {current && !current.is_active ? (
          <span role="alert" className="text-sm font-semibold text-warning-foreground">
            {text.handling.inactiveWarning}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function ErasePanel({ name, onErase }: { name: string; onErase: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <>
      <Card title={text.erase.title} id="t-titular" className="border-destructive/30">
        <p className="m-0 text-[15px] text-foreground/90">{text.erase.text}</p>
        <Button
          type="button"
          variant="outline"
          className="self-start border-destructive font-bold text-destructive"
          onClick={() => {
            setAcknowledged(false);
            setOpen(true);
          }}
        >
          {text.erase.button}
        </Button>
      </Card>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={text.erase.dialogTitle(name)}
        confirmLabel={text.erase.confirm}
        destructive
        confirmDisabled={!acknowledged}
        description={
          <span className="flex flex-col gap-3">
            <span>{text.erase.dialogText}</span>
            <span className="flex items-start gap-2.5 text-foreground">
              <Checkbox
                id="ciente"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked)}
              />
              <label htmlFor="ciente">{text.erase.ack}</label>
            </span>
          </span>
        }
        onConfirm={onErase}
      />
    </>
  );
}

/**
 * O contato aberto (design: AdminContato; CAP-10 e CAP-11): o que a pessoa enviou, o botão "Responder no WhatsApp",
 * a anotação interna, o histórico e o atendimento (status, responsável). `canManage` esconde o que só quem atende pode
 * fazer; a API recusa de qualquer jeito (BR-076). Não guarda rascunho local: o texto é dado pessoal (FR-077).
 */
export function LeadDetail({
  id,
  inbox,
  canManage,
  currentUser,
}: {
  id: number;
  inbox: Inbox;
  canManage: boolean;
  currentUser: { id: number; name: string };
}) {
  const queryClient = useQueryClient();
  const query = useQuery(leadQuery(id));
  const [erased, setErased] = useState(false);
  const section = inbox === "oracao" ? inboxMessages.prayer : inboxMessages.general;
  const listPath = inbox === "oracao" ? "/admin/oracao" : "/admin/contatos";

  const patch = useMutation({
    mutationFn: (changes: LeadPatch) => patchLead(id, changes),
    onSuccess: (lead) => {
      queryClient.setQueryData(leadQuery(id).queryKey, lead);
      void queryClient.invalidateQueries({ queryKey: ["admin", "leads", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "leads", "stalled"] });
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : messages.errors.generic, {
        duration: Infinity,
      });
    },
  });

  async function apply(changes: LeadPatch, success: string): Promise<void> {
    await patch.mutateAsync(changes);
    toast.success(success);
  }

  async function erase(): Promise<void> {
    try {
      await eraseLead(id);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : messages.errors.generic, {
        duration: Infinity,
      });
      throw error;
    }
    queryClient.removeQueries({ queryKey: leadQuery(id).queryKey });
    void queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
    setErased(true);
  }

  const back = (
    <Link
      to={listPath}
      className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold"
    >
      <ChevronLeftIcon aria-hidden="true" className="size-[18px]" />
      {section.back}
    </Link>
  );

  if (erased) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <title>{text.erase.doneTitle} — Painel PIBLS</title>
        {back}
        <div
          role="status"
          className="flex max-w-xl flex-col gap-2.5 rounded-[14px] border border-border bg-card p-6"
        >
          <h1 className="m-0 text-2xl font-extrabold">{text.erase.doneTitle}</h1>
          <p className="m-0 text-foreground/90">{text.erase.doneText}</p>
          <Link to={listPath} className="inline-flex min-h-11 items-center self-start font-bold">
            {inbox === "oracao" ? text.erase.backPrayer : text.erase.back}
          </Link>
        </div>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {back}
        <LoadingBlock count={4} />
      </div>
    );
  }

  if (query.isError) {
    const notFound = isApiError(query.error) && query.error.status === 404;

    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {back}
        <ErrorState
          title={notFound ? text.notFound : text.loadError}
          message={isApiError(query.error) ? query.error.message : messages.errors.generic}
          onRetry={notFound ? undefined : () => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  const lead = query.data;
  const name = lead.name ?? inboxMessages.list.anonymous;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${section.detailTitle(name)} — Painel PIBLS`}</title>
      {back}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">{name}</h1>
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral">{inboxMessages.types[lead.type]}</StatusBadge>
            <StatusBadge tone={STATUS_TONE[lead.status]}>
              {inboxMessages.statuses[lead.status]}
            </StatusBadge>
            {lead.waiting_days != null ? (
              <span className="text-sm font-bold text-warning-foreground">
                {text.waiting(lead.waiting_days)}
              </span>
            ) : null}
          </span>
        </div>
        {lead.whatsapp_url ? (
          <a
            href={lead.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName({
              variant: "whatsapp",
              size: "lg",
              className: "gap-2 px-4 font-bold",
            })}
          >
            <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
            {text.whatsapp}
            <span className="sr-only"> {messages.forms.opensInNewTab}</span>
          </a>
        ) : null}
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[3_1_26rem] flex-col gap-5">
          <Card title={text.sent} id="t-dados">
            <dl className="m-0 flex flex-wrap gap-x-6 gap-y-3.5">
              {leadFields(lead).map((field) => (
                <div key={field.label} className="flex flex-[1_1_12rem] flex-col">
                  <dt className="text-sm text-muted-foreground">{field.label}</dt>
                  <dd className="m-0 font-semibold break-words">{field.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">{text.message}</span>
              <p className="m-0 break-words whitespace-pre-line">
                {lead.message ?? text.noMessage}
              </p>
            </div>
            <p className="m-0 text-[13px] text-muted-foreground">
              {text.received(formatDateTime(lead.created_at))} ·{" "}
              {text.consent(lead.consent_version)}
            </p>
          </Card>

          {canManage ? (
            <NoteForm
              pending={patch.isPending}
              onSave={(note) => apply({ note }, text.note.saved)}
            />
          ) : null}

          <History lead={lead} />
        </div>

        <aside className="flex min-w-0 flex-[2_1_17rem] flex-col gap-5">
          {canManage ? (
            <>
              <Handling
                key={`${lead.status}-${lead.assigned_to?.id ?? "none"}`}
                lead={lead}
                currentUser={currentUser}
                pending={patch.isPending}
                // A falha já virou aviso (onError); os botões disparam sem esperar, então a rejeição não pode sobrar solta
                onPatch={(changes) =>
                  apply(changes, text.handling.statusUpdated).catch(() => undefined)
                }
              />
              <ErasePanel name={name} onErase={erase} />
            </>
          ) : (
            <Card title={text.handling.title} id="t-status">
              <p className="m-0 text-foreground/90">{text.handling.readOnly}</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
