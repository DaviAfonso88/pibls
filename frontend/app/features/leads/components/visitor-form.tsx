import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { FormField } from "~/shared/ui/form-field";
import { Input } from "~/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "~/shared/ui/native-select";
import { PhoneInput } from "~/shared/ui/phone-input";
import { Textarea } from "~/shared/ui/textarea";
import { YesNoField } from "~/shared/ui/yes-no-field";
import { toVisitorPayload, visitorSchema, type VisitorValues } from "../schemas";
import { useLeadSubmit } from "../use-lead-submit";
import { LeadFormTail, LeadSuccess, PrivacyNote } from "./lead-form-parts";
import { leadMessages } from "../messages";

const FIELDS = [
  "name",
  "phone",
  "neighborhood",
  "wants_visit",
  "wants_cell_group",
  "group_id",
  "message",
  "consent",
] as const;

export interface GroupOption {
  id: number;
  name: string;
}

/**
 * Ficha de Visitante (`VISITANTE`; BR-004, BR-006). O grupo de interesse vem preenchido quando a pessoa chega por
 * "Quero participar" (`?grupo=<id>`).
 */
export default function VisitorForm({
  groups,
  initialGroupId,
}: {
  groups: readonly GroupOption[];
  initialGroupId: number | null;
}) {
  const form = useForm<VisitorValues>({
    resolver: zodResolver(visitorSchema),
    defaultValues: {
      name: "",
      phone: "",
      neighborhood: "",
      wants_visit: undefined,
      wants_cell_group: undefined,
      group_id: initialGroupId === null ? "" : String(initialGroupId),
      message: "",
      consent: false,
      website: "",
    },
  });
  const {
    register,
    formState: { errors },
  } = form;
  const lead = useLeadSubmit(form.setError, FIELDS, toVisitorPayload);

  if (lead.submitted) {
    return (
      <LeadSuccess
        text={leadMessages.visitorSuccess}
        action={{ to: "/#horarios", label: leadMessages.seeServiceTimes }}
      />
    );
  }

  return (
    <>
      <FormProvider {...form}>
        <form
          noValidate
          aria-label={leadMessages.visitorEyebrow}
          onSubmit={form.handleSubmit(lead.submit)}
          className="flex flex-col gap-[18px] rounded-2xl border border-border p-6"
        >
          <FormField id="name" label={leadMessages.name} error={errors.name?.message}>
            {(control) => <Input {...control} autoComplete="name" {...register("name")} />}
          </FormField>
          <FormField id="phone" label={leadMessages.whatsapp} error={errors.phone?.message}>
            {(control) => <PhoneInput {...control} {...register("phone")} />}
          </FormField>
          <FormField
            id="neighborhood"
            label={leadMessages.neighborhood}
            error={errors.neighborhood?.message}
          >
            {(control) => (
              <Input {...control} autoComplete="address-level3" {...register("neighborhood")} />
            )}
          </FormField>
          <YesNoField
            name="wants_visit"
            legend={leadMessages.wantsVisit}
            register={() => register("wants_visit")}
            error={errors.wants_visit?.message}
          />
          <YesNoField
            name="wants_cell_group"
            legend={leadMessages.wantsCellGroup}
            register={() => register("wants_cell_group")}
            error={errors.wants_cell_group?.message}
          />
          <FormField
            id="group_id"
            label={leadMessages.groupOfInterest}
            optionalLabel={leadMessages.optional}
            hint={leadMessages.groupHint}
            error={errors.group_id?.message}
          >
            {(control) => (
              <NativeSelect className="w-full" {...control} {...register("group_id")}>
                <NativeSelectOption value="">{leadMessages.noGroupYet}</NativeSelectOption>
                {groups.map((group) => (
                  <NativeSelectOption key={group.id} value={String(group.id)}>
                    {group.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id="message"
            label={leadMessages.visitorMessage}
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
      <PrivacyNote />
    </>
  );
}
