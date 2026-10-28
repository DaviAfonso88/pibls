import { describe, expect, it } from "vitest";
import { addressLines, safeHttpUrl, summarizeServices, whatsappUrl } from "../links";
import type { PublicSettings } from "../settings";

const schedule: PublicSettings["schedule"] = [
  {
    day: "Quinta-feira",
    recurrence: "semanal",
    activity: "Culto de Oração",
    time: "20:00",
    mode: "Presencial e online",
  },
  { day: "Domingo", recurrence: "semanal", activity: "EBD", time: "09:00", mode: "Presencial" },
  {
    day: "Domingo",
    recurrence: "semanal",
    activity: "Culto Noturno",
    time: "19:30",
    mode: "Presencial e YouTube",
  },
  {
    day: "Domingo",
    recurrence: "semanal",
    activity: "Culto Matinal",
    time: "10:10",
    mode: "Presencial e YouTube",
  },
  {
    day: "Sexta-feira",
    recurrence: "1ª do mês",
    activity: "Culto Salt",
    time: "19:30",
    mode: "Presencial",
  },
];

describe("safeHttpUrl", () => {
  it("aceita só http e https", () => {
    expect(safeHttpUrl("https://youtube.com/@pibls")).toBe("https://youtube.com/@pibls");
    expect(safeHttpUrl("http://exemplo.com/")).toBe("http://exemplo.com/");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<b>x</b>",
    "ftp://exemplo.com",
    "não é url",
    "",
    null,
    undefined,
  ])("recusa %s", (value) => {
    expect(safeHttpUrl(value)).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("monta o link wa.me com o texto padrão codificado", () => {
    expect(whatsappUrl({ phone: "+5531999998888", default_text: "Olá! Vim pelo site." })).toBe(
      "https://wa.me/5531999998888?text=Ol%C3%A1!%20Vim%20pelo%20site.",
    );
  });

  it("aceita o telefone com máscara e sem texto", () => {
    expect(whatsappUrl({ phone: "(31) 99999-8888" })).toBe("https://wa.me/5531999998888");
    expect(whatsappUrl({ phone: "31999998888", default_text: "  " })).toBe(
      "https://wa.me/5531999998888",
    );
  });

  it("devolve nulo sem telefone válido", () => {
    expect(whatsappUrl({ phone: "123" })).toBeNull();
    expect(whatsappUrl(undefined)).toBeNull();
    expect(whatsappUrl(null)).toBeNull();
  });
});

describe("summarizeServices", () => {
  it("agrupa os cultos por dia, em ordem de semana, com horários 10h10", () => {
    expect(summarizeServices(schedule)).toEqual([
      "Domingo · 10h10 e 19h30",
      "Quinta · 20h00",
      "Sexta · 19h30 (1ª do mês)",
    ]);
  });

  it("ignora o que não é culto (EBD) e aceita lista vazia", () => {
    expect(summarizeServices(schedule.filter((item) => item.activity === "EBD"))).toEqual([]);
    expect(summarizeServices([])).toEqual([]);
  });

  it("reconhece o dia sem acento ou com maiúsculas diferentes", () => {
    expect(
      summarizeServices([
        { day: "TERÇA-FEIRA", activity: "Culto Jovem", time: "20:00" },
        { day: "Sábado", activity: "Culto Jovem", time: "19:00" },
        { day: "domingo", activity: "Culto Matinal", time: "10:10" },
      ]),
    ).toEqual(["domingo · 10h10", "TERÇA · 20h00", "Sábado · 19h00"]);
  });
});

describe("addressLines", () => {
  it("monta rua, número, complemento e bairro, e depois cidade e estado", () => {
    expect(
      addressLines({
        street: "Rua das Flores",
        number: "100",
        complement: "sala 2",
        neighborhood: "Centro",
        city: "Lagoa Santa",
        state: "MG",
        zip: "33400000",
      }),
    ).toEqual(["Rua das Flores, 100, sala 2 — Centro", "Lagoa Santa — MG"]);
  });

  it("pula o que falta", () => {
    expect(addressLines({ street: "Rua das Flores", city: "Lagoa Santa", state: "MG" })).toEqual([
      "Rua das Flores",
      "Lagoa Santa — MG",
    ]);
    expect(addressLines(null)).toEqual([]);
    expect(addressLines({})).toEqual([]);
  });
});
