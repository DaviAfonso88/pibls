import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { buttonClassName } from "./button-variants";

export interface PixCopyProps {
  /** O que vai para a área de transferência: a chave só com dígitos, ou o código Copia e Cola. */
  value: string;
  /** O que a pessoa lê no lugar do valor (a chave formatada, `20.969.119/0001-84`); sem isso, o próprio valor. */
  display?: ReactNode;
  /** Rótulo pequeno acima do valor (`Chave PIX (CNPJ)`). */
  caption: string;
  copyLabel: string;
  copiedLabel: string;
  /** Dica antes de copiar (toque e segure como alternativa). */
  hint: string;
  /** Depois de copiar: o que fazer agora. */
  copiedHint: string;
  /** Quando o navegador não deixa copiar: a chave fica selecionada e a dica manda copiar na mão. */
  failedHint: string;
  /** O valor é longo (Copia e Cola): quebra em qualquer ponto e usa letra menor. */
  long?: boolean;
  className?: string;
}

type State = "idle" | "copied" | "failed";

/** Quanto tempo o botão fica verde ("Chave copiada!") antes de voltar ao normal. */
const COPIED_MS = 6000;

/**
 * Valor PIX com o botão de copiar (design: Contribua; CAP-04). Copia pela Clipboard API; sem ela, ou se o navegador
 * recusar (HTTP, WebView antigo, permissão), seleciona o texto e avisa "toque e segure para copiar" (T125). O botão e o
 * aviso falam a mesma coisa em voz (`role="status"`): quem usa leitor de tela sabe que copiou. Só o botão nativo e o
 * `buttonClassName`, sem o Base UI, para a página pública não pesar (RNF-05).
 */
export function PixCopy({
  value,
  display,
  caption,
  copyLabel,
  copiedLabel,
  hint,
  copiedHint,
  failedHint,
  long = false,
  className,
}: PixCopyProps) {
  const [state, setState] = useState<State>("idle");
  const text = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function selectText() {
    const node = text.current;
    const selection = window.getSelection();
    if (!node || !selection) return;

    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copy() {
    window.clearTimeout(timer.current);

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API indisponível");
      await navigator.clipboard.writeText(value);
      setState("copied");
      timer.current = window.setTimeout(() => setState("idle"), COPIED_MS);
    } catch {
      selectText();
      setState("failed");
    }
  }

  const message = state === "copied" ? copiedHint : state === "failed" ? failedHint : hint;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-muted-foreground">{caption}</span>
        <span
          ref={text}
          className={cn(
            "font-mono font-bold select-all",
            long ? "text-[15px] leading-snug break-all" : "text-2xl tracking-wide",
          )}
        >
          {display ?? value}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className={buttonClassName({
          variant: state === "copied" ? "whatsapp" : "default",
          size: "lg",
          className: "gap-2 px-5 font-bold",
        })}
      >
        {state === "copied" ? (
          <CheckIcon aria-hidden="true" className="size-5" />
        ) : (
          <CopyIcon aria-hidden="true" className="size-5" />
        )}
        {state === "copied" ? copiedLabel : copyLabel}
      </button>
      <p role="status" className="m-0 text-[15px] text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
