import * as z from "zod";
import { isValidPhone } from "~/shared/format";
import { ruleMessages } from "~/shared/rule-messages";
import type { MinistryCategory } from "./admin-api";
import { ministriesAdminMessages } from "./admin-messages";

const text = ministriesAdminMessages.form;

/**
 * O formulário do item do catálogo (CAP-16). Todos os campos são texto; vazio = ausente. A regra BR-049 depende da
 * categoria: grupo e célula pedem dia e hora, e a célula pede também o bairro. O servidor confere de novo.
 */
export function ministrySchema(category: MinistryCategory) {
  return z
    .object({
      name: z.string().trim().min(2, text.nameLength).max(120, text.nameLength),
      description: z.string(),
      leaders_text: z.string().trim().max(500, text.leadersLength),
      schedule_text: z.string().trim().max(120, text.scheduleLength),
      neighborhood: z.string().trim().max(80, text.neighborhoodLength),
      contact_phone: z
        .string()
        .trim()
        .refine((value) => value === "" || isValidPhone(value), ruleMessages.phone),
      private_address: z.string().trim().max(300, text.addressLength),
      contact_email: z
        .string()
        .trim()
        .refine((value) => value === "" || z.email().safeParse(value).success, ruleMessages.email),
    })
    .superRefine((value, context) => {
      if (category !== "MINISTERIO" && value.schedule_text === "") {
        context.addIssue({
          code: "custom",
          path: ["schedule_text"],
          message: ruleMessages.scheduleRequired,
        });
      }
      if (category === "CELULA" && value.neighborhood === "") {
        context.addIssue({
          code: "custom",
          path: ["neighborhood"],
          message: ruleMessages.neighborhoodRequired,
        });
      }
      if (value.neighborhood !== "" && value.neighborhood.length < 2) {
        context.addIssue({
          code: "custom",
          path: ["neighborhood"],
          message: text.neighborhoodLength,
        });
      }
    });
}

export type MinistryValues = z.infer<ReturnType<typeof ministrySchema>>;
