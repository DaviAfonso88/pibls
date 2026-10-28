export interface Budgets {
  jsGzipBytes: number;
  cssGzipBytes: number;
}

export interface RouteEntry {
  id: string;
  parentId?: string;
  index?: boolean;
  path?: string;
  module: string;
  imports?: string[];
  css?: string[];
}

export interface ReactRouterManifest {
  entry: { module: string; imports: string[]; css?: string[] };
  routes: Record<string, RouteEntry>;
}

export interface RouteMeasure {
  route: string;
  jsBytes: number;
  cssBytes: number;
  jsFiles: number;
  cssFiles: number;
}

export const BUDGETS: Budgets;
export function parseManifest(source: string): ReactRouterManifest;
export function isAdminRoute(routeId: string): boolean;
export function routeChain(manifest: ReactRouterManifest, routeId: string): string[];
export function leafRoutes(manifest: ReactRouterManifest): string[];
export function initialAssets(
  manifest: ReactRouterManifest,
  routeId: string,
): { js: Set<string>; css: Set<string> };
export function evaluate(
  manifest: ReactRouterManifest,
  gzipSizeOf: (file: string) => number,
  budgets?: Budgets,
): { rows: RouteMeasure[]; violations: string[] };
export function kb(bytes: number): string;
