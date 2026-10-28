import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { PixCopy, type PixCopyProps } from "../pix-copy";

/*
 * PixCopy (T125; CAP-04): "Chave copiada!" quando copia, e o fallback "toque e segure para copiar" quando o navegador
 * não tem a Clipboard API ou a recusa.
 */

const props: PixCopyProps = {
  value: "20969119000184",
  display: "20.969.119/0001-84",
  caption: "Chave PIX (CNPJ)",
  copyLabel: "Copiar chave",
  copiedLabel: "Chave copiada!",
  hint: "Se preferir, toque e segure a chave para copiar.",
  copiedHint: "Agora é só colar no aplicativo do banco.",
  failedHint: "Não foi possível copiar. Toque e segure a chave para copiar.",
};

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

beforeEach(() => {
  setClipboard(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  window.getSelection()?.removeAllRanges();
});

describe("com Clipboard API", () => {
  it("copia o valor sem máscara e mostra 'Chave copiada!' com a dica de colar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<PixCopy {...props} />);

    expect(screen.getByText("20.969.119/0001-84")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(props.hint);

    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));

    expect(await screen.findByRole("button", { name: "Chave copiada!" })).toBeVisible();
    expect(writeText).toHaveBeenCalledExactlyOnceWith("20969119000184");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Agora é só colar no aplicativo do banco.",
    );
  });

  it("volta ao botão normal depois de alguns segundos", async () => {
    vi.useFakeTimers();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    render(<PixCopy {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole("button", { name: "Chave copiada!" })).toBeVisible();

    await act(() => vi.advanceTimersByTimeAsync(6000));

    expect(screen.getByRole("button", { name: "Copiar chave" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(props.hint);
  });

  it("copiar de novo antes do prazo reinicia a contagem", async () => {
    vi.useFakeTimers();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    render(<PixCopy {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    fireEvent.click(screen.getByRole("button", { name: "Chave copiada!" }));
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(screen.getByRole("button", { name: "Chave copiada!" })).toBeVisible();
  });
});

describe("sem Clipboard API (fallback)", () => {
  it("não copia: seleciona a chave e manda tocar e segurar para copiar", () => {
    render(<PixCopy {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));

    return screen.findByText(props.failedHint).then(() => {
      expect(screen.getByRole("status")).toHaveTextContent(props.failedHint);
      // O botão não diz que copiou
      expect(screen.queryByRole("button", { name: "Chave copiada!" })).toBeNull();
      // A chave ficou selecionada, pronta para o "copiar" do toque e segure
      expect(window.getSelection()?.toString()).toBe("20.969.119/0001-84");
    });
  });

  it("a recusa do navegador (permissão, HTTP) cai no mesmo fallback", async () => {
    setClipboard({
      writeText: vi.fn().mockRejectedValue(new DOMException("negado", "NotAllowedError")),
    });
    render(<PixCopy {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));

    expect(await screen.findByText(props.failedHint)).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar chave" })).toBeVisible();
    expect(window.getSelection()?.toString()).toBe("20.969.119/0001-84");
  });

  it("depois do fallback, uma tentativa que dá certo mostra 'Chave copiada!'", async () => {
    render(<PixCopy {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));
    await screen.findByText(props.failedHint);

    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));

    expect(await screen.findByRole("button", { name: "Chave copiada!" })).toBeVisible();
  });
});

describe("apresentação", () => {
  it("sem `display` mostra o próprio valor, e o texto é selecionável com um toque (select-all)", () => {
    render(<PixCopy {...props} display={undefined} />);

    const text = screen.getByText("20969119000184");
    expect(text).toHaveClass("select-all");
  });

  it("valor longo (Copia e Cola) quebra em qualquer ponto", () => {
    render(<PixCopy {...props} value="00020126" display={undefined} long />);

    expect(screen.getByText("00020126")).toHaveClass("break-all");
  });

  it("não tem violação de acessibilidade em nenhum estado", async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    const { container } = render(<PixCopy {...props} />);
    await expectNoA11yViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Copiar chave" }));
    await screen.findByRole("button", { name: "Chave copiada!" });
    await expectNoA11yViolations(container);
  });

  it("o aviso é anunciado (role status) e o ícone é decorativo", () => {
    const { container } = render(<PixCopy {...props} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
