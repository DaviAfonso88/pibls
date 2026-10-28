import { useParams } from "react-router";
import { EventPage } from "~/features/events/components/public/event-page";
import { pageMeta } from "~/shared/seo/meta";

/**
 * Esta rota não é pré-renderizada: o título, a descrição, o Open Graph e o JSON-LD de cada evento saem do banco e são
 * injetados pelo Laravel em `GET /eventos/{slug}` (ADR-004). A meta daqui é só o padrão, para a navegação dentro do site.
 */
export function meta() {
  return pageMeta({
    title: "Eventos",
    description:
      "Evento da Primeira Igreja Batista em Lagoa Santa. Veja os detalhes e faça a sua inscrição.",
    path: "/eventos",
  });
}

/** Um evento, com o formulário de inscrição (design: Evento e inscrição; CAP-19, R2). */
export default function Evento() {
  const { slug } = useParams();

  return <EventPage slug={slug ?? ""} />;
}
