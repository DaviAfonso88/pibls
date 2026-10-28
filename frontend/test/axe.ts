import axe from "axe-core";
import { expect } from "vitest";

/**
 * Roda o axe-core (WCAG 2.1 A e AA) sobre um trecho renderizado e falha listando as violações.
 * O contraste de cor fica de fora porque o jsdom não calcula estilo; ele é conferido no Playwright + axe do CI, no
 * navegador de verdade.
 */
export async function expectNoA11yViolations(root: Element = document.body): Promise<void> {
  const results = await axe.run(root, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });

  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `  ${node.html}`).join("\n")}`,
  );
  expect(summary, summary.join("\n\n")).toEqual([]);
}
