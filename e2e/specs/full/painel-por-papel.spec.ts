import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, PASSWORD, signIn } from "./helpers";

// QA-01: cada um dos 7 papéis de referência percorre TODAS as telas de lista do painel. Onde o papel tem a permissão, a tela
// abre e passa no axe (WCAG 2.1 AA); onde não tem, aparece o aviso "Você não tem acesso a esta área" (BR-076), nunca uma tela
// vazia nem um erro. Os usuários vêm do LocalDevelopmentSeeder (`<papel>@pibls.test`).
//
// Limites: 20 logins por 15 min por IP (esta suíte faz 7). Entre rodadas seguidas, `docker compose exec app php artisan
// cache:clear`. No Docker local, rode com E2E_TEST_TIMEOUT=600000 e E2E_EXPECT_TIMEOUT=45000 (cada requisição leva ~10 s).

test.skip(PASSWORD === undefined, "Defina E2E_USERS_PASSWORD (a TEST_USERS_PASSWORD do backend).");

/** A tela e o item do menu que a abre. */
const SCREENS = [
  { path: "/admin", menu: "Início" },
  { path: "/admin/contatos", menu: "Contatos" },
  { path: "/admin/oracao", menu: "Pedidos de oração" },
  { path: "/admin/boletins", menu: "Boletins" },
  { path: "/admin/palavra-viva", menu: "Palavra Viva" },
  { path: "/admin/pix", menu: "PIX" },
  { path: "/admin/configuracoes", menu: "Configurações" },
  { path: "/admin/ministerios", menu: "Ministérios e grupos" },
  { path: "/admin/usuarios", menu: "Usuários" },
] as const;

/** O menu de cada papel é o mesmo de `specs/access.spec.ts`: se um mudar sem o outro, um dos dois testes falha. */
const ROLES: ReadonlyArray<{ role: string; email: string; menu: readonly string[] }> = [
  { role: "COMUNICACAO", email: "comunicacao@pibls.test", menu: ["Início", "Boletins", "Palavra Viva", "Ministérios e grupos", "Configurações"] },
  { role: "SECRETARIA", email: "secretaria@pibls.test", menu: ["Início", "Contatos", "Ministérios e grupos", "Configurações"] },
  { role: "TESOURARIA", email: "tesouraria@pibls.test", menu: ["Início", "PIX"] },
  { role: "ORACAO", email: "oracao@pibls.test", menu: ["Início", "Pedidos de oração"] },
  { role: "PASTORAL", email: "pastoral@pibls.test", menu: ["Início", "Contatos", "Pedidos de oração", "Palavra Viva", "Usuários"] },
  { role: "LIDER_MINISTERIO", email: "lider@pibls.test", menu: ["Início"] },
  { role: "ADMIN_TECNICO", email: "admin@pibls.test", menu: ["Início", "Usuários"] },
];

test.describe("painel por papel, tela a tela @a11y", () => {
  for (const { role, email, menu } of ROLES) {
    test(`${role}: abre as telas que pode, é barrado nas outras e todas passam no axe`, async ({ page }) => {
      test.setTimeout(Number(process.env.E2E_TEST_TIMEOUT ?? 30_000) * 4);
      await signIn(page, email);

      for (const screen of SCREENS) {
        await page.goto(screen.path);

        if (menu.includes(screen.menu)) {
          // Tela permitida: o título da própria tela, e nada do aviso de falta de acesso
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(page.getByText("Você não tem acesso a esta área")).toHaveCount(0);
          // Espera a lista terminar de carregar (o indicador some) antes de o axe olhar. Só conta o `status` com texto: a região
          // viva vazia (ex.: o aviso de rascunho das Configurações) existe de propósito, para o leitor de tela anunciar depois.
          await expect(page.locator('[role="status"]:not(:empty)')).toHaveCount(0, { timeout: 45_000 });
        } else {
          await expect(page.getByRole("heading", { level: 1, name: "Você não tem acesso a esta área" })).toBeVisible();
        }

        await expectNoA11yViolations(page, `${role} em ${screen.path}`);
      }
    });
  }

  test("uma rota inexistente do painel mostra o 404 do painel, com o menu", async ({ page }) => {
    await signIn(page, "secretaria@pibls.test");
    await page.goto("/admin/nao-existe");

    await expect(page.getByRole("heading", { level: 1, name: "Esta página do painel não existe" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Painel" })).toBeVisible();
    await expectNoA11yViolations(page, "404 do painel");
  });
});
