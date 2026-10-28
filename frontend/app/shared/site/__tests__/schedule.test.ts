import { describe, expect, it } from "vitest";
import {
  activityAt,
  groupByDay,
  scheduleDetail,
  shortDay,
  sortSchedule,
  weekdayKey,
  weekdayOrder,
} from "../schedule";

const schedule = [
  {
    day: "Sexta-feira",
    recurrence: "1ª sexta-feira do mês",
    activity: "Culto Salt",
    time: "19:30",
    mode: "Presencial",
  },
  {
    day: "Quinta-feira",
    recurrence: "semanal",
    activity: "Culto de Oração",
    time: "20:00",
    mode: "Presencial e online",
  },
  {
    day: "Domingo",
    recurrence: "semanal",
    activity: "Culto Noturno",
    time: "19:30",
    mode: "Presencial e YouTube",
  },
  { day: "Domingo", recurrence: "semanal", activity: "EBD", time: "09:00", mode: null },
];

function pick(activity: string) {
  const found = schedule.find((item) => item.activity === activity);
  if (!found) throw new Error(`sem ${activity}`);
  return found;
}

describe("quadro de horários", () => {
  it("normaliza o dia da semana", () => {
    expect(weekdayKey("Quinta-feira")).toBe("quinta");
    expect(weekdayKey("TERÇA-FEIRA")).toBe("terca");
    expect(weekdayKey("Sábado")).toBe("sabado");
    expect(weekdayOrder("domingo")).toBeLessThan(weekdayOrder("sabado"));
    expect(weekdayOrder("feriado")).toBe(7);
  });

  it("abrevia o dia em três letras", () => {
    expect(shortDay("Quinta-feira")).toBe("Qui");
    expect(shortDay(" Domingo")).toBe("Dom");
  });

  it("ordena por dia (domingo primeiro) e horário, sem alterar a lista original", () => {
    const sorted = sortSchedule(schedule);

    expect(sorted.map((item) => item.activity)).toEqual([
      "EBD",
      "Culto Noturno",
      "Culto de Oração",
      "Culto Salt",
    ]);
    expect(schedule[0]?.activity).toBe("Culto Salt");
  });

  it("junta a recorrência (se não for semanal) e a modalidade", () => {
    expect(scheduleDetail(pick("Culto Salt"))).toBe("1ª sexta-feira do mês · Presencial");
    expect(scheduleDetail(pick("Culto de Oração"))).toBe("Presencial e online");
    expect(scheduleDetail(pick("EBD"))).toBe("");
  });

  it("agrupa por dia, sem o '-feira', e escreve o horário como 10h10", () => {
    const days = groupByDay(schedule);

    expect(days.map((day) => day.label)).toEqual(["Domingo", "Quinta", "Sexta"]);
    expect(days[0]?.items.map((item) => activityAt(item))).toEqual([
      "EBD às 09h00",
      "Culto Noturno às 19h30",
    ]);
  });
});
