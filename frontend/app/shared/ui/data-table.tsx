import type { ReactNode } from "react";
import { messages } from "~/shared/messages";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "./card";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

export interface DataTableColumn<T> {
  id: string;
  /** Título da coluna e rótulo do campo no cartão. */
  header: string;
  cell: (row: T) => ReactNode;
  /** Números e ações ficam à direita na tabela. */
  align?: "start" | "end";
  /** Não aparece na visão em cartões (ex.: coluna só de ações redundantes). */
  hideInCard?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  /** Nome da lista para leitores de tela; não aparece na tela. */
  caption: string;
  /** A primeira coluna é o título do cartão no celular. */
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string | number;
  isLoading?: boolean;
  /** Substitui o `EmptyState` padrão quando não há linhas. */
  empty?: ReactNode;
  skeletonRows?: number;
  /** Classes de uma linha (ex.: o destaque dos contatos parados), na tabela e no cartão do celular. */
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}

/**
 * Tabela que vira lista de cartões abaixo de `md` (painel no celular): a tabela com colunas não cabe em 390 px e a
 * rolagem horizontal esconde dados. As duas visões saem do mesmo `columns`; o CSS mostra uma de cada vez.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  isLoading = false,
  empty,
  skeletonRows = 5,
  rowClassName,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div role="status" className={cn("flex flex-col gap-2", className)}>
        <span className="sr-only">{messages.a11y.loadingContent}</span>
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className={className}>{empty ?? <EmptyState />}</div>;
  }

  const [titleColumn, ...detailColumns] = columns;
  const cardColumns = detailColumns.filter((column) => !column.hideInCard);

  return (
    <div className={className}>
      <div className="hidden md:block">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={cn(column.align === "end" && "text-right")}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)} className={rowClassName?.(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(column.align === "end" && "text-right", column.className)}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label={caption} className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={getRowId(row)}>
            <Card className={rowClassName?.(row)}>
              <CardContent className="flex flex-col gap-3">
                {titleColumn ? (
                  <div className="font-heading text-lg font-extrabold">{titleColumn.cell(row)}</div>
                ) : null}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  {cardColumns.map((column) => (
                    <div key={column.id} className="contents">
                      <dt className="text-muted-foreground">{column.header}</dt>
                      <dd className="min-w-0 break-words">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
