import { messages } from "~/shared/messages";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  /** Item que só existe com a funcionalidade ligada (flag do .env, exposta em `settings.features`). */
  feature?: "events";
}

/** Menu do site público, na ordem do design (Frontend Architecture → Tabela de rotas). */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: messages.nav.home, to: "/" },
  { id: "about", label: messages.nav.about, to: "/quem-somos" },
  { id: "groups", label: messages.nav.groups, to: "/grupos" },
  { id: "ministries", label: messages.nav.ministries, to: "/ministerios" },
  { id: "bulletins", label: messages.nav.bulletins, to: "/boletins" },
  { id: "palavra-viva", label: messages.nav.palavraViva, to: "/palavra-viva" },
  { id: "events", label: messages.nav.events, to: "/eventos", feature: "events" },
  { id: "give", label: messages.nav.give, to: "/contribua" },
  { id: "directions", label: messages.nav.directions, to: "/como-chegar" },
  { id: "contact", label: messages.nav.contact, to: "/contato" },
];

/** Tira do menu o que depende de uma funcionalidade desligada (hoje, só Eventos na R1). */
export function visibleNavItems(features: { events: boolean }): NavItem[] {
  return NAV_ITEMS.filter((item) => item.feature === undefined || features[item.feature]);
}
