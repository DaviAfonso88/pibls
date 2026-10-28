import * as z from "zod";
import { isValidCnpj } from "~/shared/format";
import { ruleMessages } from "~/shared/rule-messages";
import { contentAdminMessages as text } from "./admin-messages";
import { pixAdminMessages } from "./pix-messages";
import { SLUG_PATTERN } from "./slug";
import { youtubeVideoId } from "./youtube";

/**
 * Esquemas dos formulários de conteúdo do painel (boletim e Palavra Viva). O servidor é a validação final e devolve os
 * mesmos limites (contracts/openapi.yaml); aqui a tela avisa antes de enviar.
 */

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Quando publicar: agora, ou agendado para um horário de Brasília no futuro (BR-042). */
const publication = {
  when: z.enum(["now", "schedule"]),
  scheduled_at: z.string(),
};

function checkSchedule(
  values: { when: "now" | "schedule"; scheduled_at: string },
  context: z.RefinementCtx,
): void {
  if (values.when !== "schedule") return;

  if (!LOCAL_DATE_TIME.test(values.scheduled_at)) {
    context.addIssue({ code: "custom", path: ["scheduled_at"], message: text.schedule.required });
    return;
  }

  // O valor do campo é a hora de Brasília (UTC-3, sem horário de verão); só precisa estar no futuro
  const at = new Date(`${values.scheduled_at}:00-03:00`).getTime();
  if (Number.isNaN(at) || at <= Date.now()) {
    context.addIssue({ code: "custom", path: ["scheduled_at"], message: text.schedule.future });
  }
}

export const bulletinSchema = z
  .object({
    edition_number: z
      .string()
      .trim()
      .regex(/^\d{1,6}$/, text.bulletin.editionInvalid)
      .refine((value) => Number(value) >= 1, text.bulletin.editionInvalid),
    reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, text.bulletin.referenceRequired),
    title: z.string().trim().min(3, text.bulletin.titleLength).max(150, text.bulletin.titleLength),
    summary_text: z.string().max(300, text.bulletin.summaryLength),
    ...publication,
  })
  .superRefine(checkSchedule);
export type BulletinValues = z.infer<typeof bulletinSchema>;

export const postSchema = z
  .object({
    title: z.string().trim().min(3, text.post.titleLength).max(150, text.post.titleLength),
    slug: z
      .string()
      .min(1, text.post.slugRequired)
      .max(160, text.post.slugInvalid)
      .regex(SLUG_PATTERN, text.post.slugInvalid),
    body: z.string().max(50_000, text.post.bodyLength),
    author_display: z.string().trim().max(120, text.post.authorLength),
    youtube_url: z
      .string()
      .trim()
      .refine((value) => value === "" || youtubeVideoId(value) !== null, ruleMessages.youtube),
    ...publication,
  })
  .superRefine(checkSchedule);
export type PostValues = z.infer<typeof postSchema>;

/**
 * O formulário do PIX (CAP-18). A chave é um CNPJ (BR-061) e o Copia e Cola é opcional (o CRC16 é conferido no servidor,
 * BR-062). A senha não entra aqui: é pedida num diálogo, na hora de confirmar (BR-060).
 */
export const pixSchema = z.object({
  pix_key: z
    .string()
    .trim()
    .refine((value) => isValidCnpj(value), pixAdminMessages.keyInvalid),
  beneficiary_name: z
    .string()
    .trim()
    .min(1, pixAdminMessages.beneficiaryRequired)
    .max(120, pixAdminMessages.beneficiaryLength),
  copy_paste_code: z.string().trim().max(512, pixAdminMessages.codeLength),
});
export type PixValues = z.infer<typeof pixSchema>;
