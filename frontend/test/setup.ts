import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { setBuildSnapshotLoader } from "~/shared/http/snapshots";
import { bridgeAbortSignal } from "./abort-bridge";
import { server } from "./server";

// As telas do painel são `React.lazy`: a primeira de cada arquivo de teste importa o módulo (devagar, sobretudo com cobertura)
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  bridgeAbortSignal();
});
// Por padrão, nenhum snapshot de build: o teste que o quer o instala com setBuildSnapshotLoader
beforeEach(() => setBuildSnapshotLoader(() => Promise.resolve(null)));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
