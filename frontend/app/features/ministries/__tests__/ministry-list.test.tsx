import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import type { Ministry } from "../api";
import { MinistryList } from "../components/ministry-list";

const ministry = (overrides: Partial<Ministry>): Ministry => ({
  id: 1,
  category: "MINISTERIO",
  name: "Patrimônio",
  description: null,
  leaders_text: null,
  schedule_text: null,
  neighborhood: null,
  contact_phone: null,
  ...overrides,
});

function renderList(items: Ministry[]) {
  const router = createMemoryRouter([{ path: "/", element: <MinistryList items={items} /> }]);
  return render(<RouterProvider router={router} />);
}

describe("MinistryList: liderança", () => {
  it("mostra um cargo por linha, com o cargo em destaque, quando a liderança tem mais de um", async () => {
    renderList([
      ministry({
        leaders_text: "Coordenador: Reynaldo Afonso Chaves · Vice: Carlos Roberto Soares",
      }),
    ]);

    await userEvent.click(screen.getByText("Patrimônio"));
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Liderança", { selector: "strong" })).toBeVisible();
    expect(within(item).getByText("Coordenador:", { selector: "span" })).toBeVisible();
    expect(within(item).getByText("Reynaldo Afonso Chaves")).toBeVisible();
    expect(within(item).getByText("Vice:", { selector: "span" })).toBeVisible();
    expect(within(item).getByText("Carlos Roberto Soares")).toBeVisible();
  });

  it("mostra só os nomes quando não há cargo, e mantém um único item de lista por ministério", async () => {
    renderList([
      ministry({ id: 2, name: "Oração", leaders_text: "Dirce Rodrigues Pinheiro" }),
      ministry({ id: 3, name: "Música", leaders_text: null }),
    ]);

    await userEvent.click(screen.getByText("Oração"));
    expect(screen.getByText("Dirce Rodrigues Pinheiro")).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("Liderança")).toHaveLength(1);
  });

  it("não quebra o nome do cargo que tem dois-pontos no meio dos nomes", async () => {
    renderList([
      ministry({
        leaders_text: "Cantina: Osileia Felícia de Paulo Pereira e Betânia Cristina S. Dantas",
      }),
    ]);

    await userEvent.click(screen.getByText("Patrimônio"));
    expect(screen.getByText("Cantina:", { selector: "span" })).toBeVisible();
    expect(
      screen.getByText("Osileia Felícia de Paulo Pereira e Betânia Cristina S. Dantas"),
    ).toBeVisible();
  });
});
