import { MessageCircleIcon } from "lucide-react";
import { lazy } from "react";
import { useSearchParams } from "react-router";
import { useMinistries } from "~/features/ministries/api";
import { FormPage, LazyForm } from "~/shared/layout/form-page";
import { PageHeader } from "~/shared/layout/page-header";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { whatsappUrl } from "~/shared/site/links";
import { usePublicSettings } from "~/shared/site/settings";
import { buttonClassName } from "~/shared/ui/button-variants";
import { leadMessages } from "~/features/leads/messages";

const ContactForm = lazy(() => import("~/features/leads/components/contact-form"));

export function meta() {
  return pageMeta({
    title: "Contato",
    description:
      "Fale com a secretaria da Primeira Igreja Batista em Lagoa Santa ou escreva direto para um ministério.",
    path: "/contato",
  });
}

export default function Contato() {
  const [params] = useSearchParams();
  const { items } = useMinistries();
  const { settings } = usePublicSettings();
  const whatsapp = whatsappUrl(settings?.whatsapp);

  const ministries = (items ?? [])
    .filter((item) => item.category === "MINISTERIO")
    .map(({ id, name }) => ({ id, name }));
  // `?ministerio=<id>` ("Falar com este ministério") só vale para um ministério ativo do catálogo
  const requested = Number(params.get("ministerio"));
  const initialMinistryId = ministries.some((ministry) => ministry.id === requested)
    ? requested
    : null;

  return (
    <>
      <PageHeader narrow title={leadMessages.contactTitle} intro={leadMessages.contactIntro} />
      <FormPage>
        {whatsapp ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border px-5 py-4">
            <span className="flex flex-col">
              <span className="font-bold">{leadMessages.preferWhatsapp}</span>
              <span className="text-[15px] text-muted-foreground">
                {leadMessages.preferWhatsappHint}
              </span>
            </span>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({
                variant: "whatsapp",
                size: "lg",
                className: "px-[18px] font-bold",
              })}
            >
              <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
              {messages.pages.callWhatsapp}
              <span className="sr-only"> {messages.forms.opensInNewTab}</span>
            </a>
          </div>
        ) : null}
        <LazyForm>
          <ContactForm
            key={initialMinistryId ?? "geral"}
            ministries={ministries}
            initialMinistryId={initialMinistryId}
          />
        </LazyForm>
      </FormPage>
    </>
  );
}
