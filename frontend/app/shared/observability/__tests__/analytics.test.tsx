import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Analytics, isMeasuredPath, resetAnalyticsForTests } from "../analytics";

const SRC = "https://gc.zgo.at/count.js";
const ENDPOINT = "https://pibls.goatcounter.com/count";

function scripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-goatcounter]"));
}

/** O jsdom não baixa script externo: simula o `count.js` terminando de carregar e definindo `count`. */
function finishLoading(count: ReturnType<typeof vi.fn>) {
  window.goatcounter = { ...window.goatcounter, count };
  scripts()[0]?.dispatchEvent(new Event("load"));
}

function renderAt(path: string, props: { src?: string; endpoint?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Analytics src={SRC} endpoint={ENDPOINT} {...props} />
      <Link to="/boletins?q=maria">Boletins</Link>
      <Link to="/admin/contatos">Painel</Link>
      <Link to="/grupos">Grupos</Link>
    </MemoryRouter>,
  );
}

describe("Analytics (FR-076)", () => {
  beforeEach(() => {
    resetAnalyticsForTests();
    delete window.goatcounter;
    for (const script of scripts()) script.remove();
  });

  afterEach(() => {
    delete window.goatcounter;
  });

  it("sem endereço configurado, nenhum script entra na página", () => {
    renderAt("/", { src: "", endpoint: "" });
    renderAt("/boletins", { src: SRC, endpoint: "" });

    expect(scripts()).toHaveLength(0);
    expect(window.goatcounter).toBeUndefined();
  });

  it("recusa endereço que não seja https nem caminho do próprio site", () => {
    renderAt("/", { src: "http://gc.zgo.at/count.js" });
    renderAt("/", { src: "//gc.zgo.at/count.js" });
    renderAt("/", { src: "javascript:alert(1)" });

    expect(scripts()).toHaveLength(0);
  });

  it("aceita o script hospedado no próprio site", () => {
    renderAt("/", { src: "/count.js" });

    expect(scripts()[0]?.getAttribute("src")).toBe("/count.js");
  });

  it("nas páginas públicas, carrega um único script, assíncrono, com o destino da contagem", () => {
    renderAt("/quem-somos");

    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]?.getAttribute("src")).toBe(SRC);
    expect(scripts()[0]?.dataset.goatcounter).toBe(ENDPOINT);
    expect(scripts()[0]?.async).toBe(true);
    expect(window.goatcounter?.no_onload).toBe(true);
  });

  it("conta a página aberta quando o script termina de carregar", () => {
    renderAt("/quem-somos");
    const count = vi.fn();

    expect(count).not.toHaveBeenCalled();
    finishLoading(count);

    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ path: "/quem-somos" });
  });

  it("conta cada navegação, só com o caminho: nunca a query string", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const count = vi.fn();
    finishLoading(count);

    await user.click(screen.getByRole("link", { name: "Boletins" }));
    await waitFor(() => expect(count).toHaveBeenCalledWith({ path: "/boletins" }));
    await user.click(screen.getByRole("link", { name: "Grupos" }));
    await waitFor(() => expect(count).toHaveBeenLastCalledWith({ path: "/grupos" }));

    expect(count.mock.calls.map(([vars]) => vars.path)).toEqual(["/", "/boletins", "/grupos"]);
    expect(JSON.stringify(count.mock.calls)).not.toContain("maria");
    expect(scripts()).toHaveLength(1);
  });

  it("a navegação que chega antes de o script carregar é contada, na ordem, quando ele carrega", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.click(screen.getByRole("link", { name: "Grupos" }));
    const count = vi.fn();
    finishLoading(count);

    expect(count.mock.calls.map(([vars]) => vars.path)).toEqual(["/", "/grupos"]);
  });

  it("nunca no painel: abrir /admin não carrega nem conta nada", async () => {
    const user = userEvent.setup();
    renderAt("/admin");

    expect(scripts()).toHaveLength(0);

    await user.click(screen.getByRole("link", { name: "Painel" }));
    expect(scripts()).toHaveLength(0);
    expect(window.goatcounter).toBeUndefined();
  });

  it("ao sair do painel para o site, volta a contar só a página pública", async () => {
    const user = userEvent.setup();
    renderAt("/admin/contatos");
    expect(scripts()).toHaveLength(0);

    await user.click(screen.getByRole("link", { name: "Grupos" }));
    const count = vi.fn();
    finishLoading(count);

    expect(count.mock.calls.map(([vars]) => vars.path)).toEqual(["/grupos"]);
  });
});

describe("isMeasuredPath", () => {
  it("exclui o painel e só o painel", () => {
    expect(isMeasuredPath("/admin")).toBe(false);
    expect(isMeasuredPath("/admin/entrar")).toBe(false);
    expect(isMeasuredPath("/admin/contatos/12")).toBe(false);
    expect(isMeasuredPath("/")).toBe(true);
    expect(isMeasuredPath("/administracao")).toBe(true);
    expect(isMeasuredPath("/palavra-viva/uma-mensagem")).toBe(true);
  });
});
