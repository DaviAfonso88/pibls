import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { applyApiErrors } from "~/shared/http/forms";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { Alert } from "~/shared/ui/alert";
import { Button } from "~/shared/ui/button";
import { buttonClassName } from "~/shared/ui/button-variants";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { Spinner } from "~/shared/ui/spinner";
import { resetPassword } from "../api";
import { accessMessages } from "../messages";
import { resetPasswordSchema, type ResetPasswordValues } from "../schemas";
import { AuthHeading } from "./auth-shell";

interface ResetLink {
  token: string;
  email: string;
}

/**
 * O link do e-mail leva o token e o e-mail no *fragmento* (`#token=…&email=…`): o fragmento nunca vai ao servidor, aos logs
 * do Apache nem ao cabeçalho Referer. Lido uma vez, e logo tirado da barra de endereço e do histórico.
 */
export function readResetLink(hash: string): ResetLink | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("token");
  const email = params.get("email");

  return token !== null && token !== "" && email !== null && email !== "" ? { token, email } : null;
}

const FIELDS = ["password", "password_confirmation"] as const;

type Stage = "form" | "done" | "invalid";

export function ResetPasswordForm() {
  const [link] = useState<ResetLink | null>(() =>
    typeof window === "undefined" ? null : readResetLink(window.location.hash),
  );
  const [stage, setStage] = useState<Stage>(link === null ? "invalid" : "form");
  const [problem, setProblem] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  useEffect(() => {
    if (window.location.hash !== "") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  async function onSubmit(values: ResetPasswordValues): Promise<void> {
    if (link === null) return;
    setProblem(null);
    try {
      await resetPassword({ ...link, ...values });
      setStage("done");
    } catch (error) {
      if (isApiError(error) && error.code === "INVALID_RESET_TOKEN") {
        setStage("invalid");
        return;
      }
      if (isApiError(error) && error.isValidation) {
        const applied = applyApiErrors(error, setError, FIELDS);
        if (applied.general) setProblem(applied.general);
        return;
      }
      setProblem(isApiError(error) ? error.message : messages.errors.generic);
    }
  }

  if (stage === "invalid") {
    return (
      <div role="alert" className="flex flex-col gap-3">
        <LinkIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="m-0 text-2xl leading-tight font-extrabold">
          {accessMessages.reset.invalidTitle}
        </h1>
        <p className="m-0 text-foreground/90">{accessMessages.reset.invalidText}</p>
        <Link
          to="/admin/esqueci-senha"
          className={buttonClassName({ size: "lg", className: "self-start px-5 font-bold" })}
        >
          {accessMessages.reset.requestNew}
        </Link>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <CheckIcon aria-hidden="true" className="size-8 text-success-foreground" />
        <h1 className="m-0 text-2xl leading-tight font-extrabold">
          {accessMessages.reset.doneTitle}
        </h1>
        <p className="m-0 text-foreground/90">{accessMessages.reset.doneText}</p>
        <Link
          to="/admin/entrar"
          className={buttonClassName({ size: "lg", className: "self-start px-5 font-bold" })}
        >
          {accessMessages.reset.goToLogin}
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title={accessMessages.reset.title} intro={accessMessages.reset.intro} />

      {problem ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          {problem}
        </Alert>
      ) : null}

      <form
        noValidate
        aria-label={accessMessages.reset.formLabel}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          id="password"
          label={accessMessages.reset.password}
          hint={accessMessages.reset.passwordHint}
          error={errors.password?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          )}
        </FormField>
        <FormField
          id="password_confirmation"
          label={accessMessages.reset.confirmation}
          error={errors.password_confirmation?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              {...register("password_confirmation")}
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="min-h-12 font-bold" disabled={isSubmitting}>
          {isSubmitting ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
          {isSubmitting ? accessMessages.reset.submitting : accessMessages.reset.submit}
        </Button>
      </form>
    </>
  );
}
