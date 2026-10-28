import { HistoryIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { buttonClassName } from "~/shared/ui/button-variants";
import { eventAdminMessages } from "../../admin-messages";

const { draft: draftText, list: listText } = eventAdminMessages;

/** Um bloco do formulário (design: cartão branco com título). */
export function FormSection({
  title,
  id,
  className,
  children,
}: {
  title?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={`flex flex-col gap-4 rounded-[14px] border border-border bg-card p-5${className ? ` ${className}` : ""}`}
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
