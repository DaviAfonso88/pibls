import { BulletinList } from "~/features/content/components/bulletin-list";
import { publicContentMessages as text } from "~/features/content/messages";
import { PageHeader } from "~/shared/layout/page-header";
import { pageMeta } from "~/shared/seo/meta";

export function meta() {
  return pageMeta({
    title: "Boletins",
    description:
      "O boletim de cada domingo da Primeira Igreja Batista em Lagoa Santa, com avisos, escalas e a programação da semana. Leia na tela ou baixe o PDF.",
    path: "/boletins",
  });
}

/** Boletins (design: Boletins; CAP-02): a lista dos publicados, com filtro por ano e mês. */
export default function Boletins() {
  return (
    <>
      <PageHeader title={text.bulletinsTitle} intro={text.bulletinsIntro} />
      <BulletinList />
    </>
  );
}
