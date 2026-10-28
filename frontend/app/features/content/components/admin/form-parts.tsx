import { HistoryIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatDateTime } from "~/shared/format";
import { buttonClassName } from "~/shared/ui/button-variants";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { contentAdminMessages } from "../../admin-messages";

const { draft: draftText, schedule: scheduleText, list: listText } = contentAdminMessages;

/** Um bloco do formulário (design: cartão branco com título). */
export function FormSection({
  title,
  id,
  children,
}: {
  title?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-5"
    >
      {title ? (
        <h2 id={id} className="m-0 text-lg font-extrabold">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** "Encontramos um rascunho não salvo neste navegador. Deseja restaurar?" (FR-077). */
export function DraftBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <Alert
      variant="info"
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl"
    >
      <span className="flex items-center gap-2.5">
        <HistoryIcon aria-hidden="true" className="size-5 flex-none" />
        {draftText.found}
      </span>
      <span className="flex gap-2">
        <Button type="button" onClick={onRestore}>
          {draftText.restore}
        </Button>
        <Button type="button" variant="outline" onClick={onDiscard}>
          {draftText.discard}
        </Button>
      </span>
    </Alert>
  );
}

/** Quando publicar: agora ou agendado (BR-042). Horário de Brasília. */
export function PublishWhen({
  name,
  when,
  scheduledAt,
  onWhenChange,
  onScheduledAtChange,
  error,
  disabled = false,
}: {
  name: string;
  when: "now" | "schedule";
  scheduledAt: string;
  onWhenChange: (when: "now" | "schedule") => void;
  onScheduledAtChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const option =
    "flex min-h-12 items-center gap-2.5 rounded-[10px] border border-border-strong px-3.5";

  return (
    <>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-lg font-extrabold">{scheduleText.legend}</legend>
        <label className={option}>
          <input
            type="radio"
            name={name}
            className="size-5"
            checked={when === "now"}
            disabled={disabled}
            onChange={() => onWhenChange("now")}
          />
          {scheduleText.now}
        </label>
        <label className={option}>
          <input
            type="radio"
            name={name}
            className="size-5"
            checked={when === "schedule"}
            disabled={disabled}
            onChange={() => onWhenChange("schedule")}
          />
          {scheduleText.later}
        </label>
      </fieldset>
      {when === "schedule" ? (
        <FormField
          id={`${name}-data`}
          label={scheduleText.dateTime}
          hint={scheduleText.zone}
          error={error}
        >
          {(control) => (
            <Input
              {...control}
              type="datetime-local"
              className="max-w-72"
              value={scheduledAt}
              disabled={disabled}
              onChange={(event) => onScheduledAtChange(event.target.value)}
            />
          )}
        </FormField>
      ) : null}
    </>
  );
}

/** A tela de sucesso depois de publicar ou agendar. */
export function SavedNotice({
  title,
  children,
  links,
}: {
  title: string;
  children?: ReactNode;
  links: readonly { to: string; label: string; external?: boolean }[];
}) {
  return (
    <div
      role="status"
      className="flex max-w-xl flex-col gap-2.5 rounded-[14px] border border-success-foreground/30 bg-success p-6 text-success-foreground"
    >
      <h2 className="m-0 text-[22px] font-extrabold text-success-foreground">{title}</h2>
      {children ? <p className="m-0">{children}</p> : null}
      <span className="flex flex-wrap gap-x-4">
        {links.map((link) =>
          link.external ? (
            <a
              key={link.to}
              href={link.to}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center font-bold text-success-foreground"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex min-h-11 items-center font-bold text-success-foreground"
            >
              {link.label}
            </Link>
          ),
        )}
      </span>
    </div>
  );
}

/** "Mostrando 1–8 de 42" mais os números de página, como links (a página mora na URL). */
export function PageLinks({
  page,
  lastPage,
  total,
  perPage,
  hrefFor,
}: {
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  hrefFor: (page: number) => string;
}) {
  if (lastPage <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const first = Math.max(1, Math.min(page - 2, lastPage - 4));
  const pages = Array.from({ length: Math.min(5, lastPage) }, (_, index) => first + index);
  const pageClass = (active: boolean) =>
    buttonClassName({
      variant: active ? "default" : "outline",
      className: "min-w-11 justify-center px-3 font-semibold",
    });
  const disabledClass = `${pageClass(false)} pointer-events-none opacity-50`;

  return (
    <nav
      aria-label={listText.pagesLabel}
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
    >
      <span className="text-sm text-muted-foreground">{listText.showing(from, to, total)}</span>
      <span className="flex flex-wrap gap-1.5">
        {page > 1 ? (
          <Link to={hrefFor(page - 1)} className={pageClass(false)} rel="prev">
            {listText.previous}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {listText.previous}
          </span>
        )}
        {pages.map((number) => (
          <Link
            key={number}
            to={hrefFor(number)}
            aria-current={number === page ? "page" : undefined}
            aria-label={listText.page(number)}
            className={pageClass(number === page)}
          >
            {number}
          </Link>
        ))}
        {page < lastPage ? (
          <Link to={hrefFor(page + 1)} className={pageClass(false)} rel="next">
            {listText.next}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {listText.next}
          </span>
        )}
      </span>
    </nav>
  );
}

/** `Sáb, 17/10 às 21h10` a partir de um instante ISO (hora de Brasília). */
export function whenLabel(iso: string): string {
  return formatDateTime(iso);
}
