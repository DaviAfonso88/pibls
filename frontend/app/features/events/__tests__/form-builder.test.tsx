import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import type { ApiFormField } from "../admin-api";
import { FormBuilder } from "../components/admin/form-builder";
import {
  breakingKeys,
  fieldsFromApi,
  fieldsToInput,
  keyFromLabel,
  type FieldDraft,
} from "../event-model";

/*
 * O construtor do formulário de inscrição (T171; design: AdminEvento): adicionar, ordenar, opções (BR-031), o marcador de
 * dado de saúde (ADR-020) e a confirmação de remover ou trocar o tipo de uma pergunta com inscrições (BR-029).
 */

const camiseta: ApiFormField = {
  key: "camiseta",
  label: "Tamanho da camiseta",
  type: "SELECT",
  required: true,
  help_text: null,
  sensitive: false,
  min: null,
  max: null,
  options: ["P", "M", "G"],
};

const alergias: ApiFormField = {
  key: "alergias",
  label: "Alergias",
  type: "TEXT",
  required: false,
  help_text: "Conte o que for importante",
  sensitive: true,
  min: null,
  max: null,
  options: null,
};

function Builder({
  saved = [],
  registrations = 0,
  onBreakingChange = () => undefined,
  onFields,
}: {
  saved?: readonly ApiFormField[];
  registrations?: number;
  onBreakingChange?: () => void;
  onFields?: (fields: FieldDraft[]) => void;
}) {
  const [fields, setFields] = useState<FieldDraft[]>(() => fieldsFromApi(saved));

  return (
    <FormBuilder
      fields={fields}
      onChange={(next) => {
        setFields(next);
        onFields?.(next);
      }}
      savedFields={saved}
      registrations={registrations}
      onBreakingChange={onBreakingChange}
    />
  );
}

const questions = () => screen.queryAllByRole("textbox", { name: /^Pergunta/ });

describe("adicionar e preencher perguntas", () => {
  it("começa sem perguntas extras, mostrando o que o formulário sempre pede", () => {
    render(<Builder />);

    const fixed = screen.getByRole("list", { name: "Campos que o formulário sempre pede" });
    expect(
      within(fixed)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Nome completoSempre pedido · obrigatório",
      "WhatsAppSempre pedido · obrigatório",
      "E-mailSempre pedido · opcional",
    ]);
    expect(screen.getByText(/Nenhuma pergunta extra/)).toBeVisible();
    expect(screen.getByText("0 de 30 perguntas")).toBeVisible();
    expect(questions()).toHaveLength(0);
  });

  it("acrescenta uma pergunta e leva o foco para o campo da pergunta", async () => {
    const user = userEvent.setup();
    render(<Builder />);

    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));

    const label = screen.getByRole("textbox", { name: "Pergunta" });
    expect(label).toHaveFocus();
    expect(screen.getByText("1 de 30 perguntas")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Tipo de resposta" })).toHaveValue("TEXT");
    expect(screen.getByRole("checkbox", { name: "Obrigatória" })).not.toBeChecked();
  });

  it("BR-031 para em 30 perguntas e explica o limite", async () => {
    const user = userEvent.setup();
    render(<Builder />);
    const add = screen.getByRole("button", { name: "Adicionar pergunta" });

    for (let index = 0; index < 30; index += 1) await user.click(add);

    expect(screen.getAllByRole("group", { name: /^Pergunta \d+ de 30$/ })).toHaveLength(30);
    expect(add).toBeDisabled();
    expect(screen.getByText("O formulário chegou ao limite de 30 perguntas.")).toBeVisible();
  });

  it("mostra as opções (uma por linha) só para escolha de lista, e o mínimo e o máximo só para número", async () => {
    const user = userEvent.setup();
    render(<Builder />);
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    const type = screen.getByRole("combobox", { name: "Tipo de resposta" });

    expect(screen.queryByRole("textbox", { name: /Opções/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Valor mínimo/ })).not.toBeInTheDocument();

    await user.selectOptions(type, "SELECT");
    expect(screen.getByRole("textbox", { name: "Opções (uma por linha)" })).toBeVisible();
    expect(screen.getByText("De 2 a 30 opções diferentes.")).toBeVisible();

    await user.selectOptions(type, "MULTISELECT");
    expect(screen.getByRole("textbox", { name: "Opções (uma por linha)" })).toBeVisible();

    await user.selectOptions(type, "NUMBER");
    expect(screen.queryByRole("textbox", { name: /Opções/ })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Valor mínimo/ })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Valor máximo/ })).toBeVisible();

    await user.selectOptions(type, "BOOLEAN");
    expect(screen.queryByRole("textbox", { name: /Valor mínimo/ })).not.toBeInTheDocument();
  });

  it("oferece os sete tipos de resposta, com nomes de gente", async () => {
    const user = userEvent.setup();
    render(<Builder />);
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));

    const options = within(screen.getByRole("combobox", { name: "Tipo de resposta" })).getAllByRole(
      "option",
    );

    expect(options.map((option) => option.textContent)).toEqual([
      "Texto curto",
      "Texto longo",
      "Número",
      "Data",
      "Escolha uma opção",
      "Escolha várias opções",
      "Sim ou não",
    ]);
  });

  it("ADR-020 marcar uma pergunta como informação de saúde avisa que o formulário vai pedir autorização", async () => {
    const user = userEvent.setup();
    render(<Builder />);
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));

    expect(screen.queryByText(/autorização específica/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "É informação de saúde" }));

    expect(screen.getByRole("note")).toHaveTextContent(
      /autorização específica, num segundo aceite/,
    );

    await user.click(screen.getByRole("checkbox", { name: "É informação de saúde" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("uma pergunta que já vem do servidor aparece marcada como saúde e com a dica", () => {
    render(<Builder saved={[alergias]} />);

    expect(screen.getByRole("checkbox", { name: "É informação de saúde" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /Dica para quem responde/ })).toHaveValue(
      "Conte o que for importante",
    );
    expect(screen.getByRole("note")).toBeVisible();
  });
});

describe("ordenar perguntas", () => {
  it("sobe e desce com botões, na ordem do formulário, e o foco acompanha a pergunta movida", async () => {
    const user = userEvent.setup();
    const onFields = vi.fn();
    render(<Builder saved={[camiseta, alergias]} onFields={onFields} />);

    expect(questions().map((field) => (field as HTMLInputElement).value)).toEqual([
      "Tamanho da camiseta",
      "Alergias",
    ]);
    expect(
      screen.getByRole("button", { name: "Mover a pergunta Tamanho da camiseta para cima" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mover a pergunta Alergias para baixo" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Mover a pergunta Tamanho da camiseta para baixo" }),
    );

    expect(questions().map((field) => (field as HTMLInputElement).value)).toEqual([
      "Alergias",
      "Tamanho da camiseta",
    ]);
    expect(onFields.mock.lastCall?.[0].map((field: FieldDraft) => field.key)).toEqual([
      "alergias",
      "camiseta",
    ]);
    // Na ponta da lista o botão "para baixo" fica desabilitado; o foco vai para "para cima", que ainda move a pergunta
    expect(
      screen.getByRole("button", { name: "Mover a pergunta Tamanho da camiseta para cima" }),
    ).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Pergunta 2 de 2");

    await user.click(
      screen.getByRole("button", { name: "Mover a pergunta Tamanho da camiseta para cima" }),
    );

    expect(questions().map((field) => (field as HTMLInputElement).value)).toEqual([
      "Tamanho da camiseta",
      "Alergias",
    ]);
  });

  it("mantém o que foi digitado em cada pergunta ao reordenar", async () => {
    const user = userEvent.setup();
    render(<Builder saved={[camiseta, alergias]} />);

    await user.click(screen.getByRole("button", { name: "Mover a pergunta Alergias para cima" }));

    const [first] = screen.getAllByRole("group", { name: /^Pergunta \d+ de \d+$/ });
    expect(
      within(first as HTMLElement).getByRole("textbox", { name: /Dica para quem responde/ }),
    ).toHaveValue("Conte o que for importante");
    expect(
      within(first as HTMLElement).getByRole("combobox", { name: "Tipo de resposta" }),
    ).toHaveValue("TEXT");
  });
});

describe("remover perguntas", () => {
  it("remove uma pergunta nova sem perguntar e avisa o leitor de tela", async () => {
    const user = userEvent.setup();
    render(<Builder />);
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.type(screen.getByRole("textbox", { name: "Pergunta" }), "Cidade");

    await user.click(screen.getByRole("button", { name: "Remover a pergunta Cidade" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(questions()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Pergunta Cidade removida.");
  });

  it("sem inscrições, remove uma pergunta já salva sem confirmar", async () => {
    const user = userEvent.setup();
    const onBreakingChange = vi.fn();
    render(
      <Builder
        saved={[camiseta, alergias]}
        registrations={0}
        onBreakingChange={onBreakingChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remover a pergunta Alergias" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(questions()).toHaveLength(1);
    expect(onBreakingChange).not.toHaveBeenCalled();
  });

  it("BR-029 com inscrições, remover uma pergunta que já existe pede confirmação; cancelar mantém a pergunta", async () => {
    const user = userEvent.setup();
    const onBreakingChange = vi.fn();
    render(
      <Builder
        saved={[camiseta, alergias]}
        registrations={3}
        onBreakingChange={onBreakingChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remover a pergunta Alergias" }));

    const dialog = screen.getByRole("alertdialog", { name: 'Remover a pergunta "Alergias"?' });
    expect(dialog).toHaveTextContent(
      "Este campo já tem respostas. As respostas existentes serão mantidas com o rótulo atual. Confirmar?",
    );

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(questions()).toHaveLength(2);
    expect(onBreakingChange).not.toHaveBeenCalled();
  });

  it("BR-029 confirmar remove a pergunta e avisa o formulário, que passa a enviar confirm_schema_change", async () => {
    const user = userEvent.setup();
    const onBreakingChange = vi.fn();
    render(
      <Builder
        saved={[camiseta, alergias]}
        registrations={3}
        onBreakingChange={onBreakingChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remover a pergunta Alergias" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover pergunta" }),
    );

    expect(questions().map((field) => (field as HTMLInputElement).value)).toEqual([
      "Tamanho da camiseta",
    ]);
    expect(onBreakingChange).toHaveBeenCalledTimes(1);
  });

  it("BR-029 uma pergunta nova (sem chave salva) sai sem confirmar, mesmo com inscrições", async () => {
    const user = userEvent.setup();
    render(<Builder saved={[camiseta]} registrations={5} />);
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    const [, second] = screen.getAllByRole("group", { name: /^Pergunta \d+ de \d+$/ });

    await user.type(
      within(second as HTMLElement).getByRole("textbox", { name: "Pergunta" }),
      "Nova",
    );
    await user.click(screen.getByRole("button", { name: "Remover a pergunta Nova" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(questions()).toHaveLength(1);
  });
});

describe("trocar o tipo de uma pergunta com respostas", () => {
  it("BR-029 pede confirmação; cancelar mantém o tipo", async () => {
    const user = userEvent.setup();
    const onBreakingChange = vi.fn();
    render(<Builder saved={[alergias]} registrations={2} onBreakingChange={onBreakingChange} />);
    const type = screen.getByRole("combobox", { name: "Tipo de resposta" });

    await user.selectOptions(type, "BOOLEAN");

    const dialog = screen.getByRole("alertdialog", {
      name: 'Trocar o tipo da pergunta "Alergias"?',
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(type).toHaveValue("TEXT");
    expect(onBreakingChange).not.toHaveBeenCalled();
  });

  it("BR-029 confirmar troca o tipo e avisa o formulário", async () => {
    const user = userEvent.setup();
    const onBreakingChange = vi.fn();
    render(<Builder saved={[alergias]} registrations={2} onBreakingChange={onBreakingChange} />);
    const type = screen.getByRole("combobox", { name: "Tipo de resposta" });

    await user.selectOptions(type, "TEXTAREA");
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Trocar o tipo" }),
    );

    expect(type).toHaveValue("TEXTAREA");
    expect(onBreakingChange).toHaveBeenCalledTimes(1);
  });

  it("sem inscrições, troca o tipo direto", async () => {
    const user = userEvent.setup();
    render(<Builder saved={[alergias]} registrations={0} />);
    const type = screen.getByRole("combobox", { name: "Tipo de resposta" });

    await user.selectOptions(type, "NUMBER");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(type).toHaveValue("NUMBER");
  });

  it("voltar ao tipo salvo, ou mudar só o rótulo, não pede confirmação", async () => {
    const user = userEvent.setup();
    const onBreakingChange = vi.fn();
    render(<Builder saved={[alergias]} registrations={2} onBreakingChange={onBreakingChange} />);
    const label = screen.getByRole("textbox", { name: "Pergunta" });

    await user.type(label, " graves");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo de resposta" }), "TEXT");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onBreakingChange).not.toHaveBeenCalled();
  });
});

describe("acessibilidade", () => {
  it("o construtor, com perguntas de cada tipo, não tem violação de acessibilidade (axe)", async () => {
    const { container } = render(<Builder saved={[camiseta, alergias]} registrations={1} />);

    await expectNoA11yViolations(container);
  });
});

describe("modelo das perguntas", () => {
  it("a chave de uma pergunta nova sai do rótulo e nunca repete uma que já existe (BR-031)", () => {
    expect(keyFromLabel("Tamanho da camiseta", new Set())).toBe("tamanho_da_camiseta");
    expect(keyFromLabel("Tamanho da camiseta", new Set(["tamanho_da_camiseta"]))).toBe(
      "tamanho_da_camiseta_2",
    );
    expect(
      keyFromLabel(
        "Tamanho da camiseta",
        new Set(["tamanho_da_camiseta", "tamanho_da_camiseta_2"]),
      ),
    ).toBe("tamanho_da_camiseta_3");
    expect(keyFromLabel("Você vem de ônibus?", new Set())).toBe("voce_vem_de_onibus");
    expect(keyFromLabel("2ª via", new Set())).toBe("campo_2_via");
    expect(keyFromLabel("???", new Set())).toBe("campo");
    expect(keyFromLabel("a".repeat(80), new Set())).toHaveLength(40);
    expect(keyFromLabel("a".repeat(80), new Set(["a".repeat(40)]))).toMatch(/^a+_2$/);
    expect(keyFromLabel("a".repeat(80), new Set(["a".repeat(40)]))).toHaveLength(40);
  });

  it("converte as perguntas para o formato do servidor, dando chave às novas e descartando o que não vale para o tipo", () => {
    const drafts = fieldsFromApi([camiseta]);
    drafts.push({
      uid: "x",
      key: "",
      label: "  Tamanho   da camiseta ",
      type: "NUMBER",
      required: true,
      help_text: "   ",
      sensitive: false,
      min: "1,5",
      max: "",
      options: "ignorado",
    });

    expect(fieldsToInput(drafts)).toEqual([
      {
        key: "camiseta",
        label: "Tamanho da camiseta",
        type: "SELECT",
        required: true,
        help_text: null,
        sensitive: false,
        min: null,
        max: null,
        options: ["P", "M", "G"],
      },
      {
        key: "tamanho_da_camiseta",
        label: "Tamanho da camiseta",
        type: "NUMBER",
        required: true,
        help_text: null,
        sensitive: false,
        min: 1.5,
        max: null,
        options: null,
      },
    ]);
  });

  it("BR-029 diz quais perguntas salvas o novo formulário removeu ou mudou de tipo", () => {
    const saved = [camiseta, alergias];
    const [shirt, allergies] = fieldsFromApi(saved);
    if (shirt === undefined || allergies === undefined) throw new Error("fixture");

    expect(breakingKeys(saved, [shirt, allergies])).toEqual([]);
    expect(
      breakingKeys(saved, [{ ...shirt, label: "Camiseta", options: "P\nM" }, allergies]),
    ).toEqual([]);
    expect(breakingKeys(saved, [shirt])).toEqual(["alergias"]);
    expect(breakingKeys(saved, [{ ...shirt, type: "MULTISELECT" }, allergies])).toEqual([
      "camiseta",
    ]);
    expect(breakingKeys(saved, [])).toEqual(["camiseta", "alergias"]);
  });
});
