import { lazy } from "react";
import { FormPage, LazyForm } from "~/shared/layout/form-page";
import { PageHeader } from "~/shared/layout/page-header";
import { photos } from "~/content/photos";
import { pageMeta } from "~/shared/seo/meta";
import { Photo } from "~/shared/ui/photo";
import { leadMessages } from "~/features/leads/messages";

const MemberForm = lazy(() => import("~/features/leads/components/member-form"));

export function meta() {
  return pageMeta({
    title: "Quero ser membro",
    description:
      "Quer ser membro da Primeira Igreja Batista em Lagoa Santa? Deixe seu contato e a liderança pastoral conversa com você.",
    path: "/quero-ser-membro",
  });
}

export default function QueroSerMembro() {
  return (
    <>
      <PageHeader
        narrow
        title={leadMessages.memberTitle}
        intro={leadMessages.memberIntro}
        media={
          <Photo
            photo={photos.supper}
            priority
            sizes="(min-width: 704px) 640px, calc(100vw - 2rem)"
            className="aspect-21/9 rounded-2xl"
            imgClassName="object-[50%_45%]"
          />
        }
      />
      <FormPage>
        <LazyForm>
          <MemberForm />
        </LazyForm>
      </FormPage>
    </>
  );
}
