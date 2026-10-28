import { TIME_ZONE } from "~/shared/format";
import { accessMessages } from "./messages";

const { home } = accessMessages;

/** Saudação pela hora de Brasília: boa noite da meia-noite às 4h59, bom dia até as 11h59, boa tarde até as 17h59 e boa noite depois. */
export function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    }).format(now),
  );

  if (hour < 5) return home.greetingEvening;
  if (hour < 12) return home.greetingMorning;
  if (hour < 18) return home.greetingAfternoon;
  return home.greetingEvening;
}

/** `Terça-feira, 20 de outubro`, com a primeira letra em maiúscula (o design abre a frase com ela). */
export function longDate(now: Date): string {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(now);

  return text.charAt(0).toUpperCase() + text.slice(1);
}
