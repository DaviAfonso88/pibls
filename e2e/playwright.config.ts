import { defineConfig, devices } from "@playwright/test";

// Os testes rodam contra o build servido pelo Apache local com o .htaccess real
// (npm run build && npm run deploy:local → http://localhost:8080) ou contra E2E_BASE_URL.
export default defineConfig({
  testDir: "./specs",
  // O Docker local (Windows, sem OPcache) leva ~10 s por requisição: E2E_TEST_TIMEOUT e E2E_EXPECT_TIMEOUT (ms) alargam os prazos.
  timeout: Number(process.env.E2E_TEST_TIMEOUT ?? 30_000),
  expect: { timeout: Number(process.env.E2E_EXPECT_TIMEOUT ?? 5_000) },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    // Homologação fica atrás de HTTP Basic ("usuario:senha" em E2E_BASIC_AUTH); local e produção não usam
    ...(process.env.E2E_BASIC_AUTH
      ? {
          httpCredentials: {
            username: process.env.E2E_BASIC_AUTH.split(":")[0] ?? "",
            password: process.env.E2E_BASIC_AUTH.split(":").slice(1).join(":"),
          },
        }
      : {}),
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "on-first-retry",
  },
  projects: [
    {
      // Site público: mobile-first, 360 px
      name: "publico-360",
      testMatch: /specs\/(?!admin|registrations-admin|access|leads-inbox|content|pix|settings|full\/(painel|jornada)).*\.spec\.ts/,
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
    {
      // Painel: desktop
      name: "painel-desktop",
      testMatch: /specs\/(admin|registrations-admin|access|leads-inbox|content|pix|settings|full\/(painel|jornada)).*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
