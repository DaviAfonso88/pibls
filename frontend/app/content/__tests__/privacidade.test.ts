import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { privacyPolicy } from "../privacidade";

const here = dirname(fileURLToPath(import.meta.url));

describe("Política de Privacidade (conteúdo versionado)", () => {
  it("BR-082 a versão do texto é a que o servidor grava em consent_version", () => {
    const config = readFileSync(resolve(here, "../../../../backend/config/pibls.php"), "utf8");
    const match =
      /'privacy_policy_version'\s*=>\s*env\('PRIVACY_POLICY_VERSION',\s*'([^']+)'\)/.exec(config);

    expect(match?.[1]).toBe(privacyPolicy.version);
  });

  it("declara os prazos de retenção aprovados (60/90 dias, 12 meses e 3 meses)", () => {
    const periods = privacyPolicy.retention.rows.map((row) => `${row.data}: ${row.period}`);

    expect(periods).toEqual([
      "Pedido de oração: 60 dias depois de concluído (90 dias se não for concluído)",
      "Demais contatos: 12 meses depois de concluído",
      "Inscrições em eventos: 3 meses depois do fim do evento",
    ]);
  });

  it("não carrega marca de conteúdo provisório, que bloquearia a publicação em produção", () => {
    const text = JSON.stringify(privacyPolicy);
    // Montado em partes: o literal dentro de `frontend/app/content` acionaria o próprio gate do CI
    const marker = ["TODO", "(TBD-"].join("");

    expect(text).not.toContain(marker);
  });

  it("cita os operadores e o canal do titular", () => {
    const text = JSON.stringify(privacyPolicy);

    expect(text).toContain("HostGator");
    expect(text).toContain("Backblaze");
    expect(text).toContain("Sentry");
    expect(text).toContain("pibls@pibls.com");
  });

  it("promete a resposta a pedidos de titulares em 15 dias", () => {
    const rights = privacyPolicy.closingSections.find(
      (section) => section.title === "Seus direitos",
    );

    expect(rights?.paragraphs.join(" ")).toContain("15 dias");
  });
});
