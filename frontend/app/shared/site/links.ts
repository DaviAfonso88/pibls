import { formatScheduleTime, toE164 } from "~/shared/format";
import { weekdayKey, weekdayOrder } from "./schedule";
import type { PublicSettings } from "./settings";

/** Só `http:` e `https:`. Uma configuração com `javascript:` ou `data:` nunca vira `href`. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** `https://wa.me/5531999998888?text=…`, ou `null` se o telefone não for válido. */
export function whatsappUrl(whatsapp: PublicSettings["whatsapp"]): string | null {
  const e164 = whatsapp ? toE164(whatsapp.phone) : null;
  if (e164 === null) return null;

  const text = whatsapp?.default_text?.trim();
  const base = `https://wa.me/${e164.slice(1)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Resumo dos cultos para o rodapé, um item por dia: `Domingo · 10h10 e 19h30`, `Quinta · 20h00`,
 * `Sexta · 19h30 (1ª do mês)`. Só as atividades cujo nome começa com "Culto"; o quadro completo fica na página inicial.
 */
export function summarizeServices(schedule: PublicSettings["schedule"]): string[] {
  const byDay = new Map<string, { label: string; times: string[]; note: string | null }>();

  for (const item of schedule) {
    if (!/^culto/i.test(item.activity)) continue;

    const key = weekdayKey(item.day);
    const entry = byDay.get(key) ?? {
      label: item.day.replace(/-feira$/i, ""),
      times: [],
      note: null,
    };
    entry.times.push(item.time);
    if (item.recurrence && item.recurrence.toLowerCase() !== "semanal")
      entry.note = item.recurrence;
    byDay.set(key, entry);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => weekdayOrder(a) - weekdayOrder(b))
    .map(([, { label, times, note }]) => {
      const hours = [...times].sort().map(formatScheduleTime).join(" e ");
      return `${label} · ${hours}${note ? ` (${note})` : ""}`;
    });
}

/** `Rua A, 100, sala 2 — Centro` e `Lagoa Santa — MG`. Vazio onde não há dado. */
export function addressLines(address: PublicSettings["address"]): string[] {
  if (!address) return [];

  const street = [address.street, address.number, address.complement]
    .filter((part): part is string => Boolean(part))
    .join(", ");
  const first = [street, address.neighborhood].filter(Boolean).join(" — ");
  const second = [address.city, address.state].filter(Boolean).join(" — ");

  return [first, second].filter((line) => line !== "");
}
