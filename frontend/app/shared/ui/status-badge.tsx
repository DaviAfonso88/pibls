import type { ComponentProps } from "react";
import { Badge } from "./badge";

/** Tom do selo. A cor reforça, mas o texto sempre diz o estado (WCAG 1.4.1: nunca só a cor). */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const VARIANT_BY_TONE = {
  neutral: "secondary",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
} as const satisfies Record<StatusTone, ComponentProps<typeof Badge>["variant"]>;

export interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, "variant"> {
  tone?: StatusTone;
}

/** Selo de situação (Novo, Publicado, Agendado, Encerrado…). O texto vem de quem usa. */
export function StatusBadge({ tone = "neutral", ...props }: StatusBadgeProps) {
  return <Badge variant={VARIANT_BY_TONE[tone]} {...props} />;
}
