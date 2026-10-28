import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, CircleAlertIcon, PlusIcon } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useState } from "react";
import { cn } from "~/shared/lib/utils";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Switch } from "~/shared/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
  MINISTRY_CATEGORIES,
  adminMinistriesQuery,
  updateMinistry,
  type AdminMinistry,
  type MinistryCategory,
} from "../../admin-api";
import { ministriesAdminMessages as text } from "../../admin-messages";
import { moveUpdates } from "../../admin-order";
import { MinistryForm } from "./ministry-form";

/** O que a URL guarda para cada aba (`?tipo=`). */
const TAB_PARAM: Record<MinistryCategory, string> = {
  MINISTERIO: "ministerios",
  GRUPO: "grupos",
  CELULA: "celulas",
};

function categoryOf(param: string | null): MinistryCategory {
  return MINISTRY_CATEGORIES.find((category) => TAB_PARAM[category] === param) ?? "MINISTERIO";
}

/**
 * Ministérios, grupos e células no painel (design: AdminMinisterios; CAP-16). Três abas, a lista na ordem do site com
 * subir, descer e ligar/desligar, e o formulário do item escolhido ao lado. A aba e o item ficam na URL
 * (`/admin/ministerios/12?tipo=grupos`), então recarregar ou compartilhar o endereço volta ao mesmo lugar.
 */
export function MinistriesAdmin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const query = useQuery(adminMinistriesQuery());
  const [problem, setProblem] = useState<string | null>(null);

  const all = query.data ?? [];
  const isNew = id === "novo";
  const selected =
    isNew || id === undefined ? null : (all.find((item) => String(item.id) === id) ?? null);
  // Aberto um item pelo endereço, a aba é a dele; sem item, vale o `?tipo=`
  const category = selected !== null ? selected.category : categoryOf(params.get("tipo"));
  const items = all.filter((item) => item.category === category);

  function go(path: string, tab: MinistryCategory): void {
    void navigate({ pathname: path, search: `?tipo=${TAB_PARAM[tab]}` });
  }

  function refresh(): Promise<void> {
    void queryClient.invalidateQueries({ queryKey: ["snapshot", "ministries"] });
    return queryClient.invalidateQueries({ queryKey: adminMinistriesQuery().queryKey });
  }

  const toggle = useMutation({
    mutationFn: (item: AdminMinistry) => updateMinistry(item.id, { is_active: !item.is_active }),
    onSuccess: async () => {
      setProblem(null);
      await refresh();
    },
    onError: () => setProblem(text.toggleError),
  });

  const move = useMutation({
    mutationFn: (updates: { id: number; display_order: number }[]) =>
      Promise.all(
        updates.map((update) => updateMinistry(update.id, { display_order: update.display_order })),
      ),
    onSuccess: async () => {
      setProblem(null);
      await refresh();
    },
    onError: async () => {
      setProblem(text.moveError);
      await refresh();
    },
  });

  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          message={text.loadError}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  if (!query.data) return <LoadingBlock count={4} className="mx-auto max-w-6xl" />;

  const busy = toggle.isPending || move.isPending;
  const missing = id !== undefined && !isNew && selected === null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${text.title} — Painel PIBLS`}</title>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
            {text.title}
          </h1>
          <p className="m-0 text-muted-foreground">{text.intro}</p>
        </div>
        <Button size="lg" onClick={() => go("/admin/ministerios/novo", category)}>
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {text.newLabel[category]}
        </Button>
      </header>

      <Tabs
        value={category}
        onValueChange={(value) => go("/admin/ministerios", value as MinistryCategory)}
      >
        <TabsList
          variant="line"
          aria-label={text.tabsLabel}
          className="w-full justify-start gap-1 rounded-none border-b border-border-strong p-0 group-data-horizontal/tabs:h-12"
        >
          {MINISTRY_CATEGORIES.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-12 flex-none px-4 text-base font-semibold data-active:font-extrabold data-active:text-primary group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[3px] after:bg-primary"
            >
              {text.tabs[tab]}{" "}
              <span className="font-semibold text-muted-foreground">
                ({all.filter((item) => item.category === tab).length})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {problem ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <CircleAlertIcon aria-hidden="true" />
          {problem}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label={text.listLabel}
          className="min-w-0 flex-[3_1_25rem] overflow-hidden rounded-[14px] border border-border bg-card"
        >
          <div
            aria-hidden="true"
            className="flex gap-3 border-b border-border bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground"
          >
            <span className="w-24 flex-none">{text.order}</span>
            <span className="flex-1">{text.name}</span>
            <span className="w-16 flex-none">{text.active}</span>
          </div>
          {items.length === 0 ? (
            <EmptyState title={text.empty} className="border-0" />
          ) : (
            <ol className="m-0 max-h-[44rem] list-none overflow-y-auto p-0">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 border-b border-border px-4 py-1.5 last:border-b-0",
                    item.id === selected?.id && "bg-info shadow-[inset_4px_0_0_var(--primary)]",
                  )}
                >
                  <span className="flex w-24 flex-none gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-10"
                      aria-label={text.moveUp(item.name)}
                      disabled={index === 0 || busy}
                      onClick={() => move.mutate(moveUpdates(items, index, -1))}
                    >
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-10"
                      aria-label={text.moveDown(item.name)}
                      disabled={index === items.length - 1 || busy}
                      onClick={() => move.mutate(moveUpdates(items, index, 1))}
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </Button>
                  </span>
                  <button
                    type="button"
                    aria-current={item.id === selected?.id ? "true" : undefined}
                    onClick={() => go(`/admin/ministerios/${item.id}`, category)}
                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-md border-0 bg-transparent p-0 text-left font-bold break-words text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span>{item.name}</span>
                    {item.is_active ? null : (
                      <span className="text-[13px] font-semibold text-muted-foreground">
                        {text.hiddenOnSite}
                      </span>
                    )}
                  </button>
                  <span className="w-16 flex-none">
                    <Switch
                      checked={item.is_active}
                      disabled={busy}
                      aria-label={text.toggle(item.name)}
                      onCheckedChange={() => toggle.mutate(item)}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {missing ? (
          <div className="flex min-w-0 flex-[2_1_20rem] flex-col gap-3 rounded-[14px] border border-border bg-card p-5">
            <p className="m-0 font-bold">{text.form.notFound}</p>
            <Button variant="outline" onClick={() => go("/admin/ministerios", category)}>
              {text.form.backToList}
            </Button>
          </div>
        ) : (
          <MinistryForm
            key={selected?.id ?? `novo-${category}`}
            category={category}
            ministry={selected}
            onSaved={async (saved, created) => {
              await refresh();
              if (created) go(`/admin/ministerios/${saved.id}`, saved.category);
            }}
            onDeleted={async () => {
              await refresh();
              go("/admin/ministerios", category);
            }}
          />
        )}
      </div>
    </div>
  );
}
