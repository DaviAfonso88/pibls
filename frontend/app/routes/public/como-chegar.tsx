import { directionsMessages } from "~/features/content/messages";
import { ExternalLinkIcon, NavigationIcon } from "lucide-react";
import { Link } from "react-router";
import { formatCep, formatScheduleTime } from "~/shared/format";
import { PageHeader } from "~/shared/layout/page-header";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { addressLines, safeHttpUrl } from "~/shared/site/links";
import { groupByDay } from "~/shared/site/schedule";
import { usePublicSettings } from "~/shared/site/settings";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { MapFacade, isAllowedMapEmbed } from "~/shared/ui/map-facade";
import { MapPinIcon } from "lucide-react";

export function meta() {
  return pageMeta({
    title: "Como chegar",
    description:
      "Endereço da Primeira Igreja Batista em Lagoa Santa, mapa e rota no Google Maps ou no Waze.",
    path: "/como-chegar",
  });
}

const card =
  "flex min-w-[min(100%,21rem)] flex-1 flex-col gap-4 rounded-2xl border border-border p-6";

export default function ComoChegar() {
  const { settings, isPending, isError, isFetching, refetch } = usePublicSettings();

  const lines = addressLines(settings?.address);
  const zip = settings?.address?.zip ? formatCep(settings.address.zip) : null;
  const googleMaps = safeHttpUrl(settings?.map_links?.google_maps_url);
  const waze = safeHttpUrl(settings?.map_links?.waze_url);
  const embed = settings?.map_links?.embed_url;
  const days = groupByDay(settings?.schedule ?? []);

  return (
    <>
      <PageHeader
        title={directionsMessages.directionsTitle}
        intro={directionsMessages.directionsIntro}
      />

      <div className="container flex flex-wrap items-start gap-4 pt-8 pb-12">
        {isError ? (
          <ErrorState
            className="flex-1"
            message={messages.errors.generic}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : isPending ? (
          <LoadingBlock className="flex-1" count={2} itemClassName="h-40" />
        ) : (
          <>
            <section aria-labelledby="endereco" className={card}>
              <div className="flex items-start gap-3">
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-info text-info-foreground">
                  <MapPinIcon aria-hidden="true" className="size-[22px]" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <h2
                    id="endereco"
                    className="m-0 text-sm font-bold tracking-wider text-muted-foreground uppercase"
                  >
                    {directionsMessages.address}
                  </h2>
                  {lines.map((line) => (
                    <p key={line} className="m-0 text-[19px] font-bold">
                      {line}
                    </p>
                  ))}
                  {zip ? <p className="m-0 text-muted-foreground">CEP {zip}</p> : null}
                </div>
              </div>
              {googleMaps || waze ? (
                <div className="flex flex-wrap gap-3">
                  {googleMaps ? (
                    <a
                      href={googleMaps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClassName({
                        size: "lg",
                        className: "min-w-48 flex-1 px-4 font-bold",
                      })}
                    >
                      <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
                      {directionsMessages.openGoogleMaps}
                      <span className="sr-only"> {messages.forms.opensInNewTab}</span>
                    </a>
                  ) : null}
                  {waze ? (
                    <a
                      href={waze}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClassName({
                        variant: "outline",
                        size: "lg",
                        className: "min-w-48 flex-1 px-4 font-bold",
                      })}
                    >
                      <NavigationIcon data-icon="inline-start" aria-hidden="true" />
                      {directionsMessages.openWaze}
                      <span className="sr-only"> {messages.forms.opensInNewTab}</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>

            {isAllowedMapEmbed(embed) ? (
              <MapFacade embedUrl={embed} className="min-h-80 basis-full sm:min-h-[28rem]" />
            ) : null}

            {days.length > 0 ? (
              <section aria-labelledby="quando" className={card}>
                <h2 id="quando" className="m-0 text-xl leading-tight">
                  {directionsMessages.whenToCome}
                </h2>
                {days.map((day) => (
                  <p key={day.label} className="m-0">
                    <strong>{day.label}</strong> ·{" "}
                    {day.items
                      .map((item) => `${item.activity} às ${formatScheduleTime(item.time)}`)
                      .join("; ")}
                  </p>
                ))}
                <Link
                  to="/#horarios"
                  className="inline-flex min-h-11 items-center self-start font-bold text-primary underline-offset-4 hover:underline"
                >
                  {messages.site.allSchedules}
                </Link>
              </section>
            ) : null}

            <section
              aria-labelledby="primeira-visita"
              className="flex min-w-[min(100%,21rem)] flex-1 flex-col gap-2.5 rounded-2xl border border-info-border bg-info p-6 text-info-foreground"
            >
              <h2 id="primeira-visita" className="m-0 text-xl leading-tight text-info-foreground">
                {directionsMessages.firstVisit}
              </h2>
              <p className="m-0">{directionsMessages.firstVisitText}</p>
              <Link
                to="/sou-visitante"
                className={buttonClassName({
                  size: "lg",
                  className: "mt-1 self-start px-5 font-bold",
                })}
              >
                {directionsMessages.fillVisitorForm}
              </Link>
            </section>
          </>
        )}
      </div>
    </>
  );
}
