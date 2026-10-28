import "../../../../test/prosemirror";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { pastedHtmlLosesFormatting, RichTextEditor } from "~/shared/ui/rich-text-editor";

/*
 * RichTextEditor (T113; BR-046): só os formatos que o SanitizedHtml do servidor mantém, e aviso quando algo é removido.
 */

function Harness({
  initial = "",
  warning = false,
  onChange,
}: {
  initial?: string;
  warning?: boolean;
  onChange?: (html: string) => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <RichTextEditor
      id="corpo"
      label="Texto da mensagem"
      value={value}
      sanitizationWarning={warning}
      onChange={(html) => {
        setValue(html);
        onChange?.(html);
      }}
    />
  );
}

/** Cola HTML no editor, como o navegador faria ao colar do Word ou do WhatsApp. */
function paste(html: string, text = "") {
  const editor = screen.getByRole("textbox", { name: "Texto da mensagem" });
  fireEvent.paste(editor, {
    clipboardData: {
      types: ["text/html", "text/plain"],
      getData: (type: string) => (type === "text/html" ? html : type === "text/plain" ? text : ""),
      files: [],
      items: [],
    },
  });
}

describe("pastedHtmlLosesFormatting", () => {
  it.each([
    ["<p>Texto <strong>forte</strong> e <em>itálico</em></p>", false],
    ["<h2>Título</h2><ul><li>um</li></ul><blockquote>cita</blockquote>", false],
    ['<p><a href="https://example.com">link</a></p>', false],
    ['<div><span style="color:red">Word cola assim</span></div>', false],
    ['<p>com imagem <img src="https://x.test/a.png"></p>', true],
    ["<table><tr><td>tabela</td></tr></table>", true],
    ["<p>sublinhado <u>aqui</u></p>", true],
    ["<script>alert(1)</script><p>x</p>", true],
    ["<h1>título grande</h1>", true],
  ])("%s → %s", (html, expected) => {
    expect(pastedHtmlLosesFormatting(html)).toBe(expected);
  });
});

describe("RichTextEditor", () => {
  it("é uma área de texto com nome e uma barra de formatação com os 8 formatos permitidos", async () => {
    render(<Harness />);

    expect(await screen.findByRole("textbox", { name: "Texto da mensagem" })).toHaveAttribute(
      "aria-multiline",
      "true",
    );
    const toolbar = screen.getByRole("toolbar", { name: "Formatação" });
    for (const name of [
      "Negrito",
      "Itálico",
      "Título",
      "Subtítulo",
      "Lista com marcadores",
      "Lista numerada",
      "Citação",
      "Link",
    ]) {
      const button = await screen.findByRole("button", { name });
      expect(toolbar).toContainElement(button);
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("abre com o HTML recebido e não oferece o que o servidor removeria", async () => {
    render(
      <Harness initial='<h2>Título</h2><p>Texto <strong>forte</strong>, <em>itálico</em> e <u>sublinhado</u> com <img src="https://x.test/a.png"></p>' />,
    );

    const editor = await screen.findByRole("textbox", { name: "Texto da mensagem" });
    expect(editor.querySelector("h2")).toHaveTextContent("Título");
    expect(editor.querySelector("strong")).toHaveTextContent("forte");
    expect(editor.querySelector("em")).toHaveTextContent("itálico");
    // Sublinhado e imagem não existem no esquema do editor
    expect(editor.querySelector("u")).toBeNull();
    expect(editor.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button", { name: /sublinhado|imagem|cor|fonte/i })).toBeNull();
  });

  it("devolve o HTML a cada alteração e string vazia quando não sobra texto", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const editor = await screen.findByRole("textbox", { name: "Texto da mensagem" });

    paste("<p>Paz</p>", "Paz");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("<p>Paz</p>"));

    fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
    fireEvent.keyDown(editor, { key: "Backspace", code: "Backspace" });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(""));
  });

  it("BR-046 cor, fonte e imagem colados saem, o texto fica e o aviso aparece", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await screen.findByRole("textbox", { name: "Texto da mensagem" });

    paste(
      '<p style="color:red;font-family:Arial">Colado <b>do Word</b></p><img src="https://x.test/a.png"><table><tr><td>tabela</td></tr></table>',
      "Colado do Word tabela",
    );

    const alert = await screen.findByText("Parte da formatação não é permitida e foi removida.");
    expect(alert).toBeVisible();

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.lastCall?.[0] as string;
    expect(html).toContain("Colado");
    expect(html).not.toMatch(/style=|<img|<table|font-family|color:red/);
  });

  it("colar só texto formatado com o que é permitido não gera aviso", async () => {
    render(<Harness />);
    await screen.findByRole("textbox", { name: "Texto da mensagem" });

    paste("<p>Texto <strong>forte</strong></p>", "Texto forte");

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Texto da mensagem" })).toHaveTextContent(
        "Texto forte",
      ),
    );
    expect(screen.queryByText("Parte da formatação não é permitida e foi removida.")).toBeNull();
  });

  it("BR-046 mostra o aviso que o servidor mandou (sanitization_warning)", async () => {
    render(<Harness warning />);

    expect(
      await screen.findByText("Parte da formatação não é permitida e foi removida."),
    ).toBeVisible();
  });

  it("o link só aceita http, https ou mailto, e o campo recebe o foco", async () => {
    const user = userEvent.setup();
    render(<Harness initial="<p>Visite o site</p>" />);

    await user.click(await screen.findByRole("button", { name: "Link" }));
    const field = await screen.findByLabelText("Endereço do link");
    await waitFor(() => expect(field).toHaveFocus());

    await user.type(field, "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(
      await screen.findByText("Use um endereço que comece com http://, https:// ou mailto:."),
    ).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByLabelText("Endereço do link")).toBeNull());
  });

  it("acompanha o valor que muda de fora (rascunho restaurado)", async () => {
    function Restorable() {
      const [value, setValue] = useState("");
      return (
        <>
          <button type="button" onClick={() => setValue("<p>Texto restaurado</p>")}>
            restaurar
          </button>
          <RichTextEditor id="corpo" label="Texto da mensagem" value={value} onChange={setValue} />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Restorable />);
    await screen.findByRole("textbox", { name: "Texto da mensagem" });

    await user.click(screen.getByRole("button", { name: "restaurar" }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Texto da mensagem" })).toHaveTextContent(
        "Texto restaurado",
      ),
    );
  });
});
