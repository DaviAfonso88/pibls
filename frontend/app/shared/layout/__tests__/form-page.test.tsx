import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LazyForm } from "../form-page";

describe("LazyForm", () => {
  it("o HTML pré-renderizado leva o esqueleto e o aviso, nunca o formulário (sem dado pessoal na URL)", () => {
    const html = renderToString(
      <LazyForm>
        <form aria-label="Ficha">
          <input name="phone" />
        </form>
      </LazyForm>,
    );

    expect(html).not.toContain("<form");
    expect(html).not.toContain('name="phone"');
    expect(html).toContain("<noscript>");
  });

  it("no navegador mostra o formulário", () => {
    render(
      <LazyForm>
        <form aria-label="Ficha" />
      </LazyForm>,
    );

    expect(screen.getByRole("form", { name: "Ficha" })).toBeInTheDocument();
  });
});
