import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { PhoneInput } from "~/shared/ui/phone-input";
import { Textarea } from "~/shared/ui/textarea";
import { contactSchema, toContactPayload, type ContactValues } from "../schemas";
import { useLeadSubmit } from "../use-lead-submit";
import { LeadFormTail, LeadSuccess } from "./lead-form-parts";
import { leadMessages } from "../messages";

const FIELDS = ["audience", "ministry_id", "name", "phone", "email", "message", "consent"] as const;

export interface MinistryOption {
  id: number;
  name: string;
}

/**
 * Contato (`CONTATO` ou `MINISTERIO`). Com `?ministerio=<id>` ("Falar com este ministério") já nasce falando com o
 * ministério escolhido (FR-005). Telefone ou e-mail: pelo menos um (BR-005).
 */
export default function ContactForm({
  ministries,
  initialMinistryId,
}: {
  ministries: readonly MinistryOption[];
  initialMinistryId: number | null;
}) {
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      audience: initialMinistryId === null ? "geral" : "ministerio",
      ministry_id: initialMinistryId === null ? "" : String(initialMinistryId),
      name: "",
      phone: "",
      email: "",
      message: "",
      consent: false,
      website: "",
    },
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const audience = useWatch({ control, name: "audience" });
  const lead = useLeadSubmit(form.setError, FIELDS, toContactPayload);

  if (lead.submitted) return <LeadSuccess text={leadMessages.contactSuccess} />;

  return (
    <FormProvider {...form}>
      <form
        id="formulario"
        noValidate
        aria-label={leadMessages.contactTitle}
        onSubmit={form.handleSubmit(lead.submit)}
        className="flex flex-col gap-[18px] rounded-2xl border border-border p-6"
      >
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 font-bold">{leadMessages.whoToTalkTo}</legend>
          {(
            [
              ["geral", leadMessages.toSecretariat],
              ["ministerio", leadMessages.toMinistry],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border border-border-strong px-3.5 has-[:checked]:border-primary has-[:checked]:bg-info has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input
                type="radio"
                value={value}
                className="size-5 accent-primary"
                {...register("audience")}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {audience === "ministerio" ? (
          <FormField
            id="ministry_id"
            label={leadMessages.ministry}
            error={errors.ministry_id?.message}
          >
            {(control) => (
              <NativeSelect className="w-full" {...control} {...register("ministry_id")}>
                <NativeSelectOption value="">{leadMessages.chooseMinistry}</NativeSelectOption>
                {ministries.map((ministry) => (
                  <NativeSelectOption key={ministry.id} value={String(ministry.id)}>
                    {ministry.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        ) : null}

        <FormField id="name" label={leadMessages.name} error={errors.name?.message}>
          {(controlProps) => <Input {...controlProps} autoComplete="name" {...register("name")} />}
        </FormField>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0">
          <legend className="mb-1 font-bold">{leadMessages.howToReply}</legend>
          <p className="m-0 -mt-2 text-sm text-muted-foreground">{leadMessages.atLeastOne}</p>
          <FormField id="phone" label={leadMessages.phoneOrWhatsapp} error={errors.phone?.message}>
            {(controlProps) => <PhoneInput {...controlProps} {...register("phone")} />}
          </FormField>
          <FormField id="email" label={leadMessages.email} error={errors.email?.message}>
            {(controlProps) => (
              <Input
                {...controlProps}
                type="email"
                autoComplete="email"
                spellCheck={false}
                {...register("email")}
              />
            )}
          </FormField>
        </fieldset>

        <FormField id="message" label={leadMessages.message} error={errors.message?.message}>
          {(controlProps) => (
            <Textarea {...controlProps} rows={5} maxLength={2000} {...register("message")} />
          )}
        </FormField>

        <LeadFormTail submitLabel={leadMessages.contactSend} general={lead.general} />
      </form>
    </FormProvider>
  );
}
