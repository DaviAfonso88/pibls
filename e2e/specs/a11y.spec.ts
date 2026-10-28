import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Acessibilidade do site público (WCAG 2.1 A e AA) no navegador de verdade, onde o contraste de cor e o layout contam.
// Roda no job a11y-perf do CI contra o build servido com o .htaccess emulado (frontend/scripts/serve-build.mjs) e com
// dados fictícios. Cada tela nova do site público entra na lista; violação bloqueia o merge (RNF-05).

const PUBLIC_PAGES: ReadonlyArray<{
  name: string;
  path: string;
  form?: boolean;
}> = [
  { name: "Início", path: "/" },
  { name: "Sou visitante", path: "/sou-visitante", form: true },
  { name: "Quero ser membro", path: "/quero-ser-membro", form: true },
  { name: "Pedido de oração", path: "/pedido-de-oracao", form: true },
  { name: "Contato", path: "/contato", form: true },
  { name: "Privacidade", path: "/privacidade" },
  { name: "404 amigável", path: "/pagina-que-nao-existe" },
];

for (const { name, path, form } of PUBLIC_PAGES) {
  test(`axe: ${name} (${path}) não tem violação de acessibilidade @a11y`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // O rodapé só preenche endereço e horários depois do snapshot de configurações
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // O formulário chega depois da hidratação (React.lazy): o axe precisa olhar o formulário, não o esqueleto
    if (form) await expect(page.getByRole("form")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const summary = results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}`)
          .join("\n")}`,
    );
    expect(summary, summary.join("\n\n")).toEqual([]);
  });

  test(`teclado: ${name} (${path}) tem pular-para-o-conteúdo e foco visível @a11y`, async ({
    page,
  }) => {
    await page.goto(path);
    // A página só aceita foco depois de hidratar (o fallback da SPA mostra um indicador de carregamento antes)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: "Ir para o conteúdo" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    // Foco visível: o anel de 3 px do tema (app.css)
    const outline = await skip.evaluate(
      (element) => getComputedStyle(element).outlineWidth,
    );
    expect(outline).toBe("3px");
  });
}

test("o menu do site público cabe no celular sem rolagem horizontal da página @a11y", async ({
  page,
}) => {
  await page.goto("/");

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a página inicial hidrata sem erro de console, com as configurações do snapshot @a11y", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");

  await expect(
    page.getByRole("contentinfo").getByText("Domingo · 10h10 e 19h30"),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
