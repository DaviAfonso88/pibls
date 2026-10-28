import {
  TIME_ZONE,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatTime,
  toDateInput,
} from "~/shared/format";
import type { PublicEventSummary } from "./public-api";
import { publicEventMessages as text } from "./public-messages";

const shortWeekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "short" });

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** `2026-11-14T11:00:00Z` → `Sáb., 14/11/2026 · 8h00` (a data do cartão da lista, no horário de São Paulo). */
export function formatCardDate(startsAt: string): string {
  return `${capitalize(shortWeekday.format(new Date(startsAt)))} ${formatDate(startsAt)} · ${formatTime(startsAt)}`;
}

/**
 * Quando o evento acontece, em uma frase: no mesmo dia, "Sábado, 14 de novembro de 2026, das 8h00 às 17h00"; em dias
 * diferentes, "Sexta, 13 de novembro de 2026, às 19h00, até 15/11/2026, às 12h00"; sem término, só o início.
 */
export function formatWhen(startsAt: string, endsAt: string | null | undefined): string {
  const start = `${capitalize(formatDateLong(startsAt))}`;

  if (!endsAt) return `${start}, às ${formatTime(startsAt)}`;

  if (toDateInput(startsAt) === toDateInput(endsAt)) {
    return `${start}, das ${formatTime(startsAt)} às ${formatTime(endsAt)}`;
  }

  return `${start}, às ${formatTime(startsAt)}, até ${formatDateTime(endsAt).replace(" às ", ", às ")}`;
}

/** Como a pessoa vê a situação das inscrições. O que decide cada uma está em `registrationStatus`. */
export type RegistrationStatus = "open" | "full" | "closed" | "held";

/**
 * A situação das inscrições do evento. O servidor manda o estado derivado; aqui só se separa "vagas esgotadas" de
 * "encerradas" (o servidor chama as duas de `INSCRICOES_ENCERRADAS`) pelo prazo: se o prazo ou o início já passou, é
 * encerrada; se não e não há vaga, é esgotada.
 */
export function registrationStatus(
  event: Pick<PublicEventSummary, "starts_at" | "registration">,
  now: Date = new Date(),
): RegistrationStatus {
  const { state, deadline, spots_total, spots_left } = event.registration;

  if (state === "REALIZADO") return "held";
  if (state === "INSCRICOES_ABERTAS") return "open";

  const timeIsUp =
    new Date(event.starts_at) <= now || (deadline != null && new Date(deadline) <= now);
  const soldOut = spots_total != null && spots_left === 0;

  return soldOut && !timeIsUp ? "full" : "closed";
}

/** O selo do cartão: "Inscrições abertas · 22 vagas", "Vagas esgotadas", "Inscrições encerradas" ou "Evento realizado". */
export function statusLabel(event: Pick<PublicEventSummary, "starts_at" | "registration">): string {
  switch (registrationStatus(event)) {
    case "open": {
      const left = event.registration.spots_left;
      return left == null ? text.open : text.openWithSpots(left);
    }
    case "full":
      return text.full;
    case "closed":
      return text.closed;
    case "held":
      return text.held;
  }
}
