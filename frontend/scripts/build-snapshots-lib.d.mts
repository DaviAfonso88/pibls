export const SNAPSHOT_NAMES: string[];
export function isSnapshotFile(value: unknown): boolean;
export function sourceOf(base: string, name: string): string | null;
export function collectSnapshots(
  base: string,
  io: { fetchText: (url: string) => Promise<string>; readText: (name: string) => string | null },
): Promise<{ files: Record<string, string>; skipped: string[] }>;
