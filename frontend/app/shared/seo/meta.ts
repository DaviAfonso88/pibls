import { institution } from "~/content/institution";
import { pageTitle } from "./title";

/** Imagem de pré-visualização padrão (1200 × 630), em `public/og-default.png`. */
export const DEFAULT_OG_IMAGE = "/og-default.png";

export interface PageMetaInput {
  /** Nome da página (`Quem somos`); sem ele, vale o nome completo da igreja. */
  title?: string;
  description: string;
  /** Caminho da página, ex.: `/quem-somos`. */
  path: string;
  /** Caminho ou URL da imagem de pré-visualização; padrão: a imagem da igreja. */
  image?: string;
  /** Páginas fora do índice de busca (404, painel). */
  noindex?: boolean;
}

type MetaDescriptor =
  { title: string } | { name: string; content: string } | { property: string; content: string };

/** URL absoluta no domínio do site: o Open Graph não aceita caminho relativo. */
export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, institution.siteUrl).toString();
}

/**
 * `<title>`, `description` e Open Graph de uma página pública (FR-008): título, descrição e imagem próprios, para a
 * pré-visualização no WhatsApp e no buscador. Para a função `meta` de cada rota; vai no HTML pré-renderizado.
 */
export function pageMeta({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  noindex = false,
}: PageMetaInput): MetaDescriptor[] {
  const fullTitle = pageTitle(title);

  return [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: institution.name },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: absoluteUrl(path) },
    { property: "og:image", content: absoluteUrl(image) },
    { name: "twitter:card", content: "summary_large_image" },
    ...(noindex ? [{ name: "robots", content: "noindex" }] : []),
  ];
}
