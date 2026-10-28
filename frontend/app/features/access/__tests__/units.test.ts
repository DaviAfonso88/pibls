import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { safeReturnPath } from "../auth-context";
import { readResetLink } from "../components/reset-password-form";
import { greeting, longDate } from "../greeting";
import { formatLastAccess } from "../last-access";
import { PERMISSION_KEYS, isPermissionKey, permissionAreas, roleLabel } from "../permissions";

const here = dirname(fileURLToPath(import.meta.url));

describe("permissões", () => {
  it("as 14 chaves são as do enum PermissionKey do backend", () => {
    const source = readFileSync(
      resolve(here, "../../../../../backend/app/Modules/Access/Authorization/PermissionKey.php"),
      "utf8",
    );
    const backend = [...source.matchAll(/case \w+ = '([^']+)';/g)].map(([, key]) => key).sort();

    expect(backend).toHaveLength(14);
    expect([...PERMISSION_KEYS].sort()).toEqual(backend);
  });

  it("reconhece chaves do catálogo e recusa o resto", () => {
    expect(isPermissionKey("leads.read")).toBe(true);
    expect(isPermissionKey("leads.delete")).toBe(false);
  });

  it("dá nome de gente aos papéis de referência e devolve o código dos desconhecidos", () => {
    expect(roleLabel("ORACAO")).toBe("Equipe de oração");
    expect(roleLabel("LIDER_MINISTERIO")).toBe("Liderança de ministério");
    expect(roleLabel("OUTRO")).toBe("OUTRO");
  });

  it("traduz permissões em áreas, sem repetir, separando consulta de atendimento", () => {
    expect(permissionAreas(["leads.read", "leads.manage", "settings.write", "pix.write"])).toEqual([
      "Contatos",
      "Configurações",
      "PIX",
    ]);
    expect(permissionAreas(["leads.read", "leads.oracao.read"])).toEqual([
      "Contatos (só consulta)",
      "Pedidos de oração (só consulta)",
    ]);
    expect(permissionAreas(["eventos.write.own", "eventos.inscricoes.read.own"])).toEqual([
      "Eventos do seu ministério",
      "Inscrições do seu ministério",
    ]);
    expect(permissionAreas([])).toEqual([]);
  });
});

describe("safeReturnPath (contra open redirect)", () => {
  it.each([
    ["/admin/usuarios", "/admin/usuarios"],
    ["/admin/contatos/12?status=NOVO", "/admin/contatos/12?status=NOVO"],
    [null, "/admin"],
    ["", "/admin"],
    ["https://malicioso.example", "/admin"],
    ["//malicioso.example/admin", "/admin"],
    ["/outra-area", "/admin"],
    ["/admin\\..\\malicioso", "/admin"],
    ["/admin/entrar?voltar=/admin", "/admin"],
  ])("%s → %s", (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
});

describe("link de redefinição de senha", () => {
  it("lê o token e o e-mail do fragmento", () => {
    expect(readResetLink("#token=abc123&email=rafael%40pibls.test")).toEqual({
      token: "abc123",
      email: "rafael@pibls.test",
    });
  });

  it.each(["", "#", "#token=abc", "#email=a%40b.co", "#token=&email=a%40b.co"])(
    "devolve nulo para %j",
    (hash) => {
      expect(readResetLink(hash)).toBeNull();
    },
  );
});

describe("saudação e data", () => {
  it.each([
    ["2026-10-20T10:00:00Z", "Bom dia"], // 07h em Brasília
    ["2026-10-20T15:00:00Z", "Boa tarde"], // 12h
    ["2026-10-20T20:59:00Z", "Boa tarde"], // 17h59
    ["2026-10-20T21:00:00Z", "Boa noite"], // 18h
    ["2026-10-21T02:30:00Z", "Boa noite"], // 23h30 do dia 20
    ["2026-10-20T03:00:00Z", "Boa noite"], // 00h
    ["2026-10-20T14:59:00Z", "Bom dia"], // 11h59
  ])("%s → %s (hora de Brasília)", (instant, expected) => {
    expect(greeting(new Date(instant))).toBe(expected);
  });

  it("escreve a data por extenso, na data de Brasília, com a primeira letra maiúscula", () => {
    expect(longDate(new Date("2026-10-20T15:00:00Z"))).toBe("Terça-feira, 20 de outubro");
    // 01h UTC ainda é o dia anterior em Brasília
    expect(longDate(new Date("2026-10-21T01:00:00Z"))).toBe("Terça-feira, 20 de outubro");
  });
});

describe("último acesso", () => {
  const now = new Date("2026-10-20T15:00:00Z"); // terça-feira, 12h em Brasília

  it.each([
    [null, "Nunca entrou"],
    [undefined, "Nunca entrou"],
    ["2026-10-20T11:40:00Z", "Hoje, 08h40"],
    ["2026-10-19T22:15:00Z", "Ontem, 19h15"],
    ["2026-10-18T20:00:00Z", "18/10"],
    ["2025-12-31T20:00:00Z", "31/12/2025"],
  ])("%s → %s", (value, expected) => {
    expect(formatLastAccess(value, now)).toBe(expected);
  });

  it("a borda da meia-noite vale para a data de Brasília, não a de Greenwich", () => {
    // 02h30Z do dia 20 = 23h30 do dia 19 em Brasília = ontem
    expect(formatLastAccess("2026-10-20T02:30:00Z", now)).toBe("Ontem, 23h30");
    // 03h10Z do dia 20 = 00h10 do dia 20 em Brasília = hoje
    expect(formatLastAccess("2026-10-20T03:10:00Z", now)).toBe("Hoje, 00h10");
  });
});
