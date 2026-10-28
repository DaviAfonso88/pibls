import { useSearchParams } from "react-router";
import { useMinistries } from "~/features/ministries/api";
import { GroupBrowser } from "~/features/ministries/components/group-browser";
import { cellNeighborhoods, groupsAndCells, isGroupProfile } from "~/features/ministries/profiles";
import { PageHeader } from "~/shared/layout/page-header";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";

export function meta() {
  return pageMeta({
    title: "Grupos e Células de CL",
    description:
      "Grupos por fase da vida e Células de CL nos lares da Primeira Igreja Batista em Lagoa Santa. Encontre um perto de você.",
    path: "/grupos",
  });
}

export default function Grupos() {
  const { items, isPending, isError, isFetching, refetch } = useMinistries();
  const [params, setParams] = useSearchParams();

  const rawProfile = params.get("perfil");
  const profile = isGroupProfile(rawProfile) ? rawProfile : null;
  const groups = groupsAndCells(items ?? []);
  const rawNeighborhood = params.get("bairro");
  // Um bairro que não existe mais (link antigo) é ignorado
  const neighborhood =
    rawNeighborhood && cellNeighborhoods(groups).includes(rawNeighborhood) ? rawNeighborhood : null;

  function update(key: "perfil" | "bairro", value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  return (
    <>
      <PageHeader title={messages.pages.groupsTitle} intro={messages.pages.groupsIntro}>
        <blockquote className="m-0 max-w-2xl rounded-[14px] border border-border bg-background px-5 py-4">
          <p className="m-0 text-[17px] text-foreground/90 italic">
            “{messages.pages.groupsVerse}”
          </p>
          <footer className="mt-1.5 text-sm font-bold text-muted-foreground">
            {messages.pages.groupsVerseReference}
          </footer>
        </blockquote>
      </PageHeader>

      {isError ? (
        <div className="container py-8">
          <ErrorState
            message={messages.errors.generic}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        </div>
      ) : isPending ? (
        <div className="container py-8">
          <LoadingBlock count={4} itemClassName="h-32" />
        </div>
      ) : (
        <GroupBrowser
          items={groups}
          profile={profile}
          neighborhood={neighborhood}
          onProfileChange={(next) => update("perfil", next)}
          onNeighborhoodChange={(next) => update("bairro", next)}
        />
      )}
    </>
  );
}
