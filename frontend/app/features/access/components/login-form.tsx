import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlertIcon, ClockIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { applyApiErrors } from "~/shared/http/forms";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { Spinner } from "~/shared/ui/spinner";
import { safeReturnPath, useAuth } from "../auth-context";
import { accessMessages } from "../messages";
import { loginSchema, type LoginValues } from "../schemas";

type Problem = { kind: "credentials" | "locked" | "generic"; message: string };

const FIELDS = ["email", "password"] as const;

/**
 * Entrar no painel (design: AdminEntrar). A API responde com a mesma frase para e-mail inexistente, senha errada e usuário
 * desativado (BR-070), então a tela também não distingue; o bloqueio temporário (BR-071) ganha o aviso âmbar. Depois do
 * login, volta à rota que a pessoa pediu (`voltar`).
 */
export function LoginForm({ returnTo, expired }: { returnTo: string | null; expired: boolean }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: LoginValues): Promise<void> {
    setProblem(null);
    try {
      await signIn(values.email, values.password);
      void navigate(safeReturnPath(returnTo), { replace: true });
    } catch (error) {
      // Ordem importa: `INVALID_CREDENTIALS` também é um 422, mas não é erro de campo (BR-070)
      if (isApiError(error) && error.code === "INVALID_CREDENTIALS") {
        setProblem({ kind: "credentials", message: error.message });
        return;
      }
      if (isApiError(error) && error.status === 429) {
        setProblem({ kind: "locked", message: error.message });
        return;
      }
      if (isApiError(error) && error.isValidation) {
        const applied = applyApiErrors(error, setError, FIELDS);
        if (applied.general) setProblem({ kind: "generic", message: applied.general });
        return;
      }
      setProblem({
        kind: "generic",
        message: isApiError(error) ? error.message : messages.errors.generic,
      });
    }
  }

  return (
    <>
      {expired ? (
        <Alert variant="info" role="status">
          {accessMessages.sessionExpired}
        </Alert>
      ) : null}

      {problem?.kind === "locked" ? (
        <Alert variant="warning">
          <ClockIcon aria-hidden="true" />
          {problem.message}
        </Alert>
      ) : problem ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <CircleAlertIcon aria-hidden="true" />
          {problem.message}
        </Alert>
      ) : null}

      <form
        noValidate
        aria-label={accessMessages.login.formLabel}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField id="email" label={accessMessages.login.email} error={errors.email?.message}>
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
        <FormField
          id="password"
          label={accessMessages.login.password}
          error={errors.password?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="min-h-12 font-bold" disabled={isSubmitting}>
          {isSubmitting ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
          {isSubmitting ? accessMessages.login.submitting : accessMessages.login.submit}
        </Button>
      </form>

      <Link
        to="/admin/esqueci-senha"
        className="inline-flex min-h-11 items-center self-start font-semibold text-primary underline underline-offset-2"
      >
        {accessMessages.login.forgot}
      </Link>
    </>
  );
}
