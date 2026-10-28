import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { Checkbox } from "~/shared/ui/checkbox";
import { Field, FieldLabel } from "~/shared/ui/field";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { Textarea } from "~/shared/ui/textarea";
import { prayerSchema, toPrayerPayload, type PrayerValues } from "../schemas";
import { useLeadSubmit } from "../use-lead-submit";
import { LeadFormTail, LeadSuccess } from "./lead-form-parts";
import { leadMessages } from "../messages";

const FIELDS = ["message", "name", "contact", "consent"] as const;

/**
 * Pedido de oração (`ORACAO`). Anônimo por padrão (RF-D03): só o texto é obrigatório. "Quero me identificar" abre o nome
 * e o contato (WhatsApp ou e-mail, num campo só).
 */
export default function PrayerForm() {
  const form = useForm<PrayerValues>({
    resolver: zodResolver(prayerSchema),
    defaultValues: {
      message: "",
      identify: false,
      name: "",
      contact: "",
      consent: false,
      website: "",
    },
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const identify = useWatch({ control, name: "identify" });
  const lead = useLeadSubmit(form.setError, FIELDS, toPrayerPayload);

  if (lead.submitted) {
    return (
      <LeadSuccess title={leadMessages.prayerSuccessTitle} text={leadMessages.prayerSuccess} />
    );
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        aria-label={leadMessages.prayerTitle}
        onSubmit={form.handleSubmit(lead.submit)}
        className="flex flex-col gap-[18px] rounded-2xl border border-border p-6"
      >
        <FormField
          id="message"
          label={leadMessages.prayerRequest}
          hint={leadMessages.prayerHint}
          error={errors.message?.message}
        >
          {(controlProps) => (
            <Textarea {...controlProps} rows={6} maxLength={4000} {...register("message")} />
          )}
        </FormField>

        <Controller
          control={control}
          name="identify"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="identify"
                name={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
              <FieldLabel htmlFor="identify" className="font-normal">
                {leadMessages.identifyMe}
              </FieldLabel>
            </Field>
          )}
        />

        {identify ? (
          <div className="flex flex-col gap-4 pl-[30px]">
            <FormField
              id="name"
              label={leadMessages.name}
              optionalLabel={leadMessages.optional}
              error={errors.name?.message}
            >
              {(controlProps) => (
                <Input {...controlProps} autoComplete="name" {...register("name")} />
              )}
            </FormField>
            <FormField
              id="contact"
              label={leadMessages.whatsappOrEmail}
              optionalLabel={leadMessages.optional}
              error={errors.contact?.message}
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  autoComplete="tel"
                  spellCheck={false}
                  {...register("contact")}
                />
              )}
            </FormField>
          </div>
        ) : null}

        <LeadFormTail submitLabel={leadMessages.prayerSend} general={lead.general} />
      </form>
    </FormProvider>
  );
}
