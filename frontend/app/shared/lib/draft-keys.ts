/**
 * As chaves do rascunho local (FR-077): `pibls:draft:<userId>:<formulário>:<id|novo>`.
 *
 * Este arquivo só sabe APAGAR rascunhos, de propósito: o logout (em `features/access`) precisa limpá-los, mas gravar e ler
 * rascunho é exclusivo de `features/content` e `features/events` (regra de ESLint sobre `~/shared/drafts`). Quem grava
 * (`~/shared/drafts`) usa o mesmo prefixo daqui.
 */
export const DRAFT_KEY_PREFIX = "pibls:draft:";

/** Prefixo dos rascunhos de um usuário: um usuário nunca vê nem apaga o rascunho de outro. */
export function userDraftPrefix(userId: number): string {
  return `${DRAFT_KEY_PREFIX}${userId}:`;
}

/** Logout explícito: apaga todos os rascunhos deste usuário neste navegador. Sem `localStorage`, não faz nada. */
export function clearUserDrafts(userId: number): void {
  try {
    const prefix = userDraftPrefix(userId);
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // localStorage bloqueado (navegação privada, política do navegador): não há rascunho para apagar
  }
}
