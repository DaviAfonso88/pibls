import { useRef, useState, type DragEvent } from "react";
import { FileUpIcon, XIcon } from "lucide-react";
import { formatFileSize } from "~/shared/format";
import { cn } from "~/shared/lib/utils";
import { messages } from "~/shared/messages";
import { Button } from "./button";
import { FieldDescription, FieldError } from "./field";

export interface FileDropProps {
  id: string;
  /** Rótulo visível do campo, ex.: "Arquivo do boletim (PDF)". */
  label: string;
  /** Dica do que vale, ex.: "PDF de até 10 MB." */
  hint?: string;
  /** Tipos MIME aceitos, ex.: `["application/pdf"]`. O servidor confere o conteúdo de verdade. */
  accept: readonly string[];
  maxBytes: number;
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Texto do erro de tipo (BR-041, BR-045). */
  typeMessage: string;
  /** Texto do erro de tamanho (BR-041, BR-045). */
  sizeMessage: string;
  /** Erro vindo do formulário (ex.: o 422 do servidor). */
  error?: string;
  disabled?: boolean;
}

/**
 * Escolha de arquivo por botão ou arrastando. O botão é o caminho principal (teclado, leitor de tela e celular); o
 * arrastar é um atalho a mais no desktop. Confere tipo e tamanho antes de aceitar, para a pessoa saber na hora.
 */
export function FileDrop({
  id,
  label,
  hint,
  accept,
  maxBytes,
  file,
  onFileChange,
  typeMessage,
  sizeMessage,
  error,
  disabled = false,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const shownError = rejection ?? error;

  function choose(candidate: File | undefined) {
    if (!candidate) return;

    if (!accept.includes(candidate.type)) {
      setRejection(typeMessage);
      return;
    }
    if (candidate.size > maxBytes) {
      setRejection(sizeMessage);
      return;
    }

    setRejection(null);
    onFileChange(candidate);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) choose(event.dataTransfer.files[0]);
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={
        [hint ? hintId : null, shownError ? errorId : null].filter(Boolean).join(" ") || undefined
      }
      className="flex flex-col gap-2"
    >
      <span id={labelId} className="font-medium">
        {label}
      </span>
      {hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}

      {/* Arrastar é só um atalho no desktop: teclado, leitor de tela e celular usam o botão de dentro */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-strong p-5 text-center transition-colors",
          dragging && "border-primary bg-accent",
          shownError && "border-destructive",
        )}
      >
        <FileUpIcon aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="text-muted-foreground">{messages.forms.fileDropPrompt}</p>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {file ? messages.forms.fileReplace : messages.forms.fileChoose}
        </Button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          hidden
          accept={accept.join(",")}
          disabled={disabled}
          onChange={(event) => {
            choose(event.target.files?.[0]);
            // Permite escolher o mesmo arquivo de novo depois de removê-lo
            event.target.value = "";
          }}
        />
      </div>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
          <p className="min-w-0 break-words">
            <span className="sr-only">{messages.forms.fileChosen} </span>
            <span className="font-medium">{file.name}</span>{" "}
            <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`${messages.forms.fileRemove}: ${file.name}`}
            onClick={() => {
              setRejection(null);
              onFileChange(null);
            }}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <p className="sr-only">{messages.forms.fileNone}</p>
      )}

      {shownError ? <FieldError id={errorId}>{shownError}</FieldError> : null}
    </div>
  );
}
