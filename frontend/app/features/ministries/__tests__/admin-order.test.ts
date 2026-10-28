import { describe, expect, it } from "vitest";
import { moveUpdates } from "../admin-order";

describe("moveUpdates", () => {
  const list = [
    { id: 10, display_order: 1 },
    { id: 20, display_order: 5 },
    { id: 30, display_order: 9 },
  ];

  it("troca os valores de ordem dos dois vizinhos", () => {
    expect(moveUpdates(list, 1, -1)).toEqual([
      { id: 20, display_order: 1 },
      { id: 10, display_order: 5 },
    ]);
    expect(moveUpdates(list, 1, 1)).toEqual([
      { id: 20, display_order: 9 },
      { id: 30, display_order: 5 },
    ]);
  });

  it("não faz nada nas pontas da lista", () => {
    expect(moveUpdates(list, 0, -1)).toEqual([]);
    expect(moveUpdates(list, 2, 1)).toEqual([]);
    expect(moveUpdates([], 0, 1)).toEqual([]);
  });

  it("com ordens repetidas, renumera a lista e manda só o que muda", () => {
    const tied = [
      { id: 1, display_order: 0 },
      { id: 2, display_order: 0 },
      { id: 3, display_order: 0 },
    ];

    // Descer o primeiro: ficam 2, 1, 3 → números 0, 1, 2; o item 2 já era 0 e o 3 já é... 2 (muda)
    expect(moveUpdates(tied, 0, 1)).toEqual([
      { id: 1, display_order: 1 },
      { id: 3, display_order: 2 },
    ]);
  });
});
