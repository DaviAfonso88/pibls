import { useState } from "react";
import { cn } from "~/shared/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/shared/ui/alert-dialog";
import { Spinner } from "~/shared/ui/spinner";
import { registrationsAdminMessages as text } from "../../registrations-messages";
import type { CancelReason } from "../../registrations-api";

const choiceClassName = cn(
  "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border border-border-strong px-3.5",
  "has-[:checked]:border-primary has-[:checked]:bg-info has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
);

/**
 * Confirmação do cancelamento de uma inscrição (BR-034, BR-081): a exclusão é definitiva e a vaga volta. A pessoa que cancela
 * diz o motivo, que decide a ação auditada: desistência (padrão) ou pedido do titular dos dados (LGPD). Fica aberta, com os
 * botões travados, até o servidor responder; se falhar, quem chamou avisa e a confirmação continua aberta.
 */
export function CancelRegistrationDialog({
  name,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: CancelReason) => Promise<void>;
}) {
  const [reason, setReason] = useState<CancelReason>("CANCELLED");
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm(reason);
      onOpenChange(false);
    } catch {
      // Quem chamou já avisou a falha; a confirmação fica aberta para tentar de novo
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setReason("CANCELLED");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{text.cancelTitle(name)}</AlertDialogTitle>
          <AlertDialogDescription>
            {reason === "TITULAR_REQUEST" ? text.dataSubjectWarning : text.cancelDescription(name)}
          </AlertDialogDescription>
          {reason === "CANCELLED" ? (
            <p className="m-0 text-sm text-muted-foreground">{text.cancelHint}</p>
          ) : null}
        </AlertDialogHeader>
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 font-bold">{text.reasonLegend}</legend>
          <label className={choiceClassName}>
            <input
              type="radio"
              name="cancel-reason"
              value="CANCELLED"
              className="size-5 accent-primary"
              checked={reason === "CANCELLED"}
              disabled={pending}
              onChange={() => setReason("CANCELLED")}
            />
            {text.reasonCancelled}
          </label>
          <label className={choiceClassName}>
            <input
              type="radio"
              name="cancel-reason"
              value="TITULAR_REQUEST"
              className="size-5 accent-primary"
              checked={reason === "TITULAR_REQUEST"}
              disabled={pending}
              onChange={() => setReason("TITULAR_REQUEST")}
            />
            {text.reasonDataSubject}
          </label>
        </fieldset>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{text.keepRegistration}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={pending}
            onClick={() => void confirm()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
            {text.confirmCancel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
