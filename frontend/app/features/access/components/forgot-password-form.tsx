import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { Spinner } from "~/shared/ui/spinner";
import { requestPasswordReset } from "../api";
import { accessMessages } from "../messages";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas";
import { AuthHeading } from "./auth-shell";

/**
 * Pedir o link de nova senha. A resposta da API é sempre a mesma, exista ou não o e-mail, e a tela também: a confirmação
 * não revela nada (RF-D06). Só o limite de pedidos (429) e a falha de rede mudam a tela.
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues): Promise<void> {
    setProblem(null);
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      setProblem(isApiError(error) ? error.message : messages.errors.generic);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <MailCheckIcon aria-hidden="true" className="size-8 text-primary" />
        <h1 className="m-0 text-2xl leading-tight font-extrabold">
          {accessMessages.forgot.sentTitle}
        </h1>
        <p className="m-0 text-foreground/90">{accessMessages.forgot.sentText}</p>
        <Link
          to="/admin/entrar"
          className="inline-flex min-h-11 items-center self-start font-semibold text-primary underline underline-offset-2"
        >
          {accessMessages.forgot.back}
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title={accessMessages.forgot.title} intro={accessMessages.forgot.intro} />

      {problem ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          {problem}
        </Alert>
      ) : null}

      <form
        noValidate
        aria-label={accessMessages.forgot.formLabel}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField id="email" label={accessMessages.forgot.email} error={errors.email?.message}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="username"
              spellCheck={false}
              {...register("email")}
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="min-h-12 font-bold" disabled={isSubmitting}>
          {isSubmitting ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
          {isSubmitting ? accessMessages.forgot.submitting : accessMessages.forgot.submit}
        </Button>
      </form>

      <Link
        to="/admin/entrar"
        className="inline-flex min-h-11 items-center self-start font-semibold text-primary underline underline-offset-2"
      >
        {accessMessages.forgot.back}
      </Link>
    </>
  );
}
