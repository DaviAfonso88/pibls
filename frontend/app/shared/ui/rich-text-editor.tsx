import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  Link2OffIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentType, type SVGProps } from "react";
import { cn } from "~/shared/lib/utils";
import { messages } from "~/shared/messages";
import { ruleMessages } from "~/shared/rule-messages";
import { Alert } from "./alert";
import { Button } from "./button";
import { FieldDescription, FieldError } from "./field";
import { Input } from "./input";
import { editorMessages as text } from "./rich-text-editor-messages";

/**
 * Editor de texto formatado do painel (TipTap 3, restrito). Aceita só o que o `SanitizedHtml` do servidor mantém:
 * negrito, itálico, títulos `h2` e `h3`, listas, citação e link (`http`, `https` ou `mailto`). Cores, fontes, imagens e o
 * resto são removidos já ao colar (o esquema do editor não conhece essas marcações). O servidor sanitiza de novo ao salvar
 * (BR-046) e é ele quem tem a palavra final: a tela só avisa quando algo foi removido.
 *
 * Carregue com `lazy()`: o TipTap pesa e só as telas de edição precisam dele (Frontend → Lazy loading).
 */
export interface RichTextEditorProps {
  id: string;
  /** Rótulo visível, também o nome acessível da área de texto. */
  label: string;
  /** HTML sanitizado (ou vazio). Quando muda de fora (registro carregado, rascunho restaurado), o editor acompanha. */
  value: string;
  /** Recebe o HTML a cada alteração; vazio (`""`) se não há texto. */
  onChange: (html: string) => void;
  hint?: string;
  /** Erro vindo do formulário (ex.: o 422 do servidor). */
  error?: string;
  /** O servidor removeu formatação ao salvar (`sanitization_warning`, BR-046). */
  sanitizationWarning?: boolean;
  disabled?: boolean;
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ALLOWED_LINK = /^(https?:\/\/|mailto:)\S+$/i;

/** Tags que o editor entende. `span` e `div` são só invólucros: o texto de dentro sobrevive, então não contam como perda. */
const KNOWN_TAGS = new Set([
  "P",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "UL",
  "OL",
  "LI",
  "A",
  "BLOCKQUOTE",
  "H2",
  "H3",
  "SPAN",
  "DIV",
  "BODY",
  "HTML",
  "HEAD",
]);

/** O HTML colado tem algo que o editor vai descartar (imagem, tabela, estilo…)? */
export function pastedHtmlLosesFormatting(html: string): boolean {
  const document = new DOMParser().parseFromString(html, "text/html");

  return [...document.documentElement.querySelectorAll("*")].some(
    (element) => !KNOWN_TAGS.has(element.tagName),
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: IconComponent;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Não tira o foco (e a seleção) do texto ao clicar
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  sanitizationWarning = false,
  disabled = false,
}: RichTextEditorProps) {
  const labelId = useId();
  const linkInput = useRef<HTMLInputElement>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const linkErrorId = `${id}-link-error`;
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pasteLost, setPasteLost] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // O que o SanitizedHtml não mantém não existe no editor
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          protocols: ["mailto"],
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
    ],
    content: value,
    editable: !disabled,
    // O painel não é pré-renderizado: pode montar na hora
    immediatelyRender: true,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(hint ? { "aria-describedby": hintId } : {}),
        class:
          "prose max-w-none min-h-72 rounded-b-lg border border-input border-t-0 bg-background px-4 py-3 text-lg focus-visible:outline-3 focus-visible:outline-ring",
      },
      transformPastedHTML(html) {
        if (pastedHtmlLosesFormatting(html)) setPasteLost(true);
        return html;
      },
    },
    onUpdate({ editor: current }) {
      onChange(current.isEmpty ? "" : current.getHTML());
    },
  });

  // Acompanha o valor que vem de fora, sem disparar `onChange` (evita laço)
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (current !== value) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  // Ao abrir o campo do link, o foco vai para ele (sem autoFocus, que o ESLint de acessibilidade proíbe)
  useEffect(() => {
    if (linkOpen) linkInput.current?.focus();
  }, [linkOpen]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      h2: current?.isActive("heading", { level: 2 }) ?? false,
      h3: current?.isActive("heading", { level: 3 }) ?? false,
      bullet: current?.isActive("bulletList") ?? false,
      ordered: current?.isActive("orderedList") ?? false,
      quote: current?.isActive("blockquote") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });

  if (!editor) return null;

  const activeEditor = editor;
  const run = (command: () => boolean) => {
    command();
    editor.commands.focus();
  };

  function openLink() {
    const existing = editor?.getAttributes("link").href;
    setLinkHref(typeof existing === "string" ? existing : "");
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    const href = linkHref.trim();
    if (!ALLOWED_LINK.test(href)) {
      setLinkError(text.linkInvalid);
      return;
    }
    run(() => activeEditor.chain().focus().extendMarkRange("link").setLink({ href }).run());
    setLinkOpen(false);
  }

  function removeLink() {
    run(() => activeEditor.chain().focus().extendMarkRange("link").unsetLink().run());
    setLinkOpen(false);
  }

  const showNotice = sanitizationWarning || pasteLost;

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="font-bold">
        {label}
      </span>

      <div>
        <div
          role="toolbar"
          aria-label={text.toolbar}
          className={cn(
            "flex flex-wrap gap-1 rounded-t-lg border border-input bg-muted p-1.5",
            disabled && "opacity-60",
          )}
        >
          <ToolbarButton
            label={text.bold}
            icon={BoldIcon}
            active={state?.bold}
            disabled={disabled}
            onClick={() => run(() => editor.chain().focus().toggleBold().run())}
          />
          <ToolbarButton
            label={text.italic}
            icon={ItalicIcon}
            active={state?.italic}
            disabled={disabled}
            onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
          />
          <ToolbarButton
            label={text.heading}
            icon={Heading2Icon}
            active={state?.h2}
            disabled={disabled}
            onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          />
          <ToolbarButton
            label={text.subheading}
            icon={Heading3Icon}
            active={state?.h3}
            disabled={disabled}
            onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          />
          <ToolbarButton
            label={text.bulletList}
            icon={ListIcon}
            active={state?.bullet}
            disabled={disabled}
            onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}
          />
          <ToolbarButton
            label={text.orderedList}
            icon={ListOrderedIcon}
            active={state?.ordered}
            disabled={disabled}
            onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}
          />
          <ToolbarButton
            label={text.quote}
            icon={QuoteIcon}
            active={state?.quote}
            disabled={disabled}
            onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())}
          />
          <ToolbarButton
            label={text.link}
            icon={LinkIcon}
            active={state?.link || linkOpen}
            disabled={disabled}
            onClick={openLink}
          />
          {state?.link ? (
            <ToolbarButton
              label={text.removeLink}
              icon={Link2OffIcon}
              disabled={disabled}
              onClick={removeLink}
            />
          ) : null}
        </div>

        {linkOpen ? (
          <div className="flex flex-col gap-2 border-x border-input bg-muted/60 p-3">
            <label htmlFor={`${id}-link`} className="font-bold">
              {text.linkLabel}
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`${id}-link`}
                type="url"
                inputMode="url"
                ref={linkInput}
                placeholder="https://"
                value={linkHref}
                aria-invalid={linkError !== null}
                aria-describedby={linkError ? linkErrorId : undefined}
                className="min-w-60 flex-1"
                onChange={(event) => {
                  setLinkHref(event.target.value);
                  setLinkError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                  if (event.key === "Escape") setLinkOpen(false);
                }}
              />
              <Button type="button" onClick={applyLink}>
                {text.linkApply}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                {messages.common.cancel}
              </Button>
            </div>
            {linkError ? <FieldError id={linkErrorId}>{linkError}</FieldError> : null}
          </div>
        ) : null}

        <EditorContent editor={editor} />
      </div>

      <FieldDescription id={hintId}>{hint ?? text.pasteHint}</FieldDescription>

      {showNotice ? (
        <Alert variant="warning" role="status" className="flex items-start gap-2">
          <TriangleAlertIcon aria-hidden="true" />
          <span>{ruleMessages.formatRemoved}</span>
        </Alert>
      ) : null}

      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
