/** Uma mudança de `display_order` a enviar ao servidor. */
export interface OrderUpdate {
  id: number;
  display_order: number;
}

interface Ordered {
  id: number;
  display_order: number;
}

/**
 * Sobe (-1) ou desce (+1) um item da lista que está na tela (uma categoria, na ordem de exibição) e devolve só os
 * `display_order` que precisam mudar.
 *
 * O normal é trocar os valores dos dois vizinhos. Se os dois têm o mesmo valor (conteúdo importado sem ordem), trocar
 * nada resolveria: a lista toda é renumerada de 0 em diante, e vão só os itens cujo número muda.
 */
export function moveUpdates(
  items: readonly Ordered[],
  index: number,
  direction: -1 | 1,
): OrderUpdate[] {
  const target = index + direction;
  const current = items[index];
  const neighbour = items[target];
  if (current === undefined || neighbour === undefined) return [];

  if (current.display_order !== neighbour.display_order) {
    return [
      { id: current.id, display_order: neighbour.display_order },
      { id: neighbour.id, display_order: current.display_order },
    ];
  }

  const reordered = [...items];
  reordered[index] = neighbour;
  reordered[target] = current;

  return reordered
    .map((item, position) => ({ id: item.id, display_order: position }))
    .filter(
      (update) =>
        items.find((item) => item.id === update.id)?.display_order !== update.display_order,
    );
}
