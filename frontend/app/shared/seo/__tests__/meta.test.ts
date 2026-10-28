import { describe, expect, it } from "vitest";
import { absoluteUrl, pageMeta } from "../meta";
import { pageTitle } from "../title";

describe("pageTitle", () => {
  it("usa o nome completo da igreja sem título, e `Título — PIBLS` com título", () => {
    expect(pageTitle()).toBe("Primeira Igreja Batista em Lagoa Santa");
    expect(pageTitle("Quem somos")).toBe("Quem somos — PIBLS");
  });
});

describe("pageMeta", () => {
  const meta = pageMeta({
    title: "Como chegar",
    description: "Endereço e mapa.",
    path: "/como-chegar",
  });
  const content = (key: string) =>
    meta.find(
      (entry) =>
        ("property" in entry && entry.property === key) || ("name" in entry && entry.name === key),
    );

  it("FR-008 traz título, descrição e Open Graph próprios da página", () => {
    expect(meta[0]).toEqual({ title: "Como chegar — PIBLS" });
    expect(content("description")).toEqual({ name: "description", content: "Endereço e mapa." });
    expect(content("og:title")).toEqual({ property: "og:title", content: "Como chegar — PIBLS" });
    expect(content("og:description")).toEqual({
      property: "og:description",
      content: "Endereço e mapa.",
    });
    expect(content("og:type")).toEqual({ property: "og:type", content: "website" });
    expect(content("og:locale")).toEqual({ property: "og:locale", content: "pt_BR" });
  });

  it("usa URL absoluta no domínio do site para a página e para a imagem", () => {
    expect(content("og:url")).toEqual({
      property: "og:url",
      content: "https://pibls.com/como-chegar",
    });
    expect(content("og:image")).toEqual({
      property: "og:image",
      content: "https://pibls.com/og-default.png",
    });
  });

  it("aceita imagem própria e mantém URL absoluta como veio", () => {
    expect(
      pageMeta({ description: "x", path: "/", image: "/uploads/eventos/2026/a.webp" }).find(
        (entry) => "property" in entry && entry.property === "og:image",
      ),
    ).toEqual({ property: "og:image", content: "https://pibls.com/uploads/eventos/2026/a.webp" });
    expect(absoluteUrl("https://i.ytimg.com/vi/x/hq.jpg")).toBe("https://i.ytimg.com/vi/x/hq.jpg");
  });

  it("só marca noindex quando pedido", () => {
    expect(meta).not.toContainEqual({ name: "robots", content: "noindex" });
    expect(pageMeta({ description: "x", path: "/x", noindex: true })).toContainEqual({
      name: "robots",
      content: "noindex",
    });
  });
});
