import { lazy } from "react";
import { useSearchParams } from "react-router";
import { groupsAndCells } from "~/features/ministries/profiles";
import { useMinistries } from "~/features/ministries/api";
import { FormPage, LazyForm } from "~/shared/layout/form-page";
import { PageHeader } from "~/shared/layout/page-header";
import { photos } from "~/content/photos";
import { pageMeta } from "~/shared/seo/meta";
import { Photo } from "~/shared/ui/photo";
import { leadMessages } from "~/features/leads/messages";

const VisitorForm = lazy(() => import("~/features/leads/components/visitor-form"));

export function meta() {
  return pageMeta({
    title: "Sou visitante",
    description:
      "Ficha de Visitante da Primeira Igreja Batista em Lagoa Santa: deixe seu contato e a equipe de acolhimento fala com você.",
    path: "/sou-visitante",
  });
}

export default function SouVisitante() {
  const [params] = useSearchParams();
  const { items } = useMinistries();
  const groups = groupsAndCells(items ?? []).map(({ id, name }) => ({ id, name }));

  // `?grupo=<id>` ("Quero participar") só vale se o grupo existir e estiver ativo (o catálogo público só traz os ativos)
  const requested = Number(params.get("grupo"));
  const initialGroupId = groups.some((group) => group.id === requested) ? requested : null;

  return (
    <>
      <PageHeader
        narrow
        eyebrow={leadMessages.visitorEyebrow}
        title={leadMessages.visitorTitle}
        intro={leadMessages.visitorIntro}
        media={
          <Photo
            photo={photos.visitor}
            priority
            sizes="(min-width: 704px) 640px, calc(100vw - 2rem)"
            className="aspect-21/9 rounded-2xl"
            imgClassName="object-[20%_30%]"
          />
        }
      />
      <FormPage>
        {/* A chave refaz o formulário se o catálogo chegar depois: o grupo da URL entra preenchido */}
        <LazyForm>
          <VisitorForm
            key={initialGroupId ?? "sem-grupo"}
            groups={groups}
            initialGroupId={initialGroupId}
          />
        </LazyForm>
      </FormPage>
    </>
  );
}
