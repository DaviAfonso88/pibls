import { useMinistries } from "~/features/ministries/api";
import { MinistryList } from "~/features/ministries/components/ministry-list";
import { PageHeader } from "~/shared/layout/page-header";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { buttonClassName } from "~/shared/ui/button-variants";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { Link } from "react-router";

export function meta() {
  return pageMeta({
    title: "Ministérios",
    description:
      "Conheça os ministérios da Primeira Igreja Batista em Lagoa Santa, o que cada um faz e como falar com a liderança.",
    path: "/ministerios",
  });
}

export default function Ministerios() {
  const { items, isPending, isError, isFetching, refetch } = useMinistries();
  const ministries = items?.filter((item) => item.category === "MINISTERIO") ?? [];

  return (
    <>
      <PageHeader title={messages.pages.ministriesTitle} intro={messages.pages.ministriesIntro} />

      <section aria-label={messages.pages.ministriesList} className="container py-8">
        {isError ? (
          <ErrorState
            message={messages.errors.generic}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : isPending ? (
          <LoadingBlock className="mx-auto max-w-3xl" count={6} />
        ) : ministries.length === 0 ? (
          <EmptyState title="Nenhum ministério cadastrado ainda." />
        ) : (
          <MinistryList items={ministries} />
        )}
      </section>

      <section aria-labelledby="servir" className="container pb-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-2.5 rounded-2xl border border-info-border bg-info p-6 text-info-foreground">
          <h2 id="servir" className="m-0 text-[22px] leading-tight text-info-foreground">
            {messages.pages.wantToServe}
          </h2>
          <p className="m-0">{messages.pages.wantToServeText}</p>
          <Link
            to="/contato"
            className={buttonClassName({ size: "lg", className: "mt-1 self-start px-5 font-bold" })}
          >
            {messages.pages.talkToAMinistry}
          </Link>
        </div>
      </section>
    </>
  );
}
