import { describe, expect, it } from "vitest";
import { churchAge, creedUrl, formerPastors, timeline, titularPastor } from "../quem-somos";

describe("churchAge (C-05)", () => {
  it("conta os anos completos desde 13/01/1985", () => {
    expect(churchAge(new Date("2026-10-21T15:00:00Z"))).toBe(41);
    expect(churchAge(new Date("2025-03-01T15:00:00Z"))).toBe(40);
  });

  it("vira no dia 13 de janeiro, pelo horário de Brasília", () => {
    // 02:00 UTC de 13/01 ainda é 23:00 de 12/01 em Brasília: a igreja ainda não fez aniversário
    expect(churchAge(new Date("2026-01-13T02:00:00Z"))).toBe(40);
    expect(churchAge(new Date("2026-01-13T12:00:00Z"))).toBe(41);
    expect(churchAge(new Date("2026-01-12T12:00:00Z"))).toBe(40);
  });

  it("no dia da fundação, o número é zero", () => {
    expect(churchAge(new Date("1985-01-13T12:00:00Z"))).toBe(0);
  });
});

describe("conteúdo de Quem somos", () => {
  it("lista os ex-pastores, na ordem do Guia Institucional, com o Pr. Joselito por último", () => {
    expect(formerPastors).toHaveLength(9);
    expect(formerPastors[0]).toBe("Vanduídes Cristovam dos Santos");
    expect(formerPastors[3]).toBe("Sebastião Oliveira de Souza");
    expect(formerPastors[7]).toBe("Luiz Carlos");
    expect(formerPastors[8]).toBe("Joselito F. Sena");
  });

  it("a linha do tempo traz a fundação, o terreno, o Pr. Joselito, o desabamento e o novo pastor", () => {
    expect(timeline.map((milestone) => milestone.year)).toEqual([
      "1985",
      "Mais tarde",
      "2012",
      "2018",
      "2026",
      "Hoje",
    ]);
    expect(timeline[0]?.text).toContain("13 de janeiro");
    expect(timeline[1]?.text).toContain("batistas norte-americanos");
  });

  it("o pastor titular é o Pr. Alan Taques, com biografia e formação", () => {
    expect(titularPastor.name).toBe("Pr. Alan Gefferson de Assunção Taques");
    expect(titularPastor.since).toBe("outubro de 2026");
    expect(titularPastor.biography).toHaveLength(3);
    expect(titularPastor.education).toHaveLength(4);
  });

  it("a Declaração de Fé é um link da CBB", () => {
    expect(creedUrl).toMatch(/^https:\/\/convencaobatista\.com\.br\//);
  });
});
