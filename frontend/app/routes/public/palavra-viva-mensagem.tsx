import { useParams } from "react-router";
import { PostArticle } from "~/features/content/components/post-article";
import { pageMeta } from "~/shared/seo/meta";

/**
 * Esta rota não é pré-renderizada: o título, a descrição e o Open Graph de cada mensagem saem do banco e são injetados
 * pelo Laravel em `GET /palavra-viva/{slug}` (ADR-004). A meta daqui é só o padrão, para a navegação dentro do site.
 */
export function meta() {
  return pageMeta({
    title: "Palavra Viva",
    description: "Mensagem da Palavra Viva, da Primeira Igreja Batista em Lagoa Santa.",
    path: "/palavra-viva",
  });
}

/** Uma mensagem da Palavra Viva (design: Mensagem; CAP-03). */
export default function MensagemPalavraViva() {
  const { slug } = useParams();

  return <PostArticle slug={slug ?? ""} />;
}
