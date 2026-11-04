import { ChevronRightIcon, HandHeartIcon } from "lucide-react";
import { Link } from "react-router";
import { photos } from "~/content/photos";
import { useMinistries } from "~/features/ministries/api";
import { MinistryList } from "~/features/ministries/components/ministry-list";
import { ministriesMessages as text } from "~/features/ministries/messages";
import { PhotoHero } from "~/shared/layout/photo-hero";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { buttonClassName } from "~/shared/ui/button-variants";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";

export function meta() {
  return pageMeta({
    title: "Ministérios",
    description:
      "Conheça os ministérios da Primeira Igreja Batista em Lagoa Santa, o que cada um faz e como falar com a liderança.",
    path: "/ministerios",
  });
}

/**
 * Ministérios (design: Ministerios, redesenhado a pedido do responsável no estilo de Quem somos): abertura com a foto e
 * quantos ministérios estão em atividade, os cartões expansíveis e o convite para servir. O número só aparece depois que o
 * catálogo carrega; o espaço dele já está reservado.
 */
export default function Ministerios() {
  const { items, isPending, isError, isFetching, refetch } = useMinistries();
  const ministries = items?.filter((item) => item.category === "MINISTERIO") ?? [];

  return (
    <>
      <PhotoHero
        eyebrow={text.eyebrow}
        title={messages.pages.ministriesTitle}
        intro={messages.pages.ministriesIntro}
        photo={photos.ministries}
        badge={ministries.length > 0 ? { value: ministries.length, label: text.countLabel } : null}
        badgeBelowPhoto
      />

      <section aria-labelledby="lista-ministerios" className="pt-10 pb-12 md:py-20">
        <div className="container flex flex-col gap-8">
          <h2
            id="lista-ministerios"
            className="m-0 text-2xl leading-tight tracking-tight md:text-3xl"
          >
            {text.listTitle}
          </h2>
          {isError ? (
            <ErrorState
              message={messages.errors.generic}
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          ) : isPending ? (
            <LoadingBlock
              count={6}
              className="grid md:grid-cols-2"
              itemClassName="h-16 rounded-2xl"
            />
          ) : ministries.length === 0 ? (
            <EmptyState title="Nenhum ministério cadastrado ainda." />
          ) : (
            <MinistryList items={ministries} />
          )}
        </div>
      </section>

      <section aria-labelledby="servir" className="container pb-16 md:pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-footer p-7 text-footer-foreground md:p-12">
          <HandHeartIcon
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-6 size-32 text-footer-border/60 md:-right-8 md:-bottom-10 md:size-56"
          />
          {/* `relative`: o texto e o botão ficam acima do ícone decorativo */}
          <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
            <div className="flex max-w-xl flex-col gap-3">
              <h2 id="servir" className="m-0 text-2xl leading-tight tracking-tight md:text-3xl">
                {messages.pages.wantToServe}
              </h2>
              <p className="m-0 text-lg text-footer-text">{messages.pages.wantToServeText}</p>
            </div>
            <Link
              to="/contato"
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                // A variante herda a cor do texto; sobre o cartão escuro, ela precisa ser a escura do botão claro
                className: "flex-none px-6 font-bold text-foreground",
              })}
            >
              {messages.pages.talkToAMinistry}
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
