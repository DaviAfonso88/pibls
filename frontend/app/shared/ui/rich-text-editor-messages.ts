/**
 * Textos do editor de texto formatado. Ficam ao lado dele, e não em `~/shared/messages`, porque só o editor (carregado
 * sob demanda, só nas telas de edição) os usa: no `messages` entrariam no JS de toda página pública (RNF-05).
 */
export const editorMessages = {
  toolbar: "Formatação",
  bold: "Negrito",
  italic: "Itálico",
  heading: "Título",
  subheading: "Subtítulo",
  bulletList: "Lista com marcadores",
  orderedList: "Lista numerada",
  quote: "Citação",
  link: "Link",
  removeLink: "Remover link",
  linkLabel: "Endereço do link",
  linkApply: "Aplicar",
  linkInvalid: "Use um endereço que comece com http://, https:// ou mailto:.",
  pasteHint:
    "Ao colar de outro lugar (Word, WhatsApp), cores, fontes e imagens são removidas. Fica só o texto com a formatação da barra.",
} as const;
