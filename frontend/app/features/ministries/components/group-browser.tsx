import { ClockIcon, MapPinIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";
import { messages } from "~/shared/messages";
import { badgeVariants } from "~/shared/ui/badge-variants";
import { buttonClassName } from "~/shared/ui/button-variants";
import { EmptyState } from "~/shared/ui/empty-state";
import { Label } from "~/shared/ui/label";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import type { Ministry } from "../api";
import {
  GROUP_PROFILES,
  cellNeighborhoods,
  filterGroups,
  profileLabel,
  profileOf,
  type GroupProfile,
} from "../profiles";

const ALL_NEIGHBORHOODS = "todos";

export interface GroupBrowserProps {
  items: readonly Ministry[];
  profile: GroupProfile | null;
  neighborhood: string | null;
  onProfileChange: (profile: GroupProfile | null) => void;
  onNeighborhoodChange: (neighborhood: string | null) => void;
}

/**
 * Filtros e lista de grupos e Células de CL (design: Grupos; FR-006). O perfil são botões que alternam (`aria-pressed`);
 * o bairro é uma lista que só atua sobre as células. O estado fica na URL, quem usa este componente decide como
 * guardá-lo. Nunca aparece o endereço residencial: o catálogo público nem o recebe (BR-048).
 */
export function GroupBrowser({
  items,
  profile,
  neighborhood,
  onProfileChange,
  onNeighborhoodChange,
}: GroupBrowserProps) {
  const neighborhoods = cellNeighborhoods(items);
  const visible = filterGroups(items, profile, neighborhood);
  const neighborhoodItems = [
    { value: ALL_NEIGHBORHOODS, label: messages.pages.allNeighborhoods },
    ...neighborhoods.map((name) => ({ value: name, label: name })),
  ];

  return (
    <>
      <section
        aria-label={messages.pages.filters}
        className="container flex flex-col gap-4 pt-6 pb-2"
      >
        <div
          role="group"
          aria-label={messages.pages.filterByProfile}
          className="flex flex-wrap gap-2"
        >
          {[{ id: null, label: messages.pages.all }, ...GROUP_PROFILES].map((option) => {
            const active = option.id === profile;
            return (
              <button
                key={option.id ?? "todos"}
                type="button"
                aria-pressed={active}
                onClick={() => onProfileChange(option.id)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-[15px]",
                  active
                    ? "border-primary bg-primary font-bold text-primary-foreground"
                    : "border-border-strong bg-background font-semibold text-foreground hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {neighborhoods.length > 0 ? (
          <div className="flex max-w-sm flex-col gap-1.5">
            <Label htmlFor="bairro" className="text-[15px] font-bold">
              {messages.pages.cellNeighborhood}
            </Label>
            <NativeSelect
              id="bairro"
              name="bairro"
              className="w-full"
              value={neighborhood ?? ALL_NEIGHBORHOODS}
              onChange={(event) =>
                onNeighborhoodChange(
                  event.target.value === ALL_NEIGHBORHOODS ? null : event.target.value,
                )
              }
            >
              {neighborhoodItems.map((entry) => (
                <NativeSelectOption key={entry.value} value={entry.value}>
                  {entry.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </section>

      <section aria-label={messages.pages.groupsList} className="container pt-4 pb-12">
        {visible.length === 0 ? (
          <EmptyState title={messages.pages.noGroups} headingLevel="h2" />
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0" aria-live="polite">
            {visible.map((group) => {
              const groupProfile = profileOf(group);
              return (
                <li
                  key={group.id}
                  className="flex min-w-[min(100%,20rem)] flex-1 flex-col gap-2 rounded-2xl border border-border p-5"
                >
                  {groupProfile ? (
                    <span
                      className={cn(
                        badgeVariants({ variant: "info" }),
                        "self-start tracking-wide uppercase",
                      )}
                    >
                      {profileLabel(groupProfile)}
                    </span>
                  ) : null}
                  <h2 className="m-0 text-[19px] leading-snug">{group.name}</h2>
                  {group.schedule_text ? (
                    <p className="m-0 flex items-start gap-2 text-base text-foreground/80">
                      <ClockIcon aria-hidden="true" className="mt-1 size-[18px] flex-none" />
                      <span>{group.schedule_text}</span>
                    </p>
                  ) : null}
                  {group.neighborhood ? (
                    <p className="m-0 flex items-start gap-2 text-base text-foreground/80">
                      <MapPinIcon aria-hidden="true" className="mt-1 size-[18px] flex-none" />
                      <span>Bairro {group.neighborhood}</span>
                    </p>
                  ) : null}
                  <Link
                    to={`/sou-visitante?grupo=${group.id}`}
                    // O nome acessível diz de qual grupo é o botão e começa pelo texto visível (WCAG 2.5.3)
                    aria-label={`${messages.pages.wantToJoin}: ${group.name}`}
                    className={buttonClassName({
                      size: "default",
                      className: "mt-1 self-start px-[18px] font-bold",
                    })}
                  >
                    {messages.pages.wantToJoin}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
