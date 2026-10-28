import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as z from "zod";
import { ruleMessages } from "~/shared/rule-messages";
import { Button } from "~/shared/ui/button";
import { Input } from "~/shared/ui/input";
import {
  LEAD_TYPES,
  MAX_RECIPIENTS,
  settingsMessages as settings,
  type LeadTypeCode,
} from "../../settings-messages";

const text = settings.recipients;
const emailSchema = z.email().max(254);

export type Recipients = Record<LeadTypeCode, string[]>;

/**
 * Quem recebe o aviso de cada tipo de contato (design: AdminConfiguracoes, "Quem recebe o aviso de cada contato"). Um tipo
 * sem destinatário fica em destaque: os contatos dele chegam ao painel, mas ninguém recebe e-mail (BR-011). Os e-mails
 * nunca aparecem no site (BR-050); o servidor confere até 10 por tipo (BR-051).
 */
export function RecipientsEditor({
  value,
  errors,
  onChange,
}: {
  value: Recipients;
  /** Um erro por tipo, vindo da validação do formulário ou do servidor. */
  errors: Partial<Record<LeadTypeCode, string>>;
  onChange: (type: LeadTypeCode, next: string[]) => void;
}) {
  const [adding, setAdding] = useState<LeadTypeCode | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const addButtons = useRef<Partial<Record<LeadTypeCode, HTMLButtonElement | null>>>({});
  const draftInput = useRef<HTMLInputElement>(null);

  // O campo aparece depois do clique: o foco vai para ele
  useEffect(() => {
    if (adding !== null) draftInput.current?.focus();
  }, [adding]);

  function close(type: LeadTypeCode) {
    setAdding(null);
    setDraft("");
    setDraftError(null);
    // O foco volta ao botão que abriu o campo
    queueMicrotask(() => addButtons.current[type]?.focus());
  }

  function include(type: LeadTypeCode) {
    const address = draft.trim().toLowerCase();
    const current = value[type];

    if (!emailSchema.safeParse(address).success) {
      setDraftError(ruleMessages.recipients);
      return;
    }
    if (current.includes(address)) {
      setDraftError(text.duplicate);
      return;
    }
    if (current.length >= MAX_RECIPIENTS) {
      setDraftError(text.limit);
      return;
    }

    onChange(type, [...current, address]);
    close(type);
  }

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {LEAD_TYPES.map((type) => {
        const label = text.types[type];
        const emails = value[type];
        const empty = emails.length === 0;
        const open = adding === type;
        const error = open ? draftError : (errors[type] ?? null);

        return (
          <li
            key={type}
            className={`-mx-5 flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border px-5 py-3 last:border-b-0 ${
              empty ? "bg-destructive/10" : ""
            }`}
          >
            <span className="min-h-11 w-full pt-2.5 font-bold sm:w-44 sm:flex-none">{label}</span>

            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:basis-64">
              <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
                {emails.map((email) => (
                  <li
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-muted py-0.5 pr-0.5 pl-2.5 text-sm"
                  >
                    {email}
                    <button
                      type="button"
                      aria-label={text.remove(email, label)}
                      onClick={() =>
                        onChange(
                          type,
                          emails.filter((item) => item !== email),
                        )
                      }
                      className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none after:absolute after:-inset-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <XIcon aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                ))}
                {empty ? (
                  <li className="min-h-11 content-center text-sm font-bold text-destructive">
                    {text.none}
                  </li>
                ) : null}
              </ul>

              {open ? (
                <div className="flex flex-wrap items-start gap-2">
                  <Input
                    type="email"
                    name={`new-recipient-${type.toLowerCase()}`}
                    ref={draftInput}
                    autoComplete="off"
                    value={draft}
                    aria-label={text.addLabel(label)}
                    aria-invalid={draftError ? true : undefined}
                    aria-describedby={`recipients-${type}-error`}
                    className="min-w-0 flex-1 basis-56"
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setDraftError(null);
                    }}
                    onKeyDown={(event) => {
                      // Enter inclui o e-mail; não pode enviar o formulário de configurações inteiro
                      if (event.key === "Enter") {
                        event.preventDefault();
                        include(type);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        close(type);
                      }
                    }}
                    spellCheck={false}
                  />
                  <Button type="button" onClick={() => include(type)}>
                    {text.addConfirm}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => close(type)}>
                    {text.cancel}
                  </Button>
                </div>
              ) : null}

              <p
                id={`recipients-${type}-error`}
                role={error ? "alert" : undefined}
                className="m-0 text-sm font-semibold text-destructive empty:hidden"
              >
                {error}
              </p>
            </div>

            {open ? null : (
              <Button
                type="button"
                variant="outline"
                disabled={emails.length >= MAX_RECIPIENTS}
                aria-label={text.addFor(label)}
                ref={(node) => {
                  addButtons.current[type] = node;
                }}
                onClick={() => {
                  setAdding(type);
                  setDraft("");
                  setDraftError(null);
                }}
              >
                <PlusIcon aria-hidden="true" data-icon="inline-start" />
                {text.add}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
