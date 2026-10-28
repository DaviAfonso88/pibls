import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { photos } from "~/content/photos";
import { Photo } from "../photo";

describe("Photo", () => {
  it("monta o srcset com as quatro larguras em WebP, o tamanho intrínseco e o texto alternativo", () => {
    render(
      <Photo
        photo={photos.welcome}
        sizes="(min-width: 704px) 50vw, 100vw"
        className="aspect-3/2 rounded-2xl"
      />,
    );

    const image = screen.getByRole("img", { name: photos.welcome.alt });
    expect(image).toHaveAttribute("src", "/images/congregacao-acolhida-800.webp");
    expect(image.getAttribute("srcset")).toBe(
      [480, 800, 1200, 1600]
        .map((width) => `/images/congregacao-acolhida-${width}.webp ${width}w`)
        .join(", "),
    );
    expect(image).toHaveAttribute("sizes", "(min-width: 704px) 50vw, 100vw");
    expect(image).toHaveAttribute("width", "1600");
    expect(image).toHaveAttribute("height", "1067");
  });

  it("deixa a foto preguiçosa por padrão e carrega já, com prioridade, a que abre a página", () => {
    const { rerender } = render(
      <Photo photo={photos.worship} sizes="100vw" className="aspect-video rounded-xl" />,
    );
    const lazy = screen.getByRole("img", { name: photos.worship.alt });
    expect(lazy).toHaveAttribute("loading", "lazy");
    expect(lazy).toHaveAttribute("fetchpriority", "auto");

    rerender(<Photo photo={photos.worship} sizes="100vw" priority className="aspect-video" />);
    const eager = screen.getByRole("img", { name: photos.worship.alt });
    expect(eager).toHaveAttribute("loading", "eager");
    expect(eager).toHaveAttribute("fetchpriority", "high");
  });

  it("usa a proporção e o recorte de quem chama", () => {
    const { container } = render(
      <Photo
        photo={photos.prayer}
        sizes="100vw"
        className="aspect-21/9 rounded-2xl"
        imgClassName="object-[50%_35%]"
      />,
    );

    expect(container.firstElementChild).toHaveClass("aspect-21/9", "rounded-2xl", "bg-muted");
    expect(screen.getByRole("img", { name: photos.prayer.alt })).toHaveClass("object-[50%_35%]");
  });
});

describe("fotos do site", () => {
  it("cada foto tem nome de arquivo único e texto alternativo descritivo", () => {
    const entries = Object.values(photos);

    expect(new Set(entries.map((photo) => photo.name)).size).toBe(entries.length);
    for (const photo of entries) expect(photo.alt.length).toBeGreaterThan(20);
  });
});
