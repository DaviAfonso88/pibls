/**
 * Datas e horas em pt-BR, sempre no fuso de São Paulo (i18n / L10n Strategy).
 *
 * A API grava e devolve UTC (ISO 8601 com `Z`); quem vê a tela, em qualquer lugar, lê o horário de Lagoa Santa. O fuso
 * é fixo de propósito: o navegador de um visitante em viagem não pode mostrar "10h10" para um culto que é às 10h10 daqui
 * só que no horário dele.
 */

export const TIME_ZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";

export type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Data inválida: ${String(value)}`);
  }
  return date;
}

// Os formatadores são caros de criar; cada um nasce uma vez
const formatters = {
  date: new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }),
  dateLong: new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  monthYear: new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }),
  parts: new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }),
  offset: new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" }),
};

/** `2026-11-08T13:10:00Z` → `08/11/2026` */
export function formatDate(value: DateInput): string {
  return formatters.date.format(toDate(value));
}

/** `2026-11-08T13:10:00Z` → `domingo, 8 de novembro de 2026` */
export function formatDateLong(value: DateInput): string {
  return formatters.dateLong.format(toDate(value));
}

/** `2026-11-08` → `novembro de 2026` (filtro de boletins por mês e ano) */
export function formatMonthYear(value: DateInput): string {
  return formatters.monthYear.format(toDate(value));
}

function partsOf(
  value: DateInput,
): Record<"year" | "month" | "day" | "hour" | "minute" | "second", string> {
  const result: Record<string, string> = {};
  for (const part of formatters.parts.formatToParts(toDate(value))) {
    result[part.type] = part.value;
  }
  return result as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

/** `2026-11-08T13:10:00Z` → `10h10` (horário de São Paulo) */
export function formatTime(value: DateInput): string {
  const { hour, minute } = partsOf(value);
  return `${hour}h${minute}`;
}

/** `2026-11-08T13:10:00Z` → `08/11/2026 às 10h10` */
export function formatDateTime(value: DateInput): string {
  return `${formatDate(value)} às ${formatTime(value)}`;
}

/** `"10:10"` (horário do quadro de horários) → `10h10`; `"20:00"` → `20h00`. Qualquer outra coisa volta como veio. */
export function formatScheduleTime(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? `${match[1]}h${match[2]}` : value;
}

/**
 * Valor de `<input type="datetime-local">` (`2026-11-08T10:10`, sem fuso, hora de São Paulo) → ISO 8601 com o
 * deslocamento de São Paulo naquela data (`2026-11-08T10:10:00-03:00`), que é o que a API aceita na entrada.
 */
export function toApiDateTime(localValue: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localValue);
  if (!match) throw new RangeError(`Data e hora inválidas: ${localValue}`);

  const [, year, month, day, hour, minute, second = "00"] = match;
  // Primeiro trata o valor como UTC para achar o deslocamento daquele dia; depois o aplica
  const guess = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  const offsetPart =
    formatters.offset.formatToParts(guess).find((part) => part.type === "timeZoneName")?.value ??
    "GMT-03:00";
  const offset = offsetPart === "GMT" ? "+00:00" : offsetPart.replace("GMT", "");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

/** ISO 8601 (qualquer fuso) → valor para `<input type="datetime-local">` na hora de São Paulo: `2026-11-08T10:10`. */
export function toDateTimeLocal(value: DateInput): string {
  const { year, month, day, hour, minute } = partsOf(value);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** ISO 8601 → `AAAA-MM-DD` na data de São Paulo (campo `reference_date`, `<input type="date">`). */
export function toDateInput(value: DateInput): string {
  const { year, month, day } = partsOf(value);
  return `${year}-${month}-${day}`;
}

/** Idade em anos completos de uma instituição ou pessoa, contada na data de São Paulo. */
export function yearsSince(start: DateInput, now: DateInput = new Date()): number {
  const from = partsOf(start);
  const to = partsOf(now);
  let years = Number(to.year) - Number(from.year);
  if (
    Number(to.month) < Number(from.month) ||
    (to.month === from.month && Number(to.day) < Number(from.day))
  ) {
    years -= 1;
  }
  return years;
}

/** `2026-10-18` (data sem hora, como `reference_date`) → `18/10/2026`. Sem passar por fuso: é só uma data do calendário. */
export function formatIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

const calendarDayLong = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** `2026-10-25` (data sem hora) → `Domingo, 25 de outubro`. Sem fuso, como `formatIsoDate`; abre com maiúscula, como o design. */
export function formatIsoDateLong(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const noon = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  const text = calendarDayLong.format(new Date(noon));

  return text.charAt(0).toUpperCase() + text.slice(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Os domingos em volta de hoje (data de São Paulo, `AAAA-MM-DD`): `last` é o último, que é hoje se hoje é domingo, e
 * `next` é o próximo, que também é hoje se hoje é domingo.
 */
export function sundaysAround(now: DateInput = new Date()): { last: string; next: string } {
  const today = toDateInput(now);
  const noon = new Date(`${today}T12:00:00Z`).getTime();
  const weekday = new Date(noon).getUTCDay();
  const iso = (offsetDays: number) =>
    new Date(noon + offsetDays * DAY_MS).toISOString().slice(0, 10);

  return { last: iso(-weekday), next: iso((7 - weekday) % 7) };
}
