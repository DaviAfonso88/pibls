import { describe, expect, it } from "vitest";
import type { AdminEvent } from "../admin-api";
import {
  buildRegistrationsDocument,
  pdfFilename,
  renderRegistrationsPdf,
  type PdfEvent,
} from "../pdf-export";
import { registrationColumns } from "../registration-columns";
import type { AdminRegistration } from "../registrations-api";

/*
 * O PDF das inscrições (T190; FR-061, SC-014): A4 paisagem, cabeçalho do evento e as mesmas colunas do CSV, também com 500
 * linhas e sem nenhuma. A definição do documento é conferida sem a biblioteca; uma geração de verdade confere que o arquivo
 * sai. O tempo do PDF de 500 no computador de referência fica no E2E (`registrations-admin.spec.ts`).
 */

const field = (key: string, label: string, type: AdminEvent["form_schema"][number]["type"]) => ({
  key,
  label,
  type,
  required: false,
  help_text: null,
  sensitive: false,
  min: null,
  max: null,
  options: null,
});

const event: PdfEvent = {
  title: "Retiro de jovens",
  starts_at: "2026-12-05T12:00:00Z",
  ends_at: "2026-12-07T15:00:00Z",
  location: "Chácara Boa Vista",
  has_minors: true,
  max_spots: 60,
  form_schema: [
    field("camiseta", "Tamanho da camiseta", "SELECT"),
    field("alergias", "Alergias", "TEXT"),
    field("peso", "Peso (kg)", "NUMBER"),
    field("vegetariano", "Vegetariano", "BOOLEAN"),
    field("nascimento", "Nascimento", "DATE"),
    field("oficinas", "Oficinas", "MULTISELECT"),
  ],
};

function registration(id: number, overrides: Partial<AdminRegistration> = {}): AdminRegistration {
  return {
    id,
    created_at: "2026-11-02T15:30:00Z",
    participant_name: `Participante ${id}`,
    phone: "+5531988776655",
    email: null,
    guardian_name: null,
    guardian_phone: null,
    answers: [],
    ...overrides,
  };
}

const NOW = new Date("2026-11-10T15:00:00Z");

/** As células de texto de uma linha da tabela do documento. */
function rowTexts(row: unknown): string[] {
  return (row as { text: string }[]).map((cell) => cell.text);
}

function tableOf(definition: ReturnType<typeof buildRegistrationsDocument>) {
  const content = definition.content as { table?: { body: unknown[][]; widths: unknown[] } }[];
  const table = content.find((node) => node.table !== undefined)?.table;
  if (table === undefined) throw new Error("O documento não tem tabela.");
  return table;
}

describe("definição do documento", () => {
  it("é A4 em paisagem, com o cabeçalho do evento e a data de geração", () => {
    const definition = buildRegistrationsDocument(event, [registration(1)], NOW);
    const intro = (definition.content as { text?: string }[])
      .map((node) => node.text)
      .filter((text): text is string => text !== undefined);

    expect(definition.pageSize).toBe("A4");
    expect(definition.pageOrientation).toBe("landscape");
    expect(intro[0]).toBe("Retiro de jovens");
    expect(intro[1]).toContain("Sábado, 5 de dezembro de 2026");
    expect(intro[2]).toBe("Local: Chácara Boa Vista");
    expect(intro[3]).toBe("1 de 60 vagas preenchidas · Gerado em 10/11/2026 às 12h00");
  });

  it("usa as mesmas colunas do CSV, na mesma ordem (campos fixos, responsável e perguntas)", () => {
    const table = tableOf(buildRegistrationsDocument(event, [registration(1)], NOW));

    // O mesmo cabeçalho que o servidor grava no CSV (RegistrationsAdminTest, snapshot do formato)
    expect(rowTexts(table.body[0])).toEqual([
      "Inscrito em",
      "Nome",
      "Telefone",
      "E-mail",
      "Responsável",
      "Telefone do responsável",
      "Tamanho da camiseta",
      "Alergias",
      "Peso (kg)",
      "Vegetariano",
      "Nascimento",
      "Oficinas",
    ]);
    expect(rowTexts(table.body[0])).toEqual(registrationColumns(event).map((c) => c.header));
    expect(table.widths).toHaveLength(12);
  });

  it("sem menores, não tem as colunas do responsável", () => {
    const table = tableOf(
      buildRegistrationsDocument({ ...event, has_minors: false, form_schema: [] }, [], NOW),
    );

    expect(rowTexts(table.body[0])).toEqual(["Inscrito em", "Nome", "Telefone", "E-mail"]);
  });

  it("escreve cada resposta como a pessoa a lê", () => {
    const full = registration(1, {
      email: "ana@example.com",
      guardian_name: "Rita Souza",
      guardian_phone: "+5531977665544",
      answers: [
        { key: "camiseta", label: "Tamanho da camiseta", type: "SELECT", value: "M" },
        { key: "alergias", label: "Alergias", type: "TEXT", value: "Amendoim; nozes" },
        { key: "peso", label: "Peso (kg)", type: "NUMBER", value: 70.5 },
        { key: "vegetariano", label: "Vegetariano", type: "BOOLEAN", value: true },
        { key: "nascimento", label: "Nascimento", type: "DATE", value: "2010-03-09" },
        { key: "oficinas", label: "Oficinas", type: "MULTISELECT", value: ["Violão", "Teatro"] },
      ],
    });
    const table = tableOf(buildRegistrationsDocument(event, [full], NOW));

    expect(rowTexts(table.body[1])).toEqual([
      "02/11/2026 12h30",
      "Participante 1",
      "(31) 98877-6655",
      "ana@example.com",
      "Rita Souza",
      "(31) 97766-5544",
      "M",
      "Amendoim; nozes",
      "70,5",
      "Sim",
      "09/03/2010",
      "Violão, Teatro",
    ]);
  });

  it("sem inscrições, o arquivo traz só o cabeçalho da tabela", () => {
    const table = tableOf(buildRegistrationsDocument(event, [], NOW));

    expect(table.body).toHaveLength(1);
    expect(table.body[0]).toBeDefined();
  });

  it("com 500 inscrições, a tabela tem 501 linhas e repete o cabeçalho a cada página", () => {
    const rows = Array.from({ length: 500 }, (_, index) => registration(index + 1));
    const definition = buildRegistrationsDocument(event, rows, NOW);
    const table = tableOf(definition) as { body: unknown[][]; headerRows?: number };

    expect(table.body).toHaveLength(501);
    expect(table.headerRows).toBe(1);
    expect(rowTexts(table.body[500])[1]).toBe("Participante 500");
  });

  it("evento sem limite de vagas fala em inscritos", () => {
    const definition = buildRegistrationsDocument(
      { ...event, max_spots: null },
      [registration(1), registration(2)],
      NOW,
    );
    const lines = (definition.content as { text?: string }[]).map((node) => node.text ?? "");

    expect(lines[3]).toBe("2 inscritos · Gerado em 10/11/2026 às 12h00");
  });
});

describe("nome do arquivo", () => {
  it("segue o do CSV, com a data de hoje em São Paulo", () => {
    expect(pdfFilename("retiro", NOW)).toBe("inscritos-retiro-20261110.pdf");
    // 01h30 UTC de 11/11 ainda é noite de 10/11 em São Paulo
    expect(pdfFilename("retiro", new Date("2026-11-11T01:30:00Z"))).toBe(
      "inscritos-retiro-20261110.pdf",
    );
  });
});

describe("geração do arquivo", () => {
  it("gera um PDF de verdade, com 500 inscrições", async () => {
    const rows = Array.from({ length: 500 }, (_, index) =>
      registration(index + 1, {
        email: `pessoa${index + 1}@example.com`,
        answers: [{ key: "camiseta", label: "Tamanho da camiseta", type: "SELECT", value: "G" }],
      }),
    );

    const blob = await renderRegistrationsPdf(event, rows, NOW);
    const header = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());

    expect(blob.size).toBeGreaterThan(10_000);
    expect(header).toBe("%PDF-");
  }, 60_000);
});
