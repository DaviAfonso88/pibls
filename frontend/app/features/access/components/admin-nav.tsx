import {
  BookOpenIcon,
  CalendarIcon,
  FileTextIcon,
  HeartIcon,
  HouseIcon,
  InboxIcon,
  LogOutIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Link } from "react-router";
import { cn } from "~/shared/lib/utils";
import { useAuth } from "../auth-context";
import { accessMessages } from "../messages";
import { roleLabel, type PermissionRequirement } from "../permissions";

/** Quais itens do menu mostram o selo de novos (a contagem vem de quem monta o painel, que conhece a API de contatos). */
export type MenuBadge = "contacts" | "prayer";

interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Sem permissão = todo usuário logado (só o Início). */
  permission?: PermissionRequirement;
  /** Item de uma funcionalidade que a R1 deixa desligada (flag `features.events`). */
  feature?: "events";
  /** Só é o item ativo na rota exata (o Início não pode ficar aceso em todas). */
  end?: boolean;
  /** O selo "N novos" ao lado do nome, quando a contagem é maior que zero. */
  badge?: MenuBadge;
}

interface MenuGroup {
  label: string;
  items: readonly MenuItem[];
}

const { menu } = accessMessages;

/**
 * O menu lateral (design: AdminNav; Frontend → Route guards): cada item aparece só para quem tem a permissão da tela
 * (US-19). É só experiência: a API recusa de qualquer jeito (BR-076).
 */
export const MENU: readonly MenuGroup[] = [
  {
    label: menu.groups.service,
    items: [
      { to: "/admin", label: menu.home, icon: HouseIcon, end: true },
      {
        to: "/admin/contatos",
        label: menu.contacts,
        icon: InboxIcon,
        permission: "leads.read",
        badge: "contacts",
      },
      {
        to: "/admin/oracao",
        label: menu.prayer,
        icon: HeartIcon,
        permission: "leads.oracao.read",
        badge: "prayer",
      },
    ],
  },
  {
    label: menu.groups.content,
    items: [
      {
        to: "/admin/boletins",
        label: menu.bulletins,
        icon: FileTextIcon,
        permission: "boletins.write",
      },
      {
        to: "/admin/palavra-viva",
        label: menu.palavraViva,
        icon: BookOpenIcon,
        permission: "mensagens.write",
      },
      {
        to: "/admin/eventos",
        label: menu.events,
        icon: CalendarIcon,
        permission: ["eventos.write", "eventos.write.own"],
        feature: "events",
      },
    ],
  },
  {
    label: menu.groups.church,
    items: [
      {
        to: "/admin/ministerios",
        label: menu.ministries,
        icon: UsersIcon,
        permission: "ministerios.write",
      },
      {
        to: "/admin/configuracoes",
        label: menu.settings,
        icon: SlidersHorizontalIcon,
        permission: "settings.write",
      },
      { to: "/admin/pix", label: menu.pix, icon: WalletIcon, permission: "pix.write" },
    ],
  },
  {
    label: menu.groups.team,
    items: [{ to: "/admin/usuarios", label: menu.users, icon: UserIcon, permission: "users.read" }],
  },
];

const linkClass =
  "flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 text-[15px] text-foreground/90 no-underline hover:bg-muted hover:text-foreground aria-[current=page]:bg-info aria-[current=page]:font-bold aria-[current=page]:text-info-foreground";

/**
 * Os grupos e itens que esta pessoa vê. Grupo sem nenhum item visível some. Separado do componente para ser testado sem
 * montar a tela.
 */
export function visibleMenu(
  can: (permission: PermissionRequirement) => boolean,
  features: { events: boolean },
): MenuGroup[] {
  return MENU.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (item.feature === undefined || features[item.feature]) &&
        (item.permission === undefined || can(item.permission)),
    ),
  })).filter((group) => group.items.length > 0);
}

function NewBadge({ total }: { total: number }) {
  if (total <= 0) return null;

  return (
    <>
      {/* O espaço separa o nome do selo no texto do link */}{" "}
      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-warning px-2 text-[13px] leading-6 font-bold text-warning-foreground tabular-nums">
        <span aria-hidden="true">{total}</span>
        <span className="sr-only">{menu.newCount(total)}</span>
      </span>
    </>
  );
}

export function AdminNav({
  features,
  badges = {},
  onNavigate,
  className,
}: {
  features: { events: boolean };
  /** Contatos novos por item; ausente ou zero = sem selo. */
  badges?: Partial<Record<MenuBadge, number>>;
  /** O menu do celular fecha ao escolher um item. */
  onNavigate?: () => void;
  className?: string;
}) {
  const { user, can, signOut } = useAuth();
  const groups = visibleMenu(can, features);
  const roles = user?.roles.map(roleLabel).join(" · ") ?? "";

  return (
    <div className={cn("flex flex-col gap-5 px-3 py-4", className)}>
      <Link
        to="/admin"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-2.5 px-2 text-foreground no-underline hover:text-foreground"
      >
        <img
          src="/logos/logo-horizontal.png"
          width={286}
          height={100}
          alt="PIBLS"
          decoding="async"
          className="block h-9 w-auto flex-none"
        />
        <span className="text-[13px] font-semibold text-muted-foreground">
          {accessMessages.panelName}
        </span>
      </Link>

      <nav aria-label={menu.label} className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {group.label}
            </span>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={linkClass}
              >
                <item.icon aria-hidden="true" className="size-[18px] flex-none" />
                <span className="flex-1">{item.label}</span>
                <NewBadge total={item.badge === undefined ? 0 : (badges[item.badge] ?? 0)} />
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border px-2 pt-3.5">
        <span className="flex flex-col">
          <span className="font-bold">{user?.name}</span>
          <span className="text-[13px] text-muted-foreground">
            {[roles, user?.ministry?.name].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex flex-wrap gap-x-3">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
          >
            {accessMessages.seeSite}
          </Link>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              void signOut();
            }}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-semibold text-foreground/90 hover:text-foreground"
          >
            <LogOutIcon aria-hidden="true" className="size-4" />
            {menu.signOut}
          </button>
        </span>
      </div>
    </div>
  );
}
