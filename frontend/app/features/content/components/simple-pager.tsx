import { Link } from "react-router";
import { buttonClassName } from "~/shared/ui/button-variants";
import { publicContentMessages as text } from "../messages";

/**
 * Paginação das listas públicas (design: "Anterior · Página 1 de 4 · Próxima"). As páginas são links reais, com o número
 * na URL, para o botão Voltar e o compartilhamento funcionarem.
 */
export function SimplePager({
  page,
  lastPage,
  hrefFor,
}: {
  page: number;
  lastPage: number;
  hrefFor: (page: number) => string;
}) {
  if (lastPage <= 1) return null;

  const disabled = `${buttonClassName({ variant: "ghost", className: "px-3.5 font-semibold" })} pointer-events-none text-muted-foreground`;

  return (
    <nav aria-label={text.pagination} className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link
          to={hrefFor(page - 1)}
          rel="prev"
          className={buttonClassName({ variant: "ghost", className: "px-3.5 font-semibold" })}
        >
          {text.previous}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          {text.previous}
        </span>
      )}
      <span className="text-[15px] text-muted-foreground">{text.pageOf(page, lastPage)}</span>
      {page < lastPage ? (
        <Link
          to={hrefFor(page + 1)}
          rel="next"
          className={buttonClassName({ variant: "outline", className: "px-3.5 font-bold" })}
        >
          {text.next}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          {text.next}
        </span>
      )}
    </nav>
  );
}
