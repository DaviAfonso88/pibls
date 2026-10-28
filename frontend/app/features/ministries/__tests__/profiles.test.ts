import { describe, expect, it } from "vitest";
import type { Ministry } from "../api";
import {
  cellNeighborhoods,
  filterGroups,
  groupsAndCells,
  isGroupProfile,
  profileLabel,
  profileOf,
} from "../profiles";

function item(overrides: Partial<Ministry> & Pick<Ministry, "id" | "category" | "name">): Ministry {
  return {
    description: null,
    leaders_text: null,
    schedule_text: null,
    neighborhood: null,
    contact_phone: null,
    ...overrides,
  };
}

const catalog: Ministry[] = [
  item({ id: 1, category: "MINISTERIO", name: "Comunicação" }),
  item({ id: 2, category: "GRUPO", name: "Homens (UMHBB)" }),
  item({ id: 3, category: "GRUPO", name: "Mulheres (MCM)" }),
  item({ id: 4, category: "GRUPO", name: "Jovens e Adolescentes (Salt)" }),
  item({ id: 5, category: "GRUPO", name: "Crianças (Mini PIB)" }),
  item({ id: 6, category: "GRUPO", name: "Grupo de Casais" }),
  item({ id: 7, category: "CELULA", name: "Célula de CL Promissão", neighborhood: "Promissão" }),
  item({ id: 8, category: "CELULA", name: "Célula de CL Centro", neighborhood: "Centro" }),
  item({ id: 9, category: "CELULA", name: "Célula de CL Centro 2", neighborhood: "Centro" }),
];

describe("profileOf (FR-006)", () => {
  it("toda célula é 'celulas'; os grupos são reconhecidos pelo nome", () => {
    expect(catalog.map((entry) => profileOf(entry))).toEqual([
      null,
      "homens",
      "mulheres",
      "jovens",
      "criancas",
      null,
      "celulas",
      "celulas",
      "celulas",
    ]);
  });

  it("reconhece o nome sem acento e em outra caixa", () => {
    expect(profileOf(item({ id: 1, category: "GRUPO", name: "CRIANCAS" }))).toBe("criancas");
    expect(profileOf(item({ id: 1, category: "GRUPO", name: "Grupo Salt" }))).toBe("jovens");
  });
});

describe("filtros da página de grupos", () => {
  it("só grupos e células entram na página", () => {
    expect(groupsAndCells(catalog).map((entry) => entry.id)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("lista os bairros das células, sem repetir e em ordem alfabética", () => {
    expect(cellNeighborhoods(catalog)).toEqual(["Centro", "Promissão"]);
  });

  it("filtra por perfil", () => {
    expect(filterGroups(groupsAndCells(catalog), "homens", null).map((entry) => entry.id)).toEqual([
      2,
    ]);
    expect(filterGroups(groupsAndCells(catalog), "celulas", null).map((entry) => entry.id)).toEqual(
      [7, 8, 9],
    );
  });

  it("sem perfil, mostra todos, inclusive o grupo sem perfil reconhecido", () => {
    expect(filterGroups(groupsAndCells(catalog), null, null)).toHaveLength(8);
  });

  it("o bairro só atua sobre as células: os grupos não somem", () => {
    const result = filterGroups(groupsAndCells(catalog), null, "Centro").map((entry) => entry.id);

    expect(result).toEqual([2, 3, 4, 5, 6, 8, 9]);
    expect(
      filterGroups(groupsAndCells(catalog), "celulas", "Promissão").map((entry) => entry.id),
    ).toEqual([7]);
  });

  it("valida o perfil que vem da URL", () => {
    expect(isGroupProfile("homens")).toBe(true);
    expect(isGroupProfile("outro")).toBe(false);
    expect(isGroupProfile(null)).toBe(false);
    expect(profileLabel("jovens")).toBe("Jovens e Adolescentes");
  });
});
