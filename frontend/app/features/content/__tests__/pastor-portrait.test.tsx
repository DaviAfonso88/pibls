import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialsOf, PastorPortrait } from "../components/pastor-portrait";

describe("iniciais do retrato", () => {
  it.each([
    ["Pr. Alan Gefferson de Assunção Taques", "AT"],
    ["Pr Maria Souza", "MS"],
    ["  joão   da   Silva ", "JS"],
    ["Marta", "M"],
    ["", ""],
  ])("%j vira %j", (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe("PastorPortrait", () => {
  it("sem o retrato mostra as iniciais, escondidas do leitor de tela", () => {
    const { container } = render(
      <PastorPortrait portrait={null} name="Pr. Alan Gefferson de Assunção Taques" />,
    );

    expect(screen.getByText("AT")).toBeVisible();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveClass("rounded-full");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("com o retrato mostra a foto quadrada, com srcset, tamanho e texto alternativo", () => {
    render(
      <PastorPortrait
        portrait={{ name: "pastor", alt: "O Pr. Alan sorrindo, de camisa clara." }}
        name="Pr. Alan Gefferson de Assunção Taques"
      />,
    );

    const photo = screen.getByRole("img", { name: "O Pr. Alan sorrindo, de camisa clara." });
    expect(photo).toHaveAttribute("src", "/images/pastor-320.webp");
    expect(photo).toHaveAttribute(
      "srcset",
      "/images/pastor-160.webp 160w, /images/pastor-320.webp 320w, /images/pastor-480.webp 480w",
    );
    expect(photo).toHaveAttribute("width", "480");
    expect(photo).toHaveAttribute("height", "480");
    expect(photo.parentElement).toHaveClass("rounded-full");
    expect(screen.queryByText("AT")).not.toBeInTheDocument();
  });
});
