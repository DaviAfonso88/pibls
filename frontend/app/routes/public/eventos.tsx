import { EventList } from "~/features/events/components/public/event-list";
import { publicEventMessages as text } from "~/features/events/public-messages";
import { PageHeader } from "~/shared/layout/page-header";
import { pageMeta } from "~/shared/seo/meta";
import { usePublicSettings } from "~/shared/site/settings";
import NaoEncontrado from "./not-found";

export function meta() {
  return pageMeta({
    title: text.title,
    description:
      "Retiros, encontros e cursos dos ministérios da Primeira Igreja Batista em Lagoa Santa. Veja os próximos eventos e faça a sua inscrição.",
    path: "/eventos",
  });
}

/**
 * Eventos (design: Eventos; CAP-18, R2): os próximos e os anteriores. Com `features.events` desligado (R1) a página não
 * existe: mostra o "não encontrado" do site, como qualquer endereço que não há (R-25).
 */
export default function Eventos() {
  const { settings } = usePublicSettings();

  if (settings && !settings.features.events) return <NaoEncontrado />;

  return (
    <>
      <PageHeader title={text.title} intro={text.intro} />
      <EventList unavailable={<NaoEncontrado />} />
    </>
  );
}
