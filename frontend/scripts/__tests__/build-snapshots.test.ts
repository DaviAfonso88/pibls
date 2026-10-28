import { describe, expect, it, vi } from "vitest";
import { collectSnapshots, isSnapshotFile, sourceOf } from "../build-snapshots-lib.mjs";

const file = (data: unknown) =>
  JSON.stringify({ data, generated_at: "2026-10-20T12:00:00Z", extra: "ignorado" });

describe("snapshots do build (FR-011)", () => {
  it("reconhece o formato { data, generated_at }", () => {
    expect(isSnapshotFile({ data: [] })).toBe(true);
    expect(isSnapshotFile({ data: null })).toBe(false);
    expect(isSnapshotFile({})).toBe(false);
    expect(isSnapshotFile([])).toBe(false);
    expect(isSnapshotFile(null)).toBe(false);
  });

  it("usa URL quando a origem é http(s) e pasta nos outros casos", () => {
    expect(sourceOf("https://homolog.pibls.com/data/", "home")).toBe(
      "https://homolog.pibls.com/data/home.json",
    );
    expect(sourceOf("../e2e/fixtures/data", "home")).toBeNull();
  });

  it("baixa os três arquivos de uma URL e regrava só o contrato", async () => {
    const fetchText = vi.fn((url: string) => Promise.resolve(file({ from: url })));

    const { files, skipped } = await collectSnapshots("https://pibls.com/data", {
      fetchText,
      readText: () => null,
    });

    expect(Object.keys(files)).toEqual(["settings", "ministries", "home"]);
    expect(skipped).toEqual([]);
    expect(JSON.parse(files.settings ?? "")).toEqual({
      data: { from: "https://pibls.com/data/settings.json" },
      generated_at: "2026-10-20T12:00:00Z",
    });
    expect(fetchText).toHaveBeenCalledTimes(3);
  });

  it("lê de uma pasta", async () => {
    const readText = (name: string) => file({ name });

    const { files } = await collectSnapshots("../e2e/fixtures/data", {
      fetchText: () => Promise.reject(new Error("sem rede")),
      readText,
    });

    expect(JSON.parse(files.home ?? "")).toMatchObject({ data: { name: "home" } });
  });

  it("um arquivo que falta, falha ou vem fora do formato fica de fora, sem derrubar os outros", async () => {
    const readText = (name: string) =>
      name === "settings" ? file({ ok: true }) : name === "ministries" ? null : "{ não é json";

    const { files, skipped } = await collectSnapshots("pasta", {
      fetchText: () => Promise.reject(new Error("x")),
      readText,
    });

    expect(Object.keys(files)).toEqual(["settings"]);
    expect(skipped).toHaveLength(2);
    expect(skipped[0]).toContain("ministries: arquivo não encontrado");
    expect(skipped[1]).toContain("home:");
  });

  it("recusa um arquivo sem data", async () => {
    const { files, skipped } = await collectSnapshots("pasta", {
      fetchText: () => Promise.reject(new Error("x")),
      readText: () => JSON.stringify({ generated_at: "2026-10-20T12:00:00Z" }),
    });

    expect(files).toEqual({});
    expect(skipped[0]).toContain("fora do formato");
  });
});
