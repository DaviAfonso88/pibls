import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatDateTime, formatDate } from "~/shared/format";
import type { AdminEvent } from "./admin-api";
import { formatWhen } from "./event-presentation";
import { registrationColumns } from "./registration-columns";
import type { AdminRegistration } from "./registrations-api";

/**
 * O PDF das inscrições (FR-061, SC-014), gerado no navegador a partir do mesmo JSON da lista, para não depender do
 * `memory_limit` nem do tempo de execução da hospedagem (ADR-015): A4 paisagem, cabeçalho com título, data e local do
 * evento e a data de geração, e as mesmas colunas do CSV. Sem inscrições, o arquivo traz só o cabeçalho da tabela.
 *
 * O `pdfmake` e as fontes dele (cerca de 1 MB) só entram quando a pessoa clica em "Exportar PDF": o `import()` está
 * em `renderRegistrationsPdf`, e nada daqui carrega a biblioteca antes disso.
 */

export type PdfEvent = Pick<
  AdminEvent,
  "title" | "starts_at" | "ends_at" | "location" | "has_minors" | "form_schema" | "max_spots"
>;

const HEADER_FILL = "#EAF3F5";
const RULE_COLOR = "#A8A29E";

/** `inscritos-<slug>-AAAAMMDD.pdf`, com a data de hoje em São Paulo (a mesma regra do CSV). */
export function pdfFilename(slug: string, now: Date): string {
  const [day, month, year] = formatDate(now).split("/");
  return `inscritos-${slug}-${year}${month}${day}.pdf`;
}

/** Quantas vagas estão preenchidas, na frase do cabeçalho. */
function spotsLine(filled: number, total: number | null | undefined): string {
  return total === null || total === undefined
    ? `${filled} ${filled === 1 ? "inscrito" : "inscritos"}`
    : `${filled} de ${total} vagas preenchidas`;
}

/** A definição do documento, sem tocar na biblioteca: é o que os testes conferem. */
export function buildRegistrationsDocument(
  event: PdfEvent,
  registrations: readonly AdminRegistration[],
  now: Date,
): TDocumentDefinitions {
  const columns = registrationColumns(event);

  const header: TableCell[] = columns.map((column) => ({
    text: column.header,
    bold: true,
    fillColor: HEADER_FILL,
  }));
  const body: TableCell[][] = [
    header,
    ...registrations.map((registration) =>
      columns.map((column): TableCell => ({ text: column.text(registration) })),
    ),
  ];

  const intro: Content[] = [
    { text: event.title, style: "title" },
    { text: formatWhen(event.starts_at, event.ends_at), style: "meta" },
    { text: `Local: ${event.location}`, style: "meta" },
    {
      text: `${spotsLine(registrations.length, event.max_spots)} · Gerado em ${formatDateTime(now)}`,
      style: "meta",
      margin: [0, 0, 0, 10],
    },
  ];

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 32, 28, 40],
    info: { title: `Inscritos — ${event.title}`, subject: "Inscrições do evento" },
    defaultStyle: { fontSize: 9, lineHeight: 1.15 },
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      meta: { fontSize: 10, margin: [0, 0, 0, 2] },
    },
    content: [
      ...intro,
      {
        table: {
          headerRows: 1,
          // Nome, e-mail e respostas dividem o espaço; data e telefones ficam do tamanho do texto
          widths: columns.map((column) =>
            ["created_at", "phone", "guardian_phone"].includes(column.id) ? "auto" : "*",
          ),
          body,
        },
        layout: {
          hLineColor: () => RULE_COLOR,
          vLineWidth: () => 0,
          hLineWidth: (index: number, node: { table: { body: unknown[] } }) =>
            index === 0 || index === node.table.body.length ? 0.8 : 0.4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
    ],
    footer: (currentPage: number, pageCount: number): Content => ({
      text: `Página ${currentPage} de ${pageCount}`,
      alignment: "right",
      fontSize: 8,
      margin: [28, 12, 28, 0],
    }),
  };
}

/** O que usamos do `pdfmake`: criar o documento e pedir o arquivo. */
interface PdfMakeApi {
  createPdf(
    definition: TDocumentDefinitions,
    tableLayouts?: undefined,
    fonts?: undefined,
    vfs?: Record<string, string>,
  ): { getBlob(callback: (blob: Blob) => void): void };
}

/**
 * O `pdfmake` e as fontes são módulos UMD: dependendo do empacotador, o conteúdo vem em `default` ou direto no módulo. O
 * `as` é a única forma de ler as duas formas; quem chama diz o tipo que o pacote promete (os `.d.ts` do pacote não
 * descrevem o `default`).
 */
function unwrapDefault<T extends object>(module: unknown): T {
  const wrapped = module as { default?: T };
  return wrapped.default ?? (module as T);
}

/**
 * Gera o PDF e o devolve como arquivo para baixar. As fontes (Roboto, com acentos) vão no argumento do `createPdf`:
 * assim a geração não depende de variável global da biblioteca.
 */
export async function renderRegistrationsPdf(
  event: PdfEvent,
  registrations: readonly AdminRegistration[],
  now: Date = new Date(),
): Promise<Blob> {
  const [pdfModule, fontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = unwrapDefault<PdfMakeApi>(pdfModule);
  const vfs = unwrapDefault<Record<string, string>>(fontsModule);

  const definition = buildRegistrationsDocument(event, registrations, now);

  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(definition, undefined, undefined, vfs).getBlob(resolve);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Falha ao gerar o PDF."));
    }
  });
}
