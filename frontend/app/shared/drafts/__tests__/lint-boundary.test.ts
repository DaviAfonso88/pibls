// @vitest-environment node
import { ESLint } from "eslint";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Rascunho local só em features/content e features/events (FR-077; T112). O formulário com dado pessoal (atendimento,
 * anotações, inscrições, PIX) não pode guardar nada no navegador, e a regra de ESLint garante isso na revisão: este teste
 * falha se alguém afrouxar a regra.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const IMPORT =
  'import { useFormDraft } from "~/shared/drafts";\nexport const draft = useFormDraft;\n';

async function boundaryErrors(filePath: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: root });
  const [result] = await eslint.lintText(IMPORT, { filePath: resolve(root, filePath) });

  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "import/no-restricted-paths")
    .map((message) => message.message);
}

describe("import de ~/shared/drafts", () => {
  it.each([
    ["app/features/leads/components/inbox-list.tsx"],
    ["app/features/access/components/login-form.tsx"],
    ["app/features/ministries/components/ministry-list.tsx"],
    ["app/routes/admin/contatos.tsx"],
  ])("falha em %s", async (filePath) => {
    const errors = await boundaryErrors(filePath);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("~/shared/drafts");
  });

  it.each([
    ["app/features/content/components/admin/bulletin-form.tsx"],
    ["app/features/events/components/event-form.tsx"],
  ])("passa em %s", async (filePath) => {
    expect(await boundaryErrors(filePath)).toEqual([]);
  });
});
