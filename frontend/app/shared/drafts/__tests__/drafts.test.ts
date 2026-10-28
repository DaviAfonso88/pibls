import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearUserDrafts } from "~/shared/lib/draft-keys";
import {
  DRAFT_DEBOUNCE_MS,
  DRAFT_TTL_MS,
  discardDraft,
  draftKey,
  readDraft,
  useFormDraft,
  writeDraft,
} from "..";

/*
 * Rascunho local dos formulários de conteúdo (FR-077; T112): chave por usuário, formulário e registro; gravação com
 * debounce de 1 s; validade de 7 dias; apagado ao salvar, ao descartar e no logout explícito.
 */

interface Values {
  title: string;
}

const parse = (value: unknown): Values | null =>
  typeof value === "object" && value !== null && "title" in value && typeof value.title === "string"
    ? { title: value.title }
    : null;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chave", () => {
  it("é por usuário, formulário e registro", () => {
    expect(draftKey(7, "boletim", "novo")).toBe("pibls:draft:7:boletim:novo");
    expect(draftKey(7, "mensagem", 12)).toBe("pibls:draft:7:mensagem:12");
    expect(draftKey(8, "mensagem", 12)).not.toBe(draftKey(7, "mensagem", 12));
    expect(draftKey(7, "evento", 3)).not.toBe(draftKey(7, "boletim", 3));
  });

  it("um usuário nunca lê o rascunho de outro", () => {
    writeDraft(draftKey(7, "boletim", "novo"), { title: "do usuário 7" });

    expect(readDraft(draftKey(8, "boletim", "novo"), parse)).toBeNull();
    expect(readDraft(draftKey(7, "boletim", "novo"), parse)?.value).toEqual({
      title: "do usuário 7",
    });
  });
});

describe("leitura e gravação", () => {
  const key = draftKey(7, "boletim", "novo");

  it("guarda e devolve o valor com a hora da gravação", () => {
    writeDraft(key, { title: "Semana da Família" }, 1_000);

    expect(readDraft(key, parse, 2_000)).toEqual({
      value: { title: "Semana da Família" },
      savedAt: 1_000,
    });
  });

  it("vale por 7 dias: passado disso, apaga e devolve nada", () => {
    writeDraft(key, { title: "antigo" }, 0);

    expect(readDraft(key, parse, DRAFT_TTL_MS)).not.toBeNull();
    expect(readDraft(key, parse, DRAFT_TTL_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("rejeita e apaga o que não tem o formato esperado (rascunho de versão antiga ou editado à mão)", () => {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: { outro: 1 } }));
    expect(readDraft(key, parse)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();

    window.localStorage.setItem(key, "isto não é JSON");
    expect(readDraft(key, parse)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("só grava chaves do rascunho", () => {
    expect(writeDraft("outra:chave", { title: "x" })).toBe(false);
    expect(window.localStorage.getItem("outra:chave")).toBeNull();
  });

  it("segue sem rascunho quando o navegador bloqueia o armazenamento", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cota", "QuotaExceededError");
    });

    expect(writeDraft(key, { title: "x" })).toBe(false);
    setItem.mockRestore();
  });

  it("descarta", () => {
    writeDraft(key, { title: "x" });
    discardDraft(key);

    expect(window.localStorage.getItem(key)).toBeNull();
  });
});

describe("logout explícito", () => {
  it("apaga os rascunhos do usuário que saiu e só os dele", () => {
    writeDraft(draftKey(7, "boletim", "novo"), { title: "a" });
    writeDraft(draftKey(7, "mensagem", 3), { title: "b" });
    writeDraft(draftKey(8, "mensagem", 3), { title: "do outro" });
    window.localStorage.setItem("pibls:outra-coisa", "fica");

    clearUserDrafts(7);

    expect(window.localStorage.getItem(draftKey(7, "boletim", "novo"))).toBeNull();
    expect(window.localStorage.getItem(draftKey(7, "mensagem", 3))).toBeNull();
    expect(window.localStorage.getItem(draftKey(8, "mensagem", 3))).not.toBeNull();
    expect(window.localStorage.getItem("pibls:outra-coisa")).toBe("fica");
  });

  it("não confunde o usuário 7 com o 70", () => {
    writeDraft(draftKey(70, "boletim", "novo"), { title: "do 70" });

    clearUserDrafts(7);

    expect(window.localStorage.getItem(draftKey(70, "boletim", "novo"))).not.toBeNull();
  });
});

describe("useFormDraft", () => {
  const key = draftKey(7, "boletim", "novo");

  function setup(initial: Values, options: { dirty?: boolean; enabled?: boolean } = {}) {
    return renderHook(
      ({ values, dirty }: { values: Values; dirty: boolean }) =>
        useFormDraft<Values>({
          userId: 7,
          form: "boletim",
          id: "novo",
          values,
          dirty,
          parse,
          enabled: options.enabled,
        }),
      { initialProps: { values: initial, dirty: options.dirty ?? false } },
    );
  }

  it("grava 1 s depois da última digitação, e cada digitação reinicia a espera", () => {
    vi.useFakeTimers();
    const hook = setup({ title: "" });

    hook.rerender({ values: { title: "S" }, dirty: true });
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 1));
    expect(window.localStorage.getItem(key)).toBeNull();

    hook.rerender({ values: { title: "Se" }, dirty: true });
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 1));
    expect(window.localStorage.getItem(key)).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(readDraft(key, parse)?.value).toEqual({ title: "Se" });
    expect(hook.result.current.savedAt).not.toBeNull();
  });

  it("saveNow grava na hora, sem esperar a pausa, e marca a hora", () => {
    vi.useFakeTimers();
    const hook = setup({ title: "" });
    hook.rerender({ values: { title: "Sem esperar" }, dirty: true });
    expect(window.localStorage.getItem(key)).toBeNull();

    let saved = false;
    act(() => {
      saved = hook.result.current.saveNow();
    });

    expect(saved).toBe(true);
    expect(readDraft(key, parse)?.value).toEqual({ title: "Sem esperar" });
    expect(hook.result.current.savedAt).not.toBeNull();
  });

  it("saveNow não grava um formulário que ninguém mexeu, nem por cima de um rascunho à espera de resposta", () => {
    const untouched = setup({ title: "" }, { dirty: false });
    let saved = true;
    act(() => {
      saved = untouched.result.current.saveNow();
    });
    expect(saved).toBe(false);
    expect(window.localStorage.getItem(key)).toBeNull();

    writeDraft(key, { title: "guardado" });
    const pending = setup({ title: "digitei" }, { dirty: true });
    act(() => {
      saved = pending.result.current.saveNow();
    });
    expect(saved).toBe(false);
    expect(readDraft(key, parse)?.value).toEqual({ title: "guardado" });
  });

  it("não grava um formulário que ninguém mexeu", () => {
    vi.useFakeTimers();
    setup({ title: "" }, { dirty: false });

    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 3));

    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("oferece o rascunho guardado e o entrega ao restaurar", () => {
    writeDraft(key, { title: "guardado" });
    const hook = setup({ title: "" });

    expect(hook.result.current.offered?.value).toEqual({ title: "guardado" });

    let restored: Values | null = null;
    act(() => {
      restored = hook.result.current.restore();
    });

    expect(restored).toEqual({ title: "guardado" });
    expect(hook.result.current.offered).toBeNull();
  });

  it("descartar apaga o rascunho oferecido", () => {
    writeDraft(key, { title: "guardado" });
    const hook = setup({ title: "" });

    act(() => hook.result.current.discard());

    expect(hook.result.current.offered).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("não grava por cima de um rascunho que ainda espera resposta", () => {
    vi.useFakeTimers();
    writeDraft(key, { title: "guardado" });
    const hook = setup({ title: "" });

    hook.rerender({ values: { title: "digitei por cima" }, dirty: true });
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2));

    expect(readDraft(key, parse)?.value).toEqual({ title: "guardado" });
  });

  it("apagar ao salvar: limpa e não grava mais nada", () => {
    vi.useFakeTimers();
    const hook = setup({ title: "" });
    hook.rerender({ values: { title: "texto" }, dirty: true });
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS));
    expect(window.localStorage.getItem(key)).not.toBeNull();

    act(() => hook.result.current.clear());
    expect(window.localStorage.getItem(key)).toBeNull();

    hook.rerender({ values: { title: "texto depois de salvar" }, dirty: true });
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2));
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("não oferece nem grava enquanto o registro ainda carrega", () => {
    vi.useFakeTimers();
    writeDraft(key, { title: "guardado" });
    const hook = setup({ title: "" }, { enabled: false, dirty: true });

    expect(hook.result.current.offered).toBeNull();
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2));
    expect(readDraft(key, parse)?.value).toEqual({ title: "guardado" });
  });
});
