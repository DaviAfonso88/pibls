import { PostList } from "~/features/content/components/post-list";
import { publicContentMessages as text } from "~/features/content/messages";
import { PageHeader } from "~/shared/layout/page-header";
import { pageMeta } from "~/shared/seo/meta";

export function meta() {
  return pageMeta({
    title: "Palavra Viva",
    description:
      "Mensagens pastorais da Primeira Igreja Batista em Lagoa Santa para ler durante a semana, algumas com vídeo.",
    path: "/palavra-viva",
  });
}

/** Palavra Viva (design: PalavraViva; CAP-03): a mensagem mais recente em destaque e as anteriores. */
export default function PalavraViva() {
  return (
    <>
      <PageHeader title={text.postsTitle} intro={text.postsIntro} />
      <PostList />
    </>
  );
}
