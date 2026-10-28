const MAX_LENGTH = 160;

/**
 * O endereço de um conteúdo (mensagem, evento) a partir do título: minúsculas, sem acento, só letras, números e hífens
 * (`^[a-z0-9]+(-[a-z0-9]+)*$`, BR-032). Título só com símbolos dá vazio, e a tela pede um título melhor.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
