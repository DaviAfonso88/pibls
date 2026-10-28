import "../../../../test/prosemirror";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { mockAdminDefaults, mockMe, renderAdmin, userFixture } from "../../../../test/admin";
import { resetQueryCache, useSnapshots } from "../../../../test/fixtures";
import { server } from "../../../../test/server";

/*
 * Ministérios, grupos e células no painel (CAP-16; design: AdminMinisterios). BR-047, BR-048 e BR-049 valem no servidor;
 * aqui se confere o que a tela mostra e manda.
 */

interface Item {
  id: number;
  category: "MINISTERIO" | "GRUPO" | "CELULA";
  name: string;
  description: string | null;
  leaders_text: string | null;
  schedule_text: string | null;
  neighborhood: string | null;
  contact_phone: string | null;
  private_address: string | null;
  contact_email: string | null;
  display_order: number;
  is_active: boolean;
  updated_at: string | null;
  updated_by: { id: number; name: string } | null;
}

function item(overrides: Partial<Item> & Pick<Item, "id" | "name">): Item {
  return {
    category: "MINISTERIO",
    description: null,
    leaders_text: null,
    schedule_text: null,
    neighborhood: null,
    contact_phone: null,
    private_address: null,
    contact_email: null,
    display_order: overrides.id,
    is_active: true,
    updated_at: "2026-10-20T17:30:00Z",
    updated_by: { id: 7, name: "Sara Secretária" },
    ...overrides,
  };
}

const CATALOG: Item[] = [
  item({ id: 1, name: "Comunicação" }),
  item({ id: 2, name: "Música", contact_email: "musica@example.com" }),
  item({ id: 3, name: "Cantina", is_active: false }),
  item({ id: 4, category: "GRUPO", name: "Homens", schedule_text: "Último sábado do mês, 20h" }),
  item({
    id: 5,
    category: "CELULA",
    name: "Célula Promissão",
    schedule_text: "Terças, 20h",
    neighborhood: "Promissão",
    private_address: "Rua Secreta, 77",
    contact_email: "celula@example.com",
  }),
];

const SECRETARIA = userFixture("SECRETARIA");
const apiError = (code: string, message: string, status: number, details: object[] = []) =>
  HttpResponse.json({ error: { code, message, details, traceId: "t" } }, { status });

let catalog: Item[];

beforeEach(() => {
  resetQueryCache();
  window.localStorage.clear();
  useSnapshots();
  mockAdminDefaults();
  mockMe(SECRETARIA);
  catalog = CATALOG.map((entry) => ({ ...entry }));
  server.use(
    http.get("*/sanctum/csrf-cookie", () => new HttpResponse(null, { status: 204 })),
    http.get("*/api/admin/ministries", () => HttpResponse.json({ data: catalog })),
  );
});

/** Registra o corpo do PATCH e aplica a mudança no catálogo do teste. */
function capturePatch() {
  const sent: { id: number; body: Record<string, unknown> }[] = [];
  server.use(
    http.patch("*/api/admin/ministries/:id", async ({ request, params }) => {
      const id = Number(params.id);
      const body = (await request.json()) as Record<string, unknown>;
      sent.push({ id, body });
      const index = catalog.findIndex((entry) => entry.id === id);
      catalog[index] = { ...(catalog[index] as Item), ...body } as Item;
      return HttpResponse.json({ data: catalog[index] });
    }),
  );
  return sent;
}

async function openList(path = "/admin/ministerios") {
  const view = renderAdmin(path);
  await screen.findByRole("heading", { level: 1, name: "Ministérios e grupos" });
  // As abas só mostram as contagens depois que o catálogo chegou
  await screen.findByRole("tab", { name: "Ministérios (3)" });
  return view;
}

describe("/admin/ministerios", () => {
  it("lista os ministérios com a contagem de cada aba, os inativos marcados, e é acessível", async () => {
    const { container } = await openList();

    expect(screen.getByRole("tab", { name: "Ministérios (3)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Grupos (1)" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Células (1)" })).toBeVisible();

    const rows = within(screen.getByRole("region", { name: "Lista" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Comunicação"),
      expect.stringContaining("Música"),
      expect.stringContaining("CantinaOculto no site"),
    ]);
    expect(screen.getByRole("switch", { name: "Mostrar Cantina no site" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Mostrar Música no site" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Novo ministério" })).toBeVisible();

    await expectNoA11yViolations(container);
  });

  it("sem ministerios.write mostra a tela de sem acesso", async () => {
    mockMe(userFixture("TESOURARIA"));
    renderAdmin("/admin/ministerios");

    expect(
      await screen.findByRole("heading", { name: "Você não tem acesso a esta área" }),
    ).toBeVisible();
  });

  it("troca de aba, e o botão de novo acompanha a categoria", async () => {
    const user = userEvent.setup();
    await openList();

    await user.click(screen.getByRole("tab", { name: "Células (1)" }));

    expect(await screen.findByRole("button", { name: "Célula Promissão" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nova célula" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Comunicação" })).not.toBeInTheDocument();
  });

  describe("ordem e visibilidade", () => {
    it("liga e desliga o item na hora", async () => {
      const sent = capturePatch();
      const user = userEvent.setup();
      await openList();

      await user.click(screen.getByRole("switch", { name: "Mostrar Cantina no site" }));

      await waitFor(() => expect(sent).toEqual([{ id: 3, body: { is_active: true } }]));
      await waitFor(() =>
        expect(screen.getByRole("switch", { name: "Mostrar Cantina no site" })).toBeChecked(),
      );
    });

    it("sobe um item trocando a ordem com o vizinho", async () => {
      const sent = capturePatch();
      const user = userEvent.setup();
      await openList();

      await user.click(screen.getByRole("button", { name: "Subir Música" }));

      await waitFor(() => expect(sent).toHaveLength(2));
      expect(sent).toEqual(
        expect.arrayContaining([
          { id: 2, body: { display_order: 1 } },
          { id: 1, body: { display_order: 2 } },
        ]),
      );
    });

    it("não deixa subir o primeiro nem descer o último", async () => {
      await openList();

      expect(screen.getByRole("button", { name: "Subir Comunicação" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Descer Cantina" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Descer Comunicação" })).toBeEnabled();
    });

    it("avisa quando não consegue mudar a ordem", async () => {
      server.use(
        http.patch("*/api/admin/ministries/:id", () =>
          apiError("INTERNAL", "Algo deu errado.", 500),
        ),
      );
      const user = userEvent.setup();
      await openList();

      await user.click(screen.getByRole("button", { name: "Descer Comunicação" }));

      expect(
        await screen.findByText("Não foi possível mudar a ordem. Tente de novo."),
      ).toBeVisible();
    });
  });

  describe("formulário", () => {
    it("abre o item escolhido e mostra os campos da equipe (e-mail interno) com o aviso", async () => {
      const user = userEvent.setup();
      await openList();

      await user.click(screen.getByRole("button", { name: "Música" }));

      expect(await screen.findByRole("heading", { level: 2, name: "Editar Música" })).toBeVisible();
      expect(screen.getByLabelText("Nome")).toHaveValue("Música");
      expect(screen.getByLabelText("E-mail interno")).toHaveValue("musica@example.com");
      expect(screen.getByText(/Não aparece no site\. Recebe o aviso/)).toBeVisible();
      // Ministério não tem horário nem endereço da reunião
      expect(screen.queryByLabelText("Dia e hora")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Endereço da reunião")).not.toBeInTheDocument();
    });

    it("a célula mostra bairro, horário e o endereço da reunião (só para a equipe)", async () => {
      await openList("/admin/ministerios/5");

      expect(
        await screen.findByRole("heading", { level: 2, name: "Editar Célula Promissão" }),
      ).toBeVisible();
      expect(screen.getByLabelText("Bairro")).toHaveValue("Promissão");
      expect(screen.getByLabelText("Dia e hora")).toHaveValue("Terças, 20h");
      expect(screen.getByLabelText("Endereço da reunião")).toHaveValue("Rua Secreta, 77");
      expect(screen.getByRole("group", { name: "Só para a equipe" })).toBeVisible();
    });

    it("altera o nome e manda os campos opcionais vazios como null", async () => {
      const sent = capturePatch();
      const user = userEvent.setup();
      await openList("/admin/ministerios/2");
      const name = await screen.findByLabelText("Nome");

      await user.clear(name);
      await user.type(name, "Música e Louvor");
      await user.click(screen.getByRole("button", { name: "Salvar" }));

      expect(await screen.findByText("Salvo.")).toBeVisible();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.id).toBe(2);
      expect(sent[0]?.body).toMatchObject({
        category: "MINISTERIO",
        name: "Música e Louvor",
        contact_email: "musica@example.com",
        schedule_text: null,
        neighborhood: null,
        private_address: null,
      });
    });

    it("BR-049 a célula nova pede dia e hora e o bairro antes de enviar", async () => {
      const posted: unknown[] = [];
      server.use(
        http.post("*/api/admin/ministries", async ({ request }) => {
          posted.push(await request.json());
          return HttpResponse.json({ data: catalog[4] }, { status: 201 });
        }),
      );
      const user = userEvent.setup();
      await openList("/admin/ministerios/novo?tipo=celulas");
      await screen.findByRole("heading", { level: 2, name: "Nova célula" });

      await user.type(screen.getByLabelText("Nome"), "Célula Norte");
      await user.click(screen.getByRole("button", { name: "Salvar" }));

      expect(await screen.findByText("Informe dia e horário.")).toBeVisible();
      expect(screen.getByText("Informe o bairro.")).toBeVisible();
      expect(posted).toHaveLength(0);
    });

    it("BR-049 o grupo novo pede dia e hora, mas não o bairro", async () => {
      const user = userEvent.setup();
      await openList("/admin/ministerios/novo?tipo=grupos");
      await screen.findByRole("heading", { level: 2, name: "Novo grupo" });

      expect(screen.queryByLabelText("Bairro")).not.toBeInTheDocument();
      await user.type(screen.getByLabelText("Nome"), "Casais");
      await user.click(screen.getByRole("button", { name: "Salvar" }));

      expect(await screen.findByText("Informe dia e horário.")).toBeVisible();
    });

    it("cria um ministério, abre o item criado e atualiza a lista", async () => {
      const created = item({ id: 9, name: "Recepção", display_order: 9 });
      server.use(
        http.post("*/api/admin/ministries", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          catalog.push({ ...created, ...body } as Item);
          return HttpResponse.json({ data: catalog.at(-1) }, { status: 201 });
        }),
      );
      const user = userEvent.setup();
      await openList("/admin/ministerios/novo");
      await screen.findByRole("heading", { level: 2, name: "Novo ministério" });

      await user.type(screen.getByLabelText("Nome"), "Recepção");
      await user.click(screen.getByRole("button", { name: "Salvar" }));

      expect(
        await screen.findByRole("heading", { level: 2, name: "Editar Recepção" }),
      ).toBeVisible();
      expect(await screen.findByRole("button", { name: "Recepção" })).toBeVisible();
    });

    it("mostra no campo o erro 422 do servidor", async () => {
      server.use(
        http.patch("*/api/admin/ministries/:id", () =>
          apiError("VALIDATION_ERROR", "Confira os campos destacados.", 422, [
            { field: "contact_email", code: "valid_email", message: "Informe um e-mail válido." },
          ]),
        ),
      );
      const user = userEvent.setup();
      await openList("/admin/ministerios/2");
      await screen.findByLabelText("Nome");

      await user.click(screen.getByRole("button", { name: "Salvar" }));

      expect(await screen.findByText("Informe um e-mail válido.")).toBeVisible();
    });

    it("recusa e-mail e telefone inválidos antes de enviar", async () => {
      const sent = capturePatch();
      const user = userEvent.setup();
      await openList("/admin/ministerios/2");
      const email = await screen.findByLabelText("E-mail interno");

      await user.clear(email);
      await user.type(email, "sem-arroba");
      await user.type(screen.getByLabelText("Telefone de contato (aparece no site)"), "123");
      await user.click(screen.getByRole("button", { name: "Salvar" }));

      expect(await screen.findByText("Informe um e-mail válido.")).toBeVisible();
      expect(screen.getByText("Informe um telefone válido com DDD.")).toBeVisible();
      expect(sent).toHaveLength(0);
    });
  });

  describe("excluir", () => {
    it("pede confirmação, exclui e volta à lista", async () => {
      let deleted = false;
      server.use(
        http.delete("*/api/admin/ministries/:id", () => {
          deleted = true;
          catalog = catalog.filter((entry) => entry.id !== 3);
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const user = userEvent.setup();
      await openList("/admin/ministerios/3");
      await screen.findByRole("heading", { level: 2, name: "Editar Cantina" });

      await user.click(screen.getByRole("button", { name: "Excluir" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Excluir Cantina?" });
      expect(deleted).toBe(false);
      await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

      await waitFor(() => expect(deleted).toBe(true));
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Cantina" })).not.toBeInTheDocument(),
      );
    });

    it("BR-047 um item em uso não é excluído: mostra a frase da regra", async () => {
      server.use(
        http.delete("*/api/admin/ministries/:id", () =>
          apiError(
            "ITEM_IN_USE",
            "Este item está vinculado a eventos, contatos ou usuários. Desative-o em vez de excluir.",
            409,
          ),
        ),
      );
      const user = userEvent.setup();
      await openList("/admin/ministerios/1");
      await screen.findByRole("heading", { level: 2, name: "Editar Comunicação" });

      await user.click(screen.getByRole("button", { name: "Excluir" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

      expect(
        await screen.findByText(
          "Este item está vinculado a eventos, contatos ou usuários. Desative-o em vez de excluir.",
        ),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Comunicação" })).toBeVisible();
    });
  });

  it("um item que não existe mostra o aviso e o caminho de volta", async () => {
    renderAdmin("/admin/ministerios/999");

    expect(await screen.findByText("Este item não existe mais.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Voltar para a lista" })).toBeVisible();
  });
});
