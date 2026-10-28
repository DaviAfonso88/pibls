import { useState, type ReactNode } from "react";
import { messages } from "~/shared/messages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Spinner } from "./spinner";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** O que vai acontecer e se dá para desfazer (BR-081: "Esta exclusão é definitiva…"). */
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação irreversível: o botão de confirmar fica vermelho. */
  destructive?: boolean;
  /** Trava o botão de confirmar até uma condição do diálogo (ex.: a caixa "confirmo que a pessoa pediu"). */
  confirmDisabled?: boolean;
  /** Pode ser assíncrono: o diálogo fica aberto, com os botões travados, até terminar. */
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmação de ação destrutiva ou irreversível (nunca imediata: Web Interface Guidelines). Usa o `AlertDialog`,
 * que leva o foco para dentro, fecha com Esc e devolve o foco a quem abriu.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = messages.common.confirm,
  cancelLabel = messages.common.cancel,
  destructive = false,
  confirmDisabled = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Quem chamou já avisou a falha (toast ou erro no formulário); o diálogo fica aberto para tentar de novo
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={pending || confirmDisabled}
            onClick={() => void confirm()}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {pending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
