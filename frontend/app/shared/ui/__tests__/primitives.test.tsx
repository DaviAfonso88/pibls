import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { BrowserOutdatedNotice } from "../../layout/browser-outdated-notice";
import { Alert, AlertDescription, AlertTitle } from "../alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "../field";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../pagination";
import { Progress, ProgressLabel, ProgressValue } from "../progress";
import { RadioGroup, RadioGroupItem } from "../radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select";
import { Separator } from "../separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { Textarea } from "../textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

// Primitivas do shadcn/ui (Base UI) que as telas vão usar. Os testes conferem o que importa para quem as usa:
// papéis e nomes acessíveis (axe) e o comportamento básico de teclado. O visual vem do design e do Playwright.

describe("Alert e Card", () => {
  it("Alert tem título e descrição acessíveis em todas as variantes", async () => {
    const { container } = render(
      <div>
        {(["default", "info", "warning", "success", "destructive"] as const).map((variant) => (
          <Alert key={variant} variant={variant}>
            <AlertTitle>Aviso {variant}</AlertTitle>
            <AlertDescription>Texto do aviso {variant}.</AlertDescription>
          </Alert>
        ))}
      </div>,
    );

    expect(screen.getAllByRole("alert")).toHaveLength(5);
    await expectNoA11yViolations(container);
  });

  it("Card compõe cabeçalho, conteúdo e rodapé", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Boletim 1234</CardTitle>
          <CardDescription>Domingo, 8 de novembro</CardDescription>
        </CardHeader>
        <CardContent>Resumo do boletim.</CardContent>
        <CardFooter>Rodapé</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Boletim 1234")).toBeVisible();
    await expectNoA11yViolations(container);
  });
});

describe("Formulário: Field, Textarea, RadioGroup, Select", () => {
  it("Field associa rótulo, descrição e erro ao campo", async () => {
    const { container } = render(
      <FieldSet>
        <FieldGroup>
          <Field data-invalid>
            <FieldLabel htmlFor="mensagem">Mensagem</FieldLabel>
            <Textarea id="mensagem" aria-invalid aria-describedby="mensagem-ajuda mensagem-erro" />
            <FieldDescription id="mensagem-ajuda">Conte como podemos ajudar.</FieldDescription>
            <FieldError id="mensagem-erro">
              Escreva sua mensagem (mínimo de 5 caracteres).
            </FieldError>
          </Field>
        </FieldGroup>
      </FieldSet>,
    );
    const textarea = screen.getByLabelText("Mensagem");

    expect(textarea).toBeInvalid();
    expect(textarea).toHaveAccessibleDescription(
      "Conte como podemos ajudar. Escreva sua mensagem (mínimo de 5 caracteres).",
    );
    await userEvent.type(textarea, "Olá");
    expect(textarea).toHaveValue("Olá");
    await expectNoA11yViolations(container);
  });

  it("FieldError junta vários erros numa lista e some quando não há erro", () => {
    const { rerender, container } = render(
      <FieldError errors={[{ message: "Primeiro" }, { message: "Segundo" }]} />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    rerender(<FieldError errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("RadioGroup funciona pelo teclado, com o rótulo de cada opção", async () => {
    const { container } = render(
      <RadioGroup defaultValue="visitante" aria-label="Tipo de contato">
        <Field orientation="horizontal">
          <RadioGroupItem value="visitante" id="tipo-visitante" />
          <FieldLabel htmlFor="tipo-visitante">Sou visitante</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="membro" id="tipo-membro" />
          <FieldLabel htmlFor="tipo-membro">Quero ser membro</FieldLabel>
        </Field>
      </RadioGroup>,
    );

    expect(screen.getByRole("radio", { name: "Sou visitante" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Quero ser membro" }));
    expect(screen.getByRole("radio", { name: "Quero ser membro" })).toBeChecked();
    await expectNoA11yViolations(container);
  });

  it("Select abre pelo teclado e escolhe uma opção", async () => {
    const { container } = render(
      <>
        <span id="grupo-rotulo">Grupo</span>
        <Select defaultValue="promissao">
          <SelectTrigger aria-labelledby="grupo-rotulo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="promissao">Célula Promissão</SelectItem>
              <SelectItem value="centro">Célula Centro</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("promissao");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "Célula Centro" }));
    expect(trigger).toHaveTextContent("centro");
    await expectNoA11yViolations(container);
  });
});

describe("Navegação: Tabs, Pagination, Separator, Progress", () => {
  it("Tabs troca de painel por clique e por seta do teclado", async () => {
    const { container } = render(
      <Tabs defaultValue="dados">
        <TabsList aria-label="Seções">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="dados">Painel de dados</TabsContent>
        <TabsContent value="historico">Painel de histórico</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Painel de dados");
    screen.getByRole("tab", { name: "Dados" }).focus();
    // A seta só move o foco entre as abas; Enter (ou Espaço) as ativa
    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(screen.getByRole("tab", { name: "Histórico" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Painel de histórico");
    await expectNoA11yViolations(container);
  });

  it("Pagination marca a página atual e rotula anterior e próxima em português", async () => {
    const { container } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="?pagina=1" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="?pagina=1">1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="?pagina=2" isActive>
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="?pagina=3" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    expect(screen.getByRole("navigation", { name: "Paginação" })).toBeVisible();
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ir para a página anterior" })).toHaveAttribute(
      "href",
      "?pagina=1",
    );
    expect(screen.getByRole("link", { name: "Ir para a próxima página" })).toHaveAttribute(
      "href",
      "?pagina=3",
    );
    await expectNoA11yViolations(container);
  });

  it("Separator e Progress têm os papéis certos", async () => {
    const { container } = render(
      <div>
        <Separator />
        <Progress value={40}>
          <ProgressLabel>Enviando o PDF</ProgressLabel>
          <ProgressValue />
        </Progress>
      </div>,
    );

    expect(screen.getByRole("progressbar", { name: "Enviando o PDF" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    await expectNoA11yViolations(container);
  });
});

describe("Camadas: Dialog, Sheet, DropdownMenu, Tooltip", () => {
  it("Dialog tem título e descrição e fecha com Esc", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do contato</DialogTitle>
            <DialogDescription>Dados enviados pelo formulário.</DialogDescription>
          </DialogHeader>
          <DialogFooter>Rodapé</DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Detalhes do contato" });
    expect(dialog).toHaveAccessibleDescription("Dados enviados pelo formulário.");
    await expectNoA11yViolations(document.body);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Sheet (menu lateral) tem título acessível", async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Navegação do painel.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    expect(await screen.findByRole("dialog", { name: "Menu" })).toBeVisible();
    await expectNoA11yViolations(document.body);
  });

  it("DropdownMenu abre pelo teclado e lista os itens", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Ações</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Contato</DropdownMenuLabel>
            <DropdownMenuItem>Atribuir</DropdownMenuItem>
            <DropdownMenuItem>Arquivar</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole("button", { name: "Ações" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("menuitem", { name: "Atribuir" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Arquivar" })).toBeVisible();
  });

  it("Tooltip aparece com o foco do teclado", async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Copiar chave</TooltipTrigger>
          <TooltipContent>Copia a chave PIX</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    await userEvent.tab();

    expect(await screen.findByText("Copia a chave PIX")).toBeVisible();
  });
});

describe("BrowserOutdatedNotice", () => {
  it("é HTML puro, sem classe do Tailwind, com o texto e o link para Como chegar", async () => {
    const { container } = render(<BrowserOutdatedNotice />);
    const notice = screen.getByRole("alert");

    expect(notice).toHaveClass("browser-outdated");
    expect(notice.className).toBe("browser-outdated");
    expect(notice).toHaveTextContent(
      "Seu navegador está desatualizado e esta página pode aparecer sem formatação.",
    );
    expect(screen.getByRole("link", { name: "Veja como chegar à igreja" })).toHaveAttribute(
      "href",
      "/como-chegar",
    );
    await expectNoA11yViolations(container);
  });
});
