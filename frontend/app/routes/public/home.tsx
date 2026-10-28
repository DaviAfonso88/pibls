import { useHomeHighlights } from "~/features/content/api";
import {
  HighlightsSection,
  HomeHero,
  LiveSection,
  NoticesSection,
  PrayerSection,
  ScheduleSection,
} from "~/features/content/components/home-sections";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { usePublicSettings } from "~/shared/site/settings";
import { ErrorState } from "~/shared/ui/error-state";

export function meta() {
  return pageMeta({
    description:
      "Primeira Igreja Batista em Lagoa Santa: horários dos cultos, como chegar, ministérios, grupos e Células de CL. Venha como você está.",
    path: "/",
  });
}

// O <main> é do layout público (routes/public/layout.tsx); a página só preenche o conteúdo
export default function Home() {
  const { settings, isPending, isError, isFetching, refetch } = usePublicSettings();
  const { highlights } = useHomeHighlights();

  return (
    <>
      <HomeHero />
      {isError ? (
        <div className="container py-10">
          <ErrorState
            message={messages.errors.generic}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        </div>
      ) : (
        <>
          <NoticesSection settings={settings} />
          <ScheduleSection schedule={settings?.schedule} isPending={isPending} />
          <LiveSection settings={settings} />
          <PrayerSection />
          <HighlightsSection
            highlights={highlights}
            eventsEnabled={settings?.features.events ?? false}
          />
        </>
      )}
    </>
  );
}
