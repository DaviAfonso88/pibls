/**
 * Geometria que o jsdom não tem e o ProseMirror (o editor TipTap) pede ao clicar e ao rolar até o cursor. Importe só nos
 * testes que montam o editor: definir `Range.getClientRects` muda o que o axe-core considera visível e faz outros testes de
 * acessibilidade (os diálogos do Base UI) falharem sem motivo.
 */
const emptyRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
const rect = { ...emptyRect, toJSON: () => emptyRect } satisfies DOMRect;
const emptyList = Object.assign([] as DOMRect[], { item: () => null });

document.elementFromPoint ??= () => null;
Range.prototype.getClientRects ??= () => emptyList;
Range.prototype.getBoundingClientRect ??= () => rect;
Element.prototype.getClientRects ??= () => emptyList;
