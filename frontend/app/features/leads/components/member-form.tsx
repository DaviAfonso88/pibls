import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { PhoneInput } from "~/shared/ui/phone-input";
import { Textarea } from "~/shared/ui/textarea";
import { YesNoField } from "~/shared/ui/yes-no-field";
import { memberSchema, toMemberPayload, type MemberValues } from "../schemas";
import { useLeadSubmit } from "../use-lead-submit";
import { LeadFormTail, LeadSuccess } from "./lead-form-parts";
import { leadMessages } from "../messages";

const FIELDS = [
  "name",
  "phone",
  "from_other_baptist_church",
  "email",
  "message",
  "consent",
] as const;

/** "Quero ser membro" (`MEMBRO`; FR-013, enquanto a Q-13 não chega, vale a tabela do documento). */
export default function MemberForm() {
  const form = useForm<MemberValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "",
      phone: "",
      from_other_baptist_church: undefined,
      email: "",
      message: "",
      consent: false,
      website: "",
    },
  });
  const {
    register,
    formState: { errors },
  } = form;
  const lead = useLeadSubmit(form.setError, FIELDS, toMemberPayload);

  if (lead.submitted) return <LeadSuccess text={leadMessages.memberSuccess} />;

  return (
    <FormProvider {...form}>
      <form
        noValidate
        aria-label={leadMessages.memberTitle}
        onSubmit={form.handleSubmit(lead.submit)}
        className="flex flex-col gap-[18px] rounded-2xl border border-border p-6"
      >
        <FormField id="name" label={leadMessages.name} error={errors.name?.message}>
          {(control) => <Input {...control} autoComplete="name" {...register("name")} />}
        </FormField>
        <FormField id="phone" label={leadMessages.whatsapp} error={errors.phone?.message}>
          {(control) => <PhoneInput {...control} {...register("phone")} />}
        </FormField>
        <YesNoField
          name="from_other_baptist_church"
          legend={leadMessages.fromOtherBaptistChurch}
          register={() => register("from_other_baptist_church")}
          error={errors.from_other_baptist_church?.message}
        />
        <FormField
          id="email"
          label={leadMessages.email}
          optionalLabel={leadMessages.optional}
          error={errors.email?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="email"
              spellCheck={false}
              {...register("email")}
            />
          )}
        </FormField>
        <FormField
          id="message"
          label={leadMessages.message}
          optionalLabel={leadMessages.optional}
          error={errors.message?.message}
        >
          {(control) => (
            <Textarea {...control} rows={4} maxLength={2000} {...register("message")} />
          )}
        </FormField>

        <LeadFormTail submitLabel={leadMessages.send} general={lead.general} />
      </form>
    </FormProvider>
  );
}
