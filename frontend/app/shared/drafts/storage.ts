import { DRAFT_KEY_PREFIX, userDraftPrefix } from "~/shared/lib/draft-keys";

/** Os formulários de CONTEÚDO PÚBLICO que guardam rascunho (FR-077). Dado pessoal nunca entra aqui. */
export type DraftForm = "boletim" | "mensagem" | "evento";

/** Validade do rascunho: passou disso, é descartado na leitura. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Espera depois da última digitação antes de gravar. */
export const DRAFT_DEBOUNCE_MS = 1000;

export interface StoredDraft<T> {
  value: T;
  /** Quando foi gravado (ms desde 1970). */
  savedAt: number;
}

/** `pibls:draft:<userId>:<formulário>:<id|novo>`: por usuário, por formulário e por registro. */
export function draftKey(userId: number, form: DraftForm, id: number | "novo"): string {
  return `${userDraftPrefix(userId)}${form}:${id}`;
}

interface Envelope {
  savedAt: number;
  value: unknown;
}

function isEnvelope(candidate: unknown): candidate is Envelope {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "savedAt" in candidate &&
    typeof candidate.savedAt === "number" &&
    "value" in candidate
  );
}

/**
 * Lê o rascunho. `parse` valida o formato (o `localStorage` é editável pelo usuário e pode ter vindo de uma versão antiga
 * do formulário): devolva `null` para rejeitar. Rascunho vencido, ilegível ou rejeitado é apagado e vira `null`.
 */
export function readDraft<T>(
  key: string,
  parse: (value: unknown) => T | null,
  now: number = Date.now(),
): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;

    const envelope: unknown = JSON.parse(raw);
    const value = isEnvelope(envelope) ? parse(envelope.value) : null;

    if (!isEnvelope(envelope) || value === null || now - envelope.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return { value, savedAt: envelope.savedAt };
  } catch {
    discardDraft(key);
    return null;
  }
}

/** Grava o rascunho. Devolve `false` se não deu (sem `localStorage`, cota cheia): o formulário segue sem rascunho. */
export function writeDraft(key: string, value: unknown, now: number = Date.now()): boolean {
  if (!key.startsWith(DRAFT_KEY_PREFIX)) return false;

  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: now, value } satisfies Envelope));
    return true;
  } catch {
    return false;
  }
}

/** Apaga o rascunho (ao salvar com sucesso e ao descartar). */
export function discardDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // sem localStorage não há o que apagar
  }
}
