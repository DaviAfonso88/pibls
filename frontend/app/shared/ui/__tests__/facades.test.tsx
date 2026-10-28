import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { MapFacade, isAllowedMapEmbed } from "../map-facade";
import { SanitizedHtml } from "../sanitized-html";
import { YouTubeFacade, isYoutubeVideoId } from "../youtube-facade";

const EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12";

describe("MapFacade", () => {
  it("mostra só o botão, e o iframe do Google só nasce depois do toque", async () => {
    const { container } = render(<MapFacade embedUrl={EMBED} />);

    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("O mapa é carregado só quando você pede.")).toBeVisible();
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("button", { name: "Mostrar o mapa" }));

    const frame = container.querySelector("iframe");
    expect(frame).toHaveAttribute("src", EMBED);
    expect(frame).toHaveAttribute("title", "Mapa com a localização da igreja");
    expect(screen.queryByRole("button", { name: "Mostrar o mapa" })).not.toBeInTheDocument();
  });

  it.each([
    null,
    undefined,
    "",
    "javascript:alert(1)",
    "http://www.google.com/maps/embed",
    "https://evil.example.com/maps/embed",
    "https://www.google.com/search?q=x",
    // links comuns do Maps: o Google recusa abrir num quadro
    "https://www.google.com/maps/search/?api=1&query=Rua+Jair+Gon%C3%A7alves+Bastos",
    "https://www.google.com/maps/place/Lagoa+Santa",
    "https://www.google.com/maps?q=Lagoa+Santa",
    "não é url",
  ])("não renderiza nada com o endereço %s", (url) => {
    const { container } = render(<MapFacade embedUrl={url} />);

    expect(container).toBeEmptyDOMElement();
    expect(isAllowedMapEmbed(url)).toBe(false);
  });

  it("aceita o link de Incorporar um mapa e o de busca com output=embed", () => {
    expect(isAllowedMapEmbed(EMBED)).toBe(true);
    expect(isAllowedMapEmbed("https://www.google.com/maps?q=Lagoa+Santa+MG&output=embed")).toBe(
      true,
    );
  });
});

describe("YouTubeFacade", () => {
  it("mostra a miniatura do ytimg e o iframe nocookie só depois do clique", async () => {
    const { container } = render(
      <YouTubeFacade videoId="dQw4w9WgXcQ" title="Palavra Viva de domingo" />,
    );

    expect(container.querySelector("iframe")).toBeNull();
    const thumb = container.querySelector("img");
    expect(thumb).toHaveAttribute("src", "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(thumb).toHaveAttribute("alt", "");
    expect(thumb).toHaveAttribute("width", "480");
    expect(thumb).toHaveAttribute("height", "360");
    await expectNoA11yViolations(container);

    await userEvent.click(
      screen.getByRole("button", { name: "Assistir ao vídeo: Palavra Viva de domingo" }),
    );

    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0",
    );
    expect(frame).toHaveAttribute("title", "Palavra Viva de domingo");
    // O axe não atravessa o iframe no jsdom; a fachada já foi conferida antes do toque
    expect(container.querySelector("img")).toBeNull();
  });

  it.each([null, undefined, "", "curto", "tem espaço aqui", 'dQw4w9WgXcQ"><script>'])(
    "não renderiza nada com o id %s",
    (id) => {
      const { container } = render(<YouTubeFacade videoId={id} title="x" />);

      expect(container).toBeEmptyDOMElement();
      expect(isYoutubeVideoId(id)).toBe(false);
    },
  );
});

describe("SanitizedHtml", () => {
  it("renderiza o HTML já sanitizado pelo servidor", () => {
    render(
      <SanitizedHtml html="<p>Uma <strong>mensagem</strong> de <a href='/contato'>contato</a>.</p>" />,
    );

    expect(screen.getByText("mensagem").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "contato" })).toHaveAttribute("href", "/contato");
  });
});
