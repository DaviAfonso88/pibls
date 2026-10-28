import { formatDate, formatTime, toDateInput } from "~/shared/format";
import { accessMessages } from "./messages";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A coluna "Último acesso" do diretório (design: AdminUsuarios): `Hoje, 08h40`, `Ontem, 21h15`, `18/10` no mesmo ano e
 * `18/10/2025` antes disso. Tudo na data de São Paulo. Quem nunca entrou vê "Nunca entrou".
 */
export function formatLastAccess(
  lastLoginAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!lastLoginAt) return accessMessages.users.never;

  const day = toDateInput(lastLoginAt);
  if (day === toDateInput(now)) return `Hoje, ${formatTime(lastLoginAt)}`;
  if (day === toDateInput(new Date(now.getTime() - DAY_MS)))
    return `Ontem, ${formatTime(lastLoginAt)}`;

  const full = formatDate(lastLoginAt); // dd/mm/aaaa
  return day.slice(0, 4) === toDateInput(now).slice(0, 4) ? full.slice(0, 5) : full;
}
