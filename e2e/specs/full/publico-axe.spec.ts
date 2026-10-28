import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";

// QA-01: o resto das páginas públicas com axe (WCAG 2.1 AA). `specs/a11y.spec.ts` já cobre o início, os quatro formulários, a
// privacidade e o 404; aqui entram as demais, mais os detalhes que existirem nos dados de teste. Roda no projeto mobile (360 px).

const PAGES: ReadonlyArray<{ name: string; path: string; heading: string | RegExp }> = [
  { name: "Quem somos", path: "/quem-somos", heading: "Quem somos" },
  { name: "Ministérios", path: "/ministerios", heading: "Ministérios" },
  { name: "Grupos e Células de CL", path: "/grupos", heading: "Para você" },
  { name: "Boletins", path: "/boletins", heading: "Boletins" },
  { name: "Palavra Viva", path: "/palavra-viva", heading: /Palavra Viva/ },
  { name: "Contribua", path: "/contribua", heading: /Contribua|Contribuir/ },
  { name: "Como chegar", path: "/como-chegar", heading: /Como chegar/ },
];

for (const { name, path, heading } of PAGES) {
  test(`axe: ${name} (${path}) @a11y`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();

    await expectNoA11yViolations(page, name);
  });
}

test("axe: a mensagem da Palavra Viva (detalhe), se houver alguma publicada @a11y", async ({ page }) => {
  await page.goto("/palavra-viva");
  await expect(page.getByRole("heading", { level: 1, name: /Palavra Viva/ })).toBeVisible();

  const first = page.locator('main a[href^="/palavra-viva/"]').first();
  test.skip((await first.count()) === 0, "Nenhuma mensagem publicada nos dados de teste.");

  await first.click();
  await expect(page).toHaveURL(/\/palavra-viva\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await expectNoA11yViolations(page, "Mensagem da Palavra Viva");
});

test("cada página pública tem um único h1 e o menu marca a página atual @a11y", async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Navegação principal" }).locator('[aria-current="page"]')).toHaveCount(1);
  }
});
