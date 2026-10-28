import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { messages } from "../messages";
import { ruleMessages } from "../rule-messages";

// O Vite reescreve `new URL("literal", import.meta.url)` em endereço http; por isso o caminho sai de fileURLToPath.
const here = dirname(fileURLToPath(import.meta.url));

function readLang(file: string): string {
  return readFileSync(resolve(here, "../../../../backend/lang/pt_BR", file), "utf8");
}

/** Textos entre aspas simples de um trecho de PHP, já sem o escape de `\'` e `\\`. */
function phpStrings(source: string): string[] {
  return [...source.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(([, text]) =>
    (text ?? "").replace(/\\(['\\])/g, "$1"),
  );
}

/** `business.php`: id da BR → todas as frases dela. */
function parseBusiness(): Map<string, string[]> {
  const source = readLang("business.php");
  const body = source.slice(source.indexOf("return ["));
  const chunks = body.split(/^\s*'(BR-\d+)'\s*=>/m);

  const result = new Map<string, string[]>();
  // split com grupo de captura devolve [lixo, id, trecho, id, trecho, …]
  for (let index = 1; index < chunks.length; index += 2) {
    result.set(chunks[index] ?? "", phpStrings(chunks[index + 1] ?? ""));
  }
  return result;
}

/** `errors.php`: chave → frase. */
function parseErrors(): Map<string, string> {
  const source = readLang("errors.php");
  const body = source.slice(source.indexOf("return ["));
  return new Map(
    [...body.matchAll(/^\s*'([a-z_]+)'\s*=>\s*'((?:[^'\\]|\\.)*)'/gm)].map(([, key, text]) => [
      key ?? "",
      text ?? "",
    ]),
  );
}

/** Para cada regra da interface, a BR cujo texto ela repete. */
const ruleToBr = {
  consent: "BR-001",
  name: "BR-004",
  phone: "BR-004",
  email: "BR-004",
  message: "BR-004",
  phoneOrEmail: "BR-005",
  invalidMinistry: "BR-006",
  invalidGroup: "BR-006",
  note: "BR-013",
  required: "BR-024",
  pickOption: "BR-024",
  guardian: "BR-023",
  healthConsent: "BR-083",
  youtube: "BR-044",
  formatRemoved: "BR-046",
  pdfType: "BR-041",
  pdfSize: "BR-041",
  qrImage: "BR-045",
  pixPassword: "BR-060",
  pixAlertBlocked: "BR-063",
  scheduleRequired: "BR-049",
  neighborhoodRequired: "BR-049",
  recipients: "BR-051",
  cnpj: "BR-061",
  pixCode: "BR-062",
  passwordMin: "BR-073",
  passwordMax: "BR-073",
} as const satisfies Record<keyof typeof ruleMessages, string>;

describe("textos da interface x textos do backend", () => {
  const business = parseBusiness();

  it("lê as regras de negócio do arquivo do backend", () => {
    expect(business.size).toBeGreaterThan(40);
    expect(business.get("BR-004")).toHaveLength(4);
  });

  it("todo texto de regra do frontend existe no backend, na BR indicada", () => {
    for (const [rule, br] of Object.entries(ruleToBr)) {
      const text = ruleMessages[rule as keyof typeof ruleMessages];
      expect(business.get(br), `${rule} → ${br} não existe em business.php`).toContain(text);
    }
  });

  it("toda regra do frontend tem a BR declarada neste teste", () => {
    expect(Object.keys(ruleMessages).sort()).toEqual(Object.keys(ruleToBr).sort());
  });

  it("a BR anotada no comentário de cada regra bate com a do teste", () => {
    const file = readFileSync(resolve(here, "../rule-messages.ts"), "utf8");
    const lines = file.split("\n");

    for (const [rule, br] of Object.entries(ruleToBr)) {
      const index = lines.findIndex((candidate) => new RegExp(`^\\s{2}${rule}:`).test(candidate));
      expect(index, `regra ${rule} não encontrada em rule-messages.ts`).toBeGreaterThanOrEqual(0);

      // O comentário fica na linha da regra; se o texto é longo e o Prettier o leva para a linha de baixo, fica na linha
      // de cima da chave, ou no fim do texto. A regra seguinte começa em outra linha, então não há confusão entre elas.
      const value = lines[index]?.trimEnd().endsWith(":") ? (lines[index + 1] ?? "") : "";
      const before = (lines[index - 1] ?? "").trimStart().startsWith("//")
        ? (lines[index - 1] ?? "")
        : "";
      const around = [before, lines[index] ?? "", value].join("\n");
      expect(around, `regra ${rule}`).toContain(`// ${br}`);
    }
  });

  it("as mensagens de erro de rede e servidor são as do envelope do backend", () => {
    const errors = parseErrors();

    expect(messages.errors.serviceUnavailable).toBe(errors.get("service_unavailable"));
    expect(messages.errors.csrf).toBe(errors.get("csrf"));
    expect(messages.errors.sessionExpired).toBe(errors.get("unauthenticated"));
    expect(messages.errors.forbidden).toBe(errors.get("forbidden"));
    expect(messages.errors.notFound).toBe(errors.get("not_found"));
    expect(messages.errors.tooManyRequests).toBe(errors.get("too_many_requests"));
    expect(messages.errors.payloadTooLarge).toBe(errors.get("payload_too_large"));
    expect(messages.errors.internal("ABC123")).toBe(
      (errors.get("internal") ?? "").replace(":trace_id", "ABC123"),
    );
  });

  it("a mensagem de muitas tentativas é a mesma da BR-003", () => {
    expect(business.get("BR-003")).toContain(messages.errors.tooManyRequests);
  });
});
