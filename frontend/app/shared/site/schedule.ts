import { formatScheduleTime } from "~/shared/format";
import type { PublicSettings } from "./settings";

export type ScheduleItem = PublicSettings["schedule"][number];

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;

/** `Quinta-feira` → `quinta`; `TERÇA-FEIRA` → `terca`; `Sábado` → `sabado`. */
export function weekdayKey(day: string): string {
  return day
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/-feira$/, "")
    .trim();
}

/** Posição na semana começando no domingo; dia que não reconhece vai para o fim. */
export function weekdayOrder(key: string): number {
  const index = WEEKDAYS.findIndex((weekday) => weekday === key);
  return index === -1 ? WEEKDAYS.length : index;
}

/** `Quinta-feira` → `Qui`; `Domingo` → `Dom`. */
export function shortDay(day: string): string {
  return day.trim().slice(0, 3);
}

/** Domingo primeiro, e dentro do dia por horário (`HH:MM` ordena como texto). */
export function sortSchedule(items: readonly ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(
    (a, b) =>
      weekdayOrder(weekdayKey(a.day)) - weekdayOrder(weekdayKey(b.day)) ||
      a.time.localeCompare(b.time),
  );
}

/** Complemento de um item do quadro: a recorrência (se não for semanal) e a modalidade. */
export function scheduleDetail(item: ScheduleItem): string {
  const recurrence =
    item.recurrence && item.recurrence.trim().toLowerCase() !== "semanal" ? item.recurrence : null;
  return [recurrence, item.mode].filter((part): part is string => Boolean(part)).join(" · ");
}

export interface ScheduleDay {
  label: string;
  items: ScheduleItem[];
}

/** O quadro agrupado por dia da semana, na ordem do calendário. */
export function groupByDay(items: readonly ScheduleItem[]): ScheduleDay[] {
  const days = new Map<string, ScheduleDay>();
  for (const item of sortSchedule(items)) {
    const key = weekdayKey(item.day);
    const day = days.get(key) ?? { label: item.day.replace(/-feira$/i, ""), items: [] };
    day.items.push(item);
    days.set(key, day);
  }
  return [...days.values()];
}

/** `Culto Matinal às 10h10`. */
export function activityAt(item: ScheduleItem): string {
  return `${item.activity} às ${formatScheduleTime(item.time)}`;
}
