import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Sem o plugin do React Router: os testes não precisam do build, só do alias e do JSX.
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // A primeira tela lazy (ou o primeiro editor TipTap) de cada arquivo importa o módulo, o que passa de 5 s com cobertura
    testTimeout: 15_000,
    include: ["app/**/__tests__/**/*.test.{ts,tsx}", "scripts/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["app/features/**", "app/shared/**"],
      // Tipos gerados do OpenAPI (npm run api:types) e os próprios testes não são código a cobrir
      exclude: ["app/shared/api-types.ts", "**/__tests__/**"],
      reporter: ["text-summary", "lcov"],
      thresholds: { lines: 70 },
    },
  },
});
