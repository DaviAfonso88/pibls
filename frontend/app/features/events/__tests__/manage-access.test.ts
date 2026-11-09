import { describe, expect, it } from "vitest";
import { canCreateEvent, canManageEvent } from "../manage-access";

/*
 * O espelho da `EventPolicy::manage` usado pela interface (ADR-027): decide se aparecem "Editar", "Novo evento" e
 * "Cancelar inscrição". Quem decide de verdade é o servidor (BR-076).
 */

const none = { all: false, own: false, userMinistryId: null };

describe("canManageEvent", () => {
  it("eventos.write gerencia o evento de qualquer ministério e o geral", () => {
    const access = { ...none, all: true };

    expect(canManageEvent(access, 2)).toBe(true);
    expect(canManageEvent(access, null)).toBe(true);
  });

  it("BR-030 ADR-025 eventos.write.own gerencia os do próprio ministério e os gerais, nunca os de outro", () => {
    const access = { ...none, own: true, userMinistryId: 3 };

    expect(canManageEvent(access, 3)).toBe(true);
    expect(canManageEvent(access, null)).toBe(true);
    expect(canManageEvent(access, 2)).toBe(false);
  });

  it("BR-075 sem ministério vinculado, eventos.write.own não concede nada, nem os gerais", () => {
    const access = { ...none, own: true };

    expect(canManageEvent(access, null)).toBe(false);
    expect(canManageEvent(access, 2)).toBe(false);
  });

  it("ADR-027 quem só lê inscritos não gerencia evento nenhum", () => {
    expect(canManageEvent(none, 2)).toBe(false);
    expect(canManageEvent(none, null)).toBe(false);
  });
});

describe("canCreateEvent", () => {
  it("cria quem tem eventos.write ou .own; quem só lê inscritos, não", () => {
    expect(canCreateEvent({ ...none, all: true })).toBe(true);
    expect(canCreateEvent({ ...none, own: true, userMinistryId: 3 })).toBe(true);
    expect(canCreateEvent(none)).toBe(false);
  });
});
