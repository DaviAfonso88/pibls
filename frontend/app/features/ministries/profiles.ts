import type { Ministry } from "./api";

export type GroupProfile = "celulas" | "homens" | "mulheres" | "jovens" | "criancas";

/** Os perfis do filtro da página de grupos, na ordem do design (FR-006). */
export const GROUP_PROFILES: ReadonlyArray<{ id: GroupProfile; label: string }> = [
  { id: "celulas", label: "Células de CL" },
  { id: "homens", label: "Homens" },
  { id: "mulheres", label: "Mulheres" },
  { id: "jovens", label: "Jovens e Adolescentes" },
  { id: "criancas", label: "Crianças" },
];

export function isGroupProfile(value: string | null | undefined): value is GroupProfile {
  return GROUP_PROFILES.some((profile) => profile.id === value);
}

export function profileLabel(profile: GroupProfile): string {
  return GROUP_PROFILES.find((entry) => entry.id === profile)?.label ?? profile;
}

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * O perfil de um grupo. O catálogo não tem um campo de perfil: toda célula é "Células de CL", e os grupos "Para você"
 * são reconhecidos pelo nome (Homens, Mulheres, Jovens e Adolescentes ou Salt, Crianças ou Mini PIB). Um grupo novo
 * com outro nome aparece em "Todos", sem perfil, até o nome ou esta regra serem ajustados.
 */
export function profileOf(item: Ministry): GroupProfile | null {
  if (item.category === "CELULA") return "celulas";
  if (item.category !== "GRUPO") return null;

  const name = plain(item.name);
  if (/\bhomens?\b|umhbb/.test(name)) return "homens";
  if (/\bmulheres?\b|\bmcm\b/.test(name)) return "mulheres";
  if (/jovens|adolescentes|\bsalt\b/.test(name)) return "jovens";
  if (/criancas|mini pib/.test(name)) return "criancas";
  return null;
}

/** Grupos e células (sem os ministérios), na ordem recebida. */
export function groupsAndCells(items: readonly Ministry[]): Ministry[] {
  return items.filter((item) => item.category === "GRUPO" || item.category === "CELULA");
}

/** Bairros das células, sem repetir, em ordem alfabética do português. */
export function cellNeighborhoods(items: readonly Ministry[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    if (item.category === "CELULA" && item.neighborhood) names.add(item.neighborhood);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Filtra por perfil e, para as células, por bairro. O bairro só atua sobre células: um grupo (Homens, Mulheres…) não
 * some por causa do bairro escolhido.
 */
export function filterGroups(
  items: readonly Ministry[],
  profile: GroupProfile | null,
  neighborhood: string | null,
): Ministry[] {
  return items.filter((item) => {
    if (profile !== null && profileOf(item) !== profile) return false;
    if (neighborhood && item.category === "CELULA" && item.neighborhood !== neighborhood)
      return false;
    return true;
  });
}
