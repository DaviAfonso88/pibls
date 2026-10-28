import { ArrowDownIcon, ArrowUpIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { messages } from "~/shared/messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { ConfirmDialog } from "~/shared/ui/confirm-dialog";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { Textarea } from "~/shared/ui/textarea";
import {
  FORM_FIELD_TYPES,
  MAX_FORM_FIELDS,
  type ApiFormField,
  type FormFieldType,
} from "../../admin-api";
import { eventAdminMessages } from "../../admin-messages";
import {
  emptyField,
  hasOptions,
  hasSensitiveField,
  moveItem,
  type FieldDraft,
} from "../../event-model";

const { builder: text } = eventAdminMessages;

/** Os erros de uma pergunta, por campo (o que o formulário recebeu do esquema ou do servidor). */
export type FieldErrors = Partial<
  Record<"label" | "help_text" | "options" | "min" | "max", string>
>;

interface PendingChange {
  kind: "remove" | "type";
  uid: string;
  type?: FormFieldType;
}

interface Focus {
  uid: string;
  target: "label" | "up" | "down";
}

/**
 * O construtor do formulário de inscrição (design: AdminEvento; BR-031): perguntas com tipo, obrigatoriedade, dica,
 * opções e o marcador de dado de saúde (ADR-020). A ordem muda por botões (subir e descer), que funcionam no teclado e no
 * leitor de tela; não há arrastar.
 *
 * Com inscrições já feitas, remover uma pergunta que já existe ou trocar o tipo dela pede confirmação (BR-029). Quem
 * confirma avisa o formulário em `onBreakingChange`, que então envia `confirm_schema_change`.
 */
export function FormBuilder({
  fields,
  onChange,
  savedFields,
  registrations,
  onBreakingChange,
  errors = [],
  disabled = false,
}: {
  fields: readonly FieldDraft[];
  onChange: (fields: FieldDraft[]) => void;
  /** O formulário como está salvo no servidor (vazio no evento novo). */
  savedFields: readonly ApiFormField[];
  /** Quantas inscrições o evento já tem. */
  registrations: number;
  onBreakingChange: () => void;
  errors?: ReadonlyArray<FieldErrors | undefined>;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const container = useRef<HTMLOListElement>(null);

  const savedTypes = new Map(savedFields.map((field) => [field.key, field.type]));
  const atLimit = fields.length >= MAX_FORM_FIELDS;
  const pendingField = pending ? fields.find((field) => field.uid === pending.uid) : undefined;

  // Depois de acrescentar ou mover, o foco acompanha: o elemento é o mesmo, mas a lista foi reordenada
  useEffect(() => {
    if (focus === null) return;

    const find = (target: Focus["target"]) =>
      container.current?.querySelector<HTMLElement>(`[data-focus="${focus.uid}:${target}"]`);

    let element = find(focus.target);
    // Na ponta da lista o botão escolhido fica desabilitado: o foco vai para o outro, que ainda move a pergunta
    if (element instanceof HTMLButtonElement && element.disabled) {
      element = find(focus.target === "up" ? "down" : "up");
    }
    element?.focus();
    setFocus(null);
  }, [focus, fields]);

  function update(uid: string, patch: Partial<FieldDraft>) {
    onChange(fields.map((field) => (field.uid === uid ? { ...field, ...patch } : field)));
  }

  function add() {
    if (atLimit) return;

    const created = emptyField();
    onChange([...fields, created]);
    setFocus({ uid: created.uid, target: "label" });
  }

  function move(index: number, to: number) {
    const field = fields[index];
    if (field === undefined || to < 0 || to >= fields.length) return;

    onChange(moveItem(fields, index, to));
    setFocus({ uid: field.uid, target: to < index ? "up" : "down" });
    setAnnouncement(text.position(to + 1, fields.length));
  }

  function remove(uid: string) {
    const field = fields.find((candidate) => candidate.uid === uid);
    onChange(fields.filter((candidate) => candidate.uid !== uid));
    setAnnouncement(text.removed(field?.label ?? ""));
  }

  function requestRemove(field: FieldDraft) {
    if (registrations > 0 && savedTypes.has(field.key)) {
      setPending({ kind: "remove", uid: field.uid });
      return;
    }
    remove(field.uid);
  }

  function requestType(field: FieldDraft, type: FormFieldType) {
    const saved = savedTypes.get(field.key);
    // Trocar o tipo de uma pergunta que já tem respostas pede confirmação; voltar ao tipo salvo, não
    if (registrations > 0 && saved !== undefined && type !== saved) {
      setPending({ kind: "type", uid: field.uid, type });
      return;
    }
    update(field.uid, { type });
  }

  function confirmPending() {
    if (pending === null) return;

    if (pending.kind === "remove") {
      remove(pending.uid);
    } else if (pending.type !== undefined) {
      update(pending.uid, { type: pending.type });
    }
    onBreakingChange();
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={text.fixedLabel} className="m-0 flex list-none flex-col gap-2 p-0">
        {text.fixed.map((item) => (
          <li
            key={item.name}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] border border-border bg-muted/50 px-3.5 py-3"
          >
            <LockIcon aria-hidden="true" className="size-4 flex-none text-muted-foreground" />
            <span className="flex-[1_1_12rem] font-bold">{item.name}</span>
            <span className="text-sm text-muted-foreground">{item.rule}</span>
          </li>
        ))}
      </ul>

      {fields.length === 0 ? (
        <p className="m-0 text-muted-foreground">{text.empty}</p>
      ) : (
        <ol
          ref={container}
          aria-label={text.questionsLabel}
          className="m-0 flex list-none flex-col gap-3 p-0"
        >
          {fields.map((field, index) => {
            const fieldErrors = errors[index] ?? {};
            const id = field.uid;

            return (
              <li key={field.uid}>
                <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-[10px] border border-border-strong p-3.5">
                  <legend className="sr-only">{text.position(index + 1, fields.length)}</legend>

                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-[2_1_14rem]">
                      <FormField id={`${id}-label`} label={text.question} error={fieldErrors.label}>
                        {(control) => (
                          <Input
                            {...control}
                            type="text"
                            name={`${id}-label`}
                            autoComplete="off"
                            maxLength={150}
                            value={field.label}
                            disabled={disabled}
                            data-focus={`${field.uid}:label`}
                            onChange={(event) => update(field.uid, { label: event.target.value })}
                          />
                        )}
                      </FormField>
                    </div>
                    <div className="flex-[1_1_11rem]">
                      <FormField id={`${id}-type`} label={text.type}>
                        {(control) => (
                          <NativeSelect
                            {...control}
                            className="w-full"
                            value={field.type}
                            disabled={disabled}
                            onChange={(event) =>
                              requestType(field, event.target.value as FormFieldType)
                            }
                          >
                            {FORM_FIELD_TYPES.map((type) => (
                              <NativeSelectOption key={type} value={type}>
                                {text.types[type]}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        )}
                      </FormField>
                    </div>
                  </div>

                  {hasOptions(field.type) ? (
                    <FormField
                      id={`${id}-options`}
                      label={text.options}
                      hint={text.optionsHint}
                      error={fieldErrors.options}
                    >
                      {(control) => (
                        <Textarea
                          {...control}
                          name={`${id}-options`}
                          autoComplete="off"
                          rows={3}
                          value={field.options}
                          disabled={disabled}
                          onChange={(event) => update(field.uid, { options: event.target.value })}
                        />
                      )}
                    </FormField>
                  ) : null}

                  {field.type === "NUMBER" ? (
                    <div className="flex flex-wrap gap-3">
                      <div className="flex-[1_1_9rem]">
                        <FormField
                          id={`${id}-min`}
                          label={text.min}
                          optionalLabel={messages.common.optional}
                          error={fieldErrors.min}
                        >
                          {(control) => (
                            <Input
                              {...control}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={field.min}
                              disabled={disabled}
                              onChange={(event) => update(field.uid, { min: event.target.value })}
                            />
                          )}
                        </FormField>
                      </div>
                      <div className="flex-[1_1_9rem]">
                        <FormField
                          id={`${id}-max`}
                          label={text.max}
                          optionalLabel={messages.common.optional}
                          error={fieldErrors.max}
                        >
                          {(control) => (
                            <Input
                              {...control}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={field.max}
                              disabled={disabled}
                              onChange={(event) => update(field.uid, { max: event.target.value })}
                            />
                          )}
                        </FormField>
                      </div>
                    </div>
                  ) : null}

                  <FormField
                    id={`${id}-help`}
                    label={text.help}
                    optionalLabel={messages.common.optional}
                    hint={text.helpOptional}
                    error={fieldErrors.help_text}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="text"
                        name={`${id}-help`}
                        autoComplete="off"
                        maxLength={300}
                        value={field.help_text}
                        disabled={disabled}
                        onChange={(event) => update(field.uid, { help_text: event.target.value })}
                      />
                    )}
                  </FormField>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-x-5 gap-y-1">
                      <label className="flex min-h-11 items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={field.required}
                          disabled={disabled}
                          onChange={(event) =>
                            update(field.uid, { required: event.target.checked })
                          }
                        />
                        {text.required}
                      </label>
                      <label className="flex min-h-11 items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={field.sensitive}
                          disabled={disabled}
                          aria-describedby={`${id}-sensitive-hint`}
                          onChange={(event) =>
                            update(field.uid, { sensitive: event.target.checked })
                          }
                        />
                        {text.sensitive}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="size-11 p-0"
                        aria-label={text.moveUp(field.label)}
                        disabled={disabled || index === 0}
                        data-focus={`${field.uid}:up`}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUpIcon aria-hidden="true" className="size-[18px]" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="size-11 p-0"
                        aria-label={text.moveDown(field.label)}
                        disabled={disabled || index === fields.length - 1}
                        data-focus={`${field.uid}:down`}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDownIcon aria-hidden="true" className="size-[18px]" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="size-11 p-0 text-destructive"
                        aria-label={text.remove(field.label)}
                        disabled={disabled}
                        onClick={() => requestRemove(field)}
                      >
                        <Trash2Icon aria-hidden="true" className="size-[18px]" />
                      </Button>
                    </div>
                  </div>
                  <p id={`${id}-sensitive-hint`} className="m-0 text-sm text-muted-foreground">
                    {text.sensitiveHint}
                  </p>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}

      {hasSensitiveField(fields) ? (
        <Alert variant="info" role="note">
          {text.sensitiveNotice}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="gap-2 border-dashed font-bold"
          disabled={disabled || atLimit}
          onClick={add}
        >
          <PlusIcon aria-hidden="true" className="size-[18px]" />
          {text.add}
        </Button>
        <span className="text-sm text-muted-foreground">
          {atLimit ? text.limit(MAX_FORM_FIELDS) : text.count(fields.length, MAX_FORM_FIELDS)}
        </span>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending?.kind === "type"
            ? text.breakingTitleType(pendingField?.label ?? "")
            : text.breakingTitleRemove(pendingField?.label ?? "")
        }
        description={text.breakingBody}
        confirmLabel={pending?.kind === "type" ? text.breakingType : text.breakingRemove}
        destructive
        onConfirm={confirmPending}
      />
    </div>
  );
}
