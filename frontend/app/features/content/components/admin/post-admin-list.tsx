import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { formatDateTime } from "~/shared/format";
import { buttonClassName } from "~/shared/ui/button-variants";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { EmptyState } from "~/shared/ui/empty-state";
import { ErrorState } from "~/shared/ui/error-state";
import { StatusBadge } from "~/shared/ui/status-badge";
import { adminPostsQuery, type AdminPost } from "../../admin-api";
import { contentAdminMessages } from "../../admin-messages";
import { PageLinks } from "./form-parts";

const { posts: text, list: listText } = contentAdminMessages;

function pageFromParams(params: URLSearchParams): number {
  const page = Number(params.get("pagina"));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * A lista de mensagens da Palavra Viva no painel (design: AdminPalavraViva; CAP-03): todas, inclusive as agendadas, da
 * mais recente à mais antiga. A permissão (`mensagens.write`) é do guard da rota; a API recusa de qualquer jeito (BR-076).
 */
export function PostAdminList() {
  const [params] = useSearchParams();
  const page = pageFromParams(params);
  const query = useQuery(adminPostsQuery(page));
  const hrefFor = (target: number) => `/admin/palavra-viva${target > 1 ? `?pagina=${target}` : ""}`;

  const columns: DataTableColumn<AdminPost>[] = [
    {
      id: "title",
      header: text.columns.title,
      cell: (post) => (
        <Link
          to={`/admin/palavra-viva/${post.id}`}
          className="flex min-h-12 items-center font-bold text-foreground"
        >
          {post.title}
        </Link>
      ),
    },
    {
      id: "date",
      header: text.columns.date,
      className: "whitespace-nowrap",
      cell: (post) => formatDateTime(post.published_at),
    },
    {
      id: "status",
      header: text.columns.status,
      cell: (post) => (
        <StatusBadge tone={post.status === "PUBLICADO" ? "success" : "info"}>
          {post.status === "PUBLICADO" ? listText.published : listText.scheduled}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: listText.actions,
      align: "end",
      hideInCard: true,
      cell: (post) => (
        <Link
          to={`/admin/palavra-viva/${post.id}`}
          aria-label={text.editPost(post.title)}
          className="inline-flex min-h-12 items-center px-2 font-bold"
        >
          {text.edit}
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <title>{`${text.title} — Painel PIBLS`}</title>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-tight">
            {text.title}
          </h1>
          <p className="m-0 text-muted-foreground">{text.intro}</p>
        </div>
        <Link
          to="/admin/palavra-viva/nova"
          className={buttonClassName({ size: "lg", className: "gap-2 px-4.5 font-bold" })}
        >
          <PlusIcon aria-hidden="true" className="size-[18px]" />
          {text.newPost}
        </Link>
      </header>

      <section className="overflow-hidden rounded-[14px] border border-border bg-card">
        {query.isError ? (
          <div className="p-5">
            <ErrorState
              message={text.loadError}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          </div>
        ) : (
          <>
            <DataTable
              caption={text.title}
              columns={columns}
              rows={query.data?.data ?? []}
              getRowId={(post) => post.id}
              isLoading={query.isPending}
              empty={<EmptyState title={text.empty} description={text.emptyHint} />}
            />
            {query.data ? (
              <PageLinks
                page={query.data.meta.page}
                lastPage={query.data.meta.last_page}
                total={query.data.meta.total}
                perPage={query.data.meta.per_page}
                hrefFor={hrefFor}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
