export type Resolution =
  { kind: "file"; path: string } | { kind: "notFound" } | { kind: "forbidden" };

export function resolvePath(urlPath: string, exists: (relativePath: string) => boolean): Resolution;

export const CONTENT_TYPES: Record<string, string>;
