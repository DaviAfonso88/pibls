import { institution } from "~/content/institution";

/** Título da aba e do resultado de busca: `Quem somos — PIBLS`. Sem argumento, o nome completo da igreja. */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${institution.shortName}` : institution.name;
}
