import { ContribuaContent } from "~/features/content/components/contribua-content";
import { contribuaMessages as text } from "~/features/content/messages";
import { PageHeader } from "~/shared/layout/page-header";
import { pageMeta } from "~/shared/seo/meta";

export function meta() {
  return pageMeta({
    title: "Contribua",
    description:
      "Dízimos, ofertas e a campanha Estamos Construindo da Primeira Igreja Batista em Lagoa Santa, pela chave PIX da igreja: copie a chave ou escaneie o QR Code.",
    path: "/contribua",
  });
}

/** Contribua (design: Contribua; CAP-04): a chave PIX, o QR Code, o botão de copiar e como contribuir. */
export default function Contribua() {
  return (
    <>
      <PageHeader title={text.title} intro={text.intro} />
      <ContribuaContent />
    </>
  );
}
