import { useCallback, useEffect, useRef, useState } from "react";
import {
  DRAFT_DEBOUNCE_MS,
  discardDraft,
  draftKey,
  readDraft,
  writeDraft,
  type DraftForm,
  type StoredDraft,
} from "./storage";

export interface UseFormDraftOptions<T> {
  userId: number;
  form: DraftForm;
  /** O registro aberto, ou `"novo"` no cadastro. */
  id: number | "novo";
  /** Os valores atuais do formulário. Só JSON: arquivos (PDF, banner) nunca vão para o rascunho. */
  values: T;
  /** Só grava depois que a pessoa mexeu: um formulário intocado não vira rascunho. */
  dirty: boolean;
  /** Valida o formato do que veio do navegador; `null` rejeita (rascunho de uma versão antiga do formulário). */
  parse: (value: unknown) => T | null;
  /** `false` enquanto o registro ainda carrega: não oferece nem grava nada antes da hora. */
  enabled?: boolean;
}

export interface FormDraft<T> {
  /** Rascunho encontrado ao abrir o formulário, à espera de "Restaurar" ou "Descartar". */
  offered: StoredDraft<T> | null;
  /** Aceita o rascunho oferecido e devolve os valores para preencher o formulário. */
  restore: () => T | null;
  /** Recusa o rascunho oferecido e o apaga. */
  discard: () => void;
  /** Apaga o rascunho e para de gravar: chame depois de salvar com sucesso (FR-077). */
  clear: () => void;
  /** Quando o rascunho foi gravado pela última vez nesta tela, para o aviso "guardado neste navegador às 14h32". */
  savedAt: number | null;
  /**
   * Grava já, sem esperar a pausa da digitação ("Salvar rascunho"). `false` = não gravou: nada foi alterado, há um
   * rascunho antigo esperando "Restaurar" ou "Descartar", ou o navegador recusou.
   */
  saveNow: () => boolean;
}

/**
 * Rascunho local de um formulário de conteúdo público (FR-077): guarda no `localStorage`, 1 s depois da última
 * digitação, e oferece de volta quando o formulário abre de novo (por exemplo, depois de a sessão expirar e a pessoa
 * entrar outra vez). Apagado ao salvar (`clear`), ao descartar e no logout explícito.
 *
 * Só para formulários de conteúdo público. Atendimento, anotações, inscrições e PIX nunca usam este módulo.
 */
export function useFormDraft<T>({
  userId,
  form,
  id,
  values,
  dirty,
  parse,
  enabled = true,
}: UseFormDraftOptions<T>): FormDraft<T> {
  const key = draftKey(userId, form, id);
  const [offered, setOffered] = useState<StoredDraft<T> | null>(() =>
    enabled && typeof window !== "undefined" ? readDraft(key, parse) : null,
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const stopped = useRef(false);
  const serialized = JSON.stringify(values);

  // Se o registro só terminou de carregar agora, procura o rascunho nesse momento
  const offeredFor = useRef<string | null>(enabled ? key : null);
  useEffect(() => {
    if (!enabled || offeredFor.current === key) return;
    offeredFor.current = key;
    setOffered(readDraft(key, parse));
  }, [enabled, key, parse]);

  useEffect(() => {
    // Com um rascunho oferecido e ainda não decidido, gravar por cima o perderia
    if (!enabled || !dirty || offered !== null || stopped.current) return undefined;

    const timer = window.setTimeout(() => {
      if (stopped.current) return;
      if (writeDraft(key, JSON.parse(serialized))) setSavedAt(Date.now());
    }, DRAFT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, dirty, offered, key, serialized]);

  const saveNow = useCallback((): boolean => {
    if (!enabled || !dirty || offered !== null || stopped.current) return false;
    if (!writeDraft(key, JSON.parse(serialized))) return false;

    setSavedAt(Date.now());
    return true;
  }, [enabled, dirty, offered, key, serialized]);

  const restore = useCallback((): T | null => {
    const value = offered?.value ?? null;
    setOffered(null);
    return value;
  }, [offered]);

  const discard = useCallback((): void => {
    discardDraft(key);
    setOffered(null);
  }, [key]);

  const clear = useCallback((): void => {
    stopped.current = true;
    discardDraft(key);
    setOffered(null);
    setSavedAt(null);
  }, [key]);

  return { offered, restore, discard, clear, savedAt, saveNow };
}
