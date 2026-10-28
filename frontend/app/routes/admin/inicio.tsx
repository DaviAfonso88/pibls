import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronRightIcon, ClockIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "~/features/access/auth-context";
import { greeting, longDate } from "~/features/access/greeting";
import { accessMessages } from "~/features/access/messages";
import type { PermissionRequirement } from "~/features/access/permissions";
import { LEAD_TYPE_LABELS, stalledLeadsQuery } from "~/features/leads/stalled";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { usePublicSettings } from "~/shared/site/settings";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { StatusBadge } from "~/shared/ui/status-badge";
import { Card, Summary, ThisWeek, TodayRegistrations } from "./inicio-summary";

const { home } = accessMessages;

interface Shortcut {
  to: string;
  label: string;
  permission: PermissionRequirement;
  feature?: "events";
}

/** Atalhos do que cada perfil faz no dia a dia. Só aparece o que a permissão da pessoa abre. */
const SHORTCUTS: readonly Shortcut[] = [
  { to: "/admin/contatos", label: home.shortcutLabels.contacts, permission: "leads.read" },
  { to: "/admin/oracao", label: home.shortcutLabels.prayer, permission: "leads.oracao.read" },
  { to: "/admin/boletins/novo", label: home.shortcutLabels.bulletin, permission: "boletins.write" },
  {
    to: "/admin/palavra-viva/nova",
    label: home.shortcutLabels.palavraViva,
    permission: "mensagens.write",
  },
  {
    to: "/admin/eventos/novo",
    label: home.shortcutLabels.event,
    permission: ["eventos.write", "eventos.write.own"],
    feature: "events",
  },
  { to: "/admin/configuracoes", label: home.shortcutLabels.settings, permission: "settings.write" },
  {
    to: "/admin/ministerios",
    label: home.shortcutLabels.ministries,
    permission: "ministerios.write",
  },
  { to: "/admin/pix", label: home.shortcutLabels.pix, permission: "pix.write" },
  { to: "/admin/usuarios", label: home.shortcutLabels.users, permission: "users.read" },
];

/**
 * Contatos novos esperando há mais de 3 dias (BR-010), só para quem lê a caixa geral. Se a API ainda não tem a rota (404),
 * o bloco some em silêncio; qualquer outra falha mostra o erro com "Tentar novamente".
 */
function StalledLeads() {
  const query = useQuery(stalledLeadsQuery());

  if (query.isError && isApiError(query.error) && query.error.status === 404) return null;

  return (
    <Card className="flex-[3_1_26rem]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="m-0 text-lg font-extrabold">{home.stalledTitle}</h2>
        <Link to="/admin/contatos" className="text-[15px] font-semibold whitespace-nowrap">
          {home.stalledAll}
        </Link>
      </div>

      {query.isPending ? (
        <LoadingBlock count={3} className="p-4" />
      ) : query.isError ? (
        <ErrorState
          headingLevel="h3"
          title={home.stalledError}
          message={messages.errors.generic}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data.length === 0 ? (
        <p className="m-0 flex items-center gap-2.5 px-5 py-6 text-success-foreground">
          <CheckIcon aria-hidden="true" className="size-5 flex-none" strokeWidth={2.5} />
          {home.stalledEmpty}
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {query.data.map((lead) => (
            <li key={lead.id} className="border-b border-muted last:border-b-0">
              <Link
                to={`/admin/contatos/${lead.id}`}
                className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-foreground no-underline hover:bg-muted"
              >
                <span className="flex min-w-48 flex-1 flex-col">
                  <span className="font-bold">{lead.name ?? home.anonymous}</span>
                  <span className="text-sm text-muted-foreground">
                    {LEAD_TYPE_LABELS[lead.type]} · {lead.assigned_to?.name ?? home.noOwner}
                  </span>
                </span>
                <StatusBadge tone="warning" className="gap-1.5">
                  <ClockIcon aria-hidden="true" className="size-3.5" />
                  {home.waiting(lead.waiting_days)}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Início do painel (design: AdminInicio): saudação, "Ver o site", o resumo em números, os contatos parados, os atalhos, as
 * inscrições de hoje e "Nesta semana". Cada bloco só aparece para quem tem a permissão do que ele mostra.
 */
export default function AdminInicio({ now = new Date() }: { now?: Date }) {
  const { user, can } = useAuth();
  const { settings } = usePublicSettings();
  const eventsEnabled = settings?.features.events ?? false;
  const shortcuts = SHORTCUTS.filter(
    (shortcut) => (shortcut.feature !== "events" || eventsEnabled) && can(shortcut.permission),
  );
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <title>Início — Painel PIBLS</title>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="m-0 text-muted-foreground">{longDate(now)}</p>
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
            {greeting(now)}, {firstName}
          </h1>
        </div>
        <Link
          to="/"
          className={buttonClassName({ variant: "outline", className: "gap-2 px-4 font-semibold" })}
        >
          <ExternalLinkIcon aria-hidden="true" className="size-[18px]" />
          {accessMessages.seeSite}
        </Link>
      </header>

      <Summary />

      <div className="flex flex-wrap items-start gap-6">
        {can("leads.read") ? <StalledLeads /> : null}

        <section aria-labelledby="atalhos" className="flex min-w-0 flex-[2_1_17rem] flex-col gap-3">
          <h2 id="atalhos" className="m-0 text-lg font-extrabold">
            {home.shortcuts}
          </h2>
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.to}
              to={shortcut.to}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 font-bold text-foreground no-underline hover:bg-muted"
            >
              <span
                aria-hidden="true"
                className="flex size-8 flex-none items-center justify-center rounded-lg bg-info text-info-foreground"
              >
                <PlusIcon className="size-[18px]" strokeWidth={2.5} />
              </span>
              <span className="flex-1">{shortcut.label}</span>
              <ChevronRightIcon aria-hidden="true" className="size-[18px] text-muted-foreground" />
            </Link>
          ))}
        </section>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <TodayRegistrations />
        <ThisWeek now={now} />
      </div>
    </div>
  );
}
