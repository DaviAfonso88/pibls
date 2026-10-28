import { LockIcon } from "lucide-react";
import { lazy } from "react";
import { FormPage, LazyForm } from "~/shared/layout/form-page";
import { PageHeader } from "~/shared/layout/page-header";
import { photos } from "~/content/photos";
import { pageMeta } from "~/shared/seo/meta";
import { Photo } from "~/shared/ui/photo";
import { leadMessages } from "~/features/leads/messages";

const PrayerForm = lazy(() => import("~/features/leads/components/prayer-form"));

export function meta() {
  return pageMeta({
    title: "Pedido de oração",
    description:
      "Conte pelo que você quer que a Primeira Igreja Batista em Lagoa Santa ore. O pedido pode ser anônimo e só a equipe de oração o lê.",
    path: "/pedido-de-oracao",
  });
}

export default function PedidoDeOracao() {
  return (
    <>
      <PageHeader
        narrow
        title={leadMessages.prayerTitle}
        intro={leadMessages.prayerIntro}
        media={
          <Photo
            photo={photos.prayer}
            priority
            sizes="(min-width: 704px) 640px, calc(100vw - 2rem)"
            className="aspect-21/9 rounded-2xl"
            imgClassName="object-[50%_35%]"
          />
        }
      />
      <FormPage>
        <p className="m-0 flex items-start gap-3 rounded-[14px] border border-info-border bg-info p-4 text-info-foreground">
          <LockIcon aria-hidden="true" className="mt-0.5 size-[22px] flex-none" />
          <span>{leadMessages.prayerPrivacy}</span>
        </p>
        <LazyForm>
          <PrayerForm />
        </LazyForm>
      </FormPage>
    </>
  );
}
