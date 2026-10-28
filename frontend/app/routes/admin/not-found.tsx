import { Link } from "react-router";
import { accessMessages } from "~/features/access/messages";
import { buttonClassName } from "~/shared/ui/button-variants";

/** Endereço do painel que não existe (ou área que ainda não foi entregue), dentro da moldura do painel. */
export default function AdminNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-12">
      <title>Página não encontrada — Painel PIBLS</title>
      <h1 className="m-0 text-2xl font-extrabold text-balance">{accessMessages.notFound.title}</h1>
      <p className="m-0 text-muted-foreground">{accessMessages.notFound.text}</p>
      <Link to="/admin" className={buttonClassName({ size: "lg", className: "px-5 font-bold" })}>
        {accessMessages.denied.back}
      </Link>
    </div>
  );
}
