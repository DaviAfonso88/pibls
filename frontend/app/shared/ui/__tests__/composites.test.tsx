import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { ConfirmDialog } from "../confirm-dialog";
import { ConsentCheckbox } from "../consent-checkbox";
import { DataTable, type DataTableColumn } from "../data-table";
import { DatePicker } from "../date-picker";
import { EmptyState } from "../empty-state";
import { ErrorState, StaleNotice } from "../error-state";
import { FileDrop } from "../file-drop";
import { FieldLabel } from "../field";
import { Honeypot } from "../honeypot";
import { PhoneInput } from "../phone-input";
import { StatusBadge } from "../status-badge";

describe("EmptyState", () => {
  it("mostra o título, a descrição e a ação", async () => {
    const { container } = render(
      <EmptyState
        title="Nenhum boletim publicado ainda."
        description="Quando houver um, ele aparece aqui."
        action={<a href="/admin/boletins/novo">Criar o primeiro boletim</a>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Nenhum boletim publicado ainda." })).toBeVisible();
    expect(screen.getByText("Quando houver um, ele aparece aqui.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Criar o primeiro boletim" })).toBeVisible();
    await expectNoA11yViolations(container);
  });

  it("usa o texto padrão quando não recebe título", () => {
    render(<EmptyState />);

    expect(screen.getByRole("heading", { name: "Nada por aqui ainda." })).toBeVisible();
  });
});

describe("ErrorState", () => {
  it("anuncia o erro e deixa tentar de novo", async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <ErrorState
        message="Não foi possível conectar. Verifique sua internet e tente de novo."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível conectar.");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(container);
  });

  it("oferece o WhatsApp numa nova aba, avisando quem usa leitor de tela", async () => {
    const { container } = render(
      <ErrorState
        message="O site está com instabilidade."
        whatsappUrl="https://wa.me/5531999998888"
      />,
    );

    const link = screen.getByRole("link", { name: /Falar no WhatsApp/ });
    expect(link).toHaveAttribute("href", "https://wa.me/5531999998888");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAccessibleName("Falar no WhatsApp (abre em nova aba)");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("trava o botão enquanto tenta de novo", () => {
    render(<ErrorState message="Falhou." onRetry={vi.fn()} retrying />);

    expect(screen.getByRole("button", { name: "Carregando…" })).toBeDisabled();
  });
});

describe("StaleNotice", () => {
  it("FR-011 mostra o aviso de dado possivelmente desatualizado", async () => {
    const { container } = render(<StaleNotice />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Algumas informações podem estar desatualizadas.",
    );
    await expectNoA11yViolations(container);
  });
});

describe("StatusBadge", () => {
  it("diz o estado em texto, não só na cor", async () => {
    const { container } = render(
      <ul>
        <li>
          <StatusBadge tone="success">Publicado</StatusBadge>
        </li>
        <li>
          <StatusBadge tone="warning">Agendado</StatusBadge>
        </li>
        <li>
          <StatusBadge tone="danger">Encerrado</StatusBadge>
        </li>
        <li>
          <StatusBadge>Rascunho</StatusBadge>
        </li>
      </ul>,
    );

    expect(screen.getByText("Publicado")).toBeVisible();
    expect(screen.getByText("Agendado")).toBeVisible();
    expect(screen.getByText("Encerrado")).toBeVisible();
    expect(screen.getByText("Rascunho")).toBeVisible();
    await expectNoA11yViolations(container);
  });
});

describe("ConfirmDialog", () => {
  function Harness({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <p data-testid="estado">{open ? "aberto" : "fechado"}</p>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Excluir o boletim 1234?"
          description="Esta exclusão é definitiva e não pode ser desfeita. Confirmar?"
          confirmLabel="Excluir"
          destructive
          onConfirm={onConfirm}
        />
      </>
    );
  }

  it("pede confirmação com título e descrição acessíveis", async () => {
    render(<Harness onConfirm={vi.fn()} />);

    const dialog = await screen.findByRole("alertdialog", { name: "Excluir o boletim 1234?" });
    expect(dialog).toHaveAccessibleDescription(/definitiva/);
    await expectNoA11yViolations(document.body);
  });

  it("confirma e fecha", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("fechado"));
  });

  it("cancelar não executa a ação", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("fechado"));
  });

  it("trava os botões enquanto a ação assíncrona não termina", async () => {
    let finish: () => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness onConfirm={onConfirm} />);

    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    expect(screen.getByRole("button", { name: "Excluir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByTestId("estado")).toHaveTextContent("aberto");

    finish();
    await waitFor(() => expect(screen.getByTestId("estado")).toHaveTextContent("fechado"));
  });

  it("continua aberto quando a ação falha, para tentar de novo", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("falhou"));
    render(<Harness onConfirm={onConfirm} />);

    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Excluir" })).toBeEnabled());
    expect(screen.getByTestId("estado")).toHaveTextContent("aberto");
  });
});

interface Contato {
  id: number;
  nome: string;
  tipo: string;
  recebidoEm: string;
}

const contatos: Contato[] = [
  { id: 1, nome: "Maria Souza", tipo: "Visitante", recebidoEm: "08/11/2026" },
  { id: 2, nome: "João Lima", tipo: "Oração", recebidoEm: "07/11/2026" },
];

const colunas: DataTableColumn<Contato>[] = [
  { id: "nome", header: "Nome", cell: (contato) => contato.nome },
  { id: "tipo", header: "Tipo", cell: (contato) => contato.tipo },
  { id: "data", header: "Recebido em", cell: (contato) => contato.recebidoEm, align: "end" },
];

describe("DataTable", () => {
  it("monta a tabela e a lista de cartões a partir das mesmas colunas", async () => {
    const { container } = render(
      <DataTable
        caption="Contatos recebidos"
        columns={colunas}
        rows={contatos}
        getRowId={(c) => c.id}
      />,
    );

    const table = screen.getByRole("table", { name: "Contatos recebidos" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Nome", "Tipo", "Recebido em"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);

    const cards = screen.getByRole("list", { name: "Contatos recebidos" });
    const first = within(cards).getAllByRole("listitem")[0];
    expect(first).toHaveTextContent("Maria Souza");
    // No cartão a primeira coluna é o título e as outras viram "rótulo: valor"
    expect(within(first as HTMLElement).getByText("Tipo")).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText("Visitante")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("deixa uma coluna de fora dos cartões", () => {
    render(
      <DataTable
        caption="Contatos"
        columns={[
          ...colunas,
          { id: "acoes", header: "Ações", cell: () => "Abrir", hideInCard: true },
        ]}
        rows={contatos}
        getRowId={(c) => c.id}
      />,
    );

    const cards = screen.getByRole("list", { name: "Contatos" });
    expect(within(cards).queryByText("Ações")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Ações")).toBeInTheDocument();
  });

  it("mostra o estado vazio, o padrão ou o informado", () => {
    const { rerender } = render(
      <DataTable caption="Contatos" columns={colunas} rows={[]} getRowId={(c) => c.id} />,
    );
    expect(screen.getByRole("heading", { name: "Nada por aqui ainda." })).toBeVisible();

    rerender(
      <DataTable
        caption="Contatos"
        columns={colunas}
        rows={[]}
        getRowId={(c) => c.id}
        empty={<EmptyState title="Nenhum contato recebido." />}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nenhum contato recebido." })).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mostra o carregamento sem tabela", async () => {
    const { container } = render(
      <DataTable caption="Contatos" columns={colunas} rows={[]} getRowId={(c) => c.id} isLoading />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Carregando o conteúdo");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("PhoneInput", () => {
  it("BR-004 aplica a máscara enquanto digita", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <>
        <label htmlFor="telefone">Telefone</label>
        <PhoneInput id="telefone" name="phone" onChange={onChange} />
      </>,
    );
    const input = screen.getByLabelText("Telefone");

    await userEvent.type(input, "31999998888");

    expect(input).toHaveValue("(31) 99999-8888");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: "(31) 99999-8888" }) }),
    );
    expect(input).toHaveAttribute("type", "tel");
    expect(input).toHaveAttribute("inputmode", "tel");
    expect(input).toHaveAttribute("autocomplete", "tel");
    await expectNoA11yViolations(container);
  });

  it("aceita colar com +55", async () => {
    render(
      <>
        <label htmlFor="telefone">Telefone</label>
        <PhoneInput id="telefone" />
      </>,
    );
    const input = screen.getByLabelText("Telefone");

    await userEvent.click(input);
    await userEvent.paste("+55 31 3688-1234");

    expect(input).toHaveValue("(31) 3688-1234");
  });
});

describe("ConsentCheckbox", () => {
  function Harness({ error }: { error?: string }) {
    const [checked, setChecked] = useState(false);
    return (
      <ConsentCheckbox
        id="consent"
        name="consent"
        checked={checked}
        onCheckedChange={setChecked}
        error={error}
      />
    );
  }

  it("BR-001 nasce desmarcada, marca pelo texto e leva à política em nova aba", async () => {
    const { container } = render(<Harness />);
    const checkbox = screen.getByRole("checkbox", {
      name: /Li e concordo com a Política de Privacidade/,
    });

    expect(checkbox).not.toBeChecked();
    await userEvent.click(screen.getByText(/Li e concordo com a/));
    expect(checkbox).toBeChecked();

    const link = screen.getByRole("link", { name: /Política de Privacidade/ });
    expect(link).toHaveAttribute("href", "/privacidade");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    await expectNoA11yViolations(container);
  });

  it("mostra o erro associado à caixa", async () => {
    const { container } = render(
      <Harness error="Para enviar, você precisa concordar com a Política de Privacidade." />,
    );
    const checkbox = screen.getByRole("checkbox");

    expect(checkbox).toBeInvalid();
    expect(checkbox).toHaveAccessibleDescription(
      "Para enviar, você precisa concordar com a Política de Privacidade.",
    );
    await expectNoA11yViolations(container);
  });
});

describe("Honeypot", () => {
  it("BR-002 fica fora do alcance de pessoas e leitores de tela, com o nome que o servidor espera", async () => {
    const { container } = render(
      <form>
        <Honeypot />
      </form>,
    );
    const input = container.querySelector("input");

    expect(input).toHaveAttribute("name", "website");
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveValue("");
    expect(input?.closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("DatePicker", () => {
  it("usa o seletor nativo de data, em português", async () => {
    const { container } = render(
      <>
        <label htmlFor="inicio">Início</label>
        <DatePicker id="inicio" name="starts_at" mode="datetime-local" />
      </>,
    );
    const input = screen.getByLabelText("Início");

    expect(input).toHaveAttribute("type", "datetime-local");
    expect(input).toHaveAttribute("lang", "pt-BR");
    await userEvent.type(input, "2026-11-08T10:10");
    expect(input).toHaveValue("2026-11-08T10:10");
    await expectNoA11yViolations(container);
  });

  it("é só de data por padrão", () => {
    render(
      <>
        <label htmlFor="dia">Dia</label>
        <DatePicker id="dia" />
      </>,
    );

    expect(screen.getByLabelText("Dia")).toHaveAttribute("type", "date");
  });
});

describe("FileDrop", () => {
  const pdf = (name = "boletim.pdf", size = 1024) =>
    new File([new Uint8Array(size)], name, { type: "application/pdf" });

  function Harness({ maxBytes = 10 * 1024 * 1024, error }: { maxBytes?: number; error?: string }) {
    const [file, setFile] = useState<File | null>(null);
    return (
      <FileDrop
        id="pdf"
        label="Arquivo do boletim (PDF)"
        hint="PDF de até 10 MB."
        accept={["application/pdf"]}
        maxBytes={maxBytes}
        file={file}
        onFileChange={setFile}
        typeMessage="O arquivo precisa ser um PDF."
        sizeMessage="O PDF pode ter no máximo 10 MB."
        error={error}
      />
    );
  }

  function fileInput(container: HTMLElement): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("input[type=file]");
    if (!input) throw new Error("campo de arquivo não encontrado");
    return input;
  }

  it("escolhe um PDF válido e mostra nome e tamanho", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.upload(fileInput(container), pdf("boletim-1234.pdf", 1_843_200));

    expect(screen.getByText("boletim-1234.pdf")).toBeVisible();
    expect(screen.getByText("(1,8 MB)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Trocar arquivo" })).toBeVisible();
    await expectNoA11yViolations(container);
  });

  it("BR-041 recusa o que não é PDF", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<Harness />);

    await user.upload(fileInput(container), new File(["x"], "foto.png", { type: "image/png" }));

    expect(screen.getByRole("alert")).toHaveTextContent("O arquivo precisa ser um PDF.");
    expect(screen.queryByText("foto.png")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("BR-041 recusa PDF acima do limite", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness maxBytes={2048} />);

    await user.upload(fileInput(container), pdf("grande.pdf", 4096));

    expect(screen.getByRole("alert")).toHaveTextContent("O PDF pode ter no máximo 10 MB.");
    expect(screen.queryByText("grande.pdf")).not.toBeInTheDocument();
  });

  it("remove o arquivo escolhido e limpa o erro", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.upload(fileInput(container), pdf("boletim.pdf"));
    await user.click(screen.getByRole("button", { name: "Remover arquivo: boletim.pdf" }));

    expect(screen.queryByText("boletim.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher arquivo" })).toBeVisible();
  });

  it("aceita arrastar o arquivo para a área", () => {
    const { container } = render(<Harness />);
    const zone = screen.getByRole("button", { name: "Escolher arquivo" })
      .parentElement as HTMLElement;

    const file = pdf("arrastado.pdf");
    zone.dispatchEvent(
      Object.assign(new Event("drop", { bubbles: true, cancelable: true }), {
        dataTransfer: { files: [file] },
      }),
    );

    return waitFor(() => expect(container).toHaveTextContent("arrastado.pdf"));
  });

  it("mostra o erro que veio do formulário", async () => {
    const { container } = render(<Harness error="O arquivo é obrigatório." />);

    expect(screen.getByRole("alert")).toHaveTextContent("O arquivo é obrigatório.");
    expect(
      screen.getByRole("group", { name: "Arquivo do boletim (PDF)" }),
    ).toHaveAccessibleDescription("PDF de até 10 MB. O arquivo é obrigatório.");
    await expectNoA11yViolations(container);
  });
});

describe("rótulo de campo com FieldLabel", () => {
  it("associa o rótulo ao campo de telefone", () => {
    render(
      <>
        <FieldLabel htmlFor="tel">Telefone</FieldLabel>
        <PhoneInput id="tel" />
      </>,
    );

    expect(screen.getByLabelText("Telefone")).toBeInTheDocument();
  });
});
