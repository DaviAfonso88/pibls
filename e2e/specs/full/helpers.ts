import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** A senha dos usuários do LocalDevelopmentSeeder (a TEST_USERS_PASSWORD do backend). Sem ela, o painel não é testado. */
export const PASSWORD = process.env.E2E_USERS_PASSWORD;

/** WCAG 2.1 A e AA, as mesmas regras de `specs/a11y.spec.ts`: contraste e layout só contam no navegador de verdade. */
export async function expectNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
        .map((node) => `  ${node.target.join(" ")}`)
        .join("\n")}`,
  );

  expect(summary, `${label}: violações de acessibilidade`).toEqual([]);
}

export async function signIn(page: Page, email: string) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
