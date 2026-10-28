/**
 * Rascunho local dos formulários de conteúdo público do painel (FR-077, plan.md → Pontos de integração 1).
 *
 * SÓ `features/content` e `features/events` podem importar daqui (regra de ESLint `import/no-restricted-paths`). Nenhum
 * formulário com dado pessoal (atendimento, anotações, inscrições, PIX) guarda nada no navegador.
 */
export { useFormDraft, type FormDraft, type UseFormDraftOptions } from "./use-form-draft";
export {
  DRAFT_DEBOUNCE_MS,
  DRAFT_TTL_MS,
  discardDraft,
  draftKey,
  readDraft,
  writeDraft,
  type DraftForm,
  type StoredDraft,
} from "./storage";
