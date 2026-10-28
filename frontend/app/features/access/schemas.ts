import * as z from "zod";
import { ruleMessages } from "~/shared/rule-messages";

/**
 * Esquemas dos formulários de acesso. A política de senha (BR-073) é conferida aqui só no que dá para saber sem ir ao
 * servidor (tamanho); a consulta à base de senhas vazadas é do servidor, que devolve a frase da regra no campo.
 */

const byteLength = (value: string) => new TextEncoder().encode(value).length;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").max(254, ruleMessages.email),
  password: z.string().min(1, "Informe sua senha.").max(200, "A senha é longa demais."),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").pipe(z.email(ruleMessages.email)),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .refine((value) => [...value].length >= 12, ruleMessages.passwordMin)
      .refine((value) => byteLength(value) <= 72, ruleMessages.passwordMax),
    password_confirmation: z.string(),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ["password_confirmation"],
    message: "As duas senhas precisam ser iguais.",
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
