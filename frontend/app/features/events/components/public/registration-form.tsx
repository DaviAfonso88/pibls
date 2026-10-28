import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { applyApiErrors } from "~/shared/http/forms";
import { isApiError } from "~/shared/http/errors";
import { messages } from "~/shared/messages";
import { whatsappUrl } from "~/shared/site/links";
import { usePublicSettings } from "~/shared/site/settings";
import { Button } from "~/shared/ui/button";
import { buttonClassName } from "~/shared/ui/button-variants";
import { Checkbox } from "~/shared/ui/checkbox";
import { ConsentCheckbox } from "~/shared/ui/consent-checkbox";
import { Field, FieldContent, FieldError, FieldLabel } from "~/shared/ui/field";
import { FormField } from "~/shared/ui/form-field";
import { Honeypot } from "~/shared/ui/honeypot";
import { Input } from "~/shared/ui/input";
import { PhoneInput } from "~/shared/ui/phone-input";
import { Spinner } from "~/shared/ui/spinner";
import { registerForEvent, type PublicEvent, type RegistrationReceipt } from "../../public-api";
import { publicEventMessages as text } from "../../public-messages";
import {
  buildRegistrationSchema,
  emptyAnswers,
  hasHealthQuestion,
  toRegistrationPayload,
  type RegistrationValues,
} from "../../registration-schema";
import { AnswerField } from "./answer-field";

const FIXED_FIELDS = [
  "participant_name",
  "phone",
  "email",
  "guardian_name",
  "guardian_phone",
  "guardian_consent",
  "health_consent",
  "consent",
] as const;

/** O que a tela precisa depois da inscrição: o que o servidor devolveu e o que a pessoa digitou. */
export interface RegistrationDone {
  receipt: RegistrationReceipt;
  participantName: string;
}

/**
 * O formulário de inscrição (design: Evento e inscrição; CAP-19, BR-020 a BR-024, BR-083). Os campos fixos e as
 * perguntas do evento vêm do `form_schema`; o bloco do responsável legal aparece nos eventos com menores, e o segundo
 * consentimento, destacado, quando alguma pergunta pede informação de saúde. O 422 cai no campo certo; vagas esgotadas,
 * prazo vencido e inscrição repetida (409) viram um aviso geral com a frase do servidor, e as duas primeiras também
 * atualizam a página.
 */
export default function RegistrationForm({
  event,
  onRegistered,
}: {
  event: PublicEvent;
  onRegistered: (done: RegistrationDone) => void;
}) {
  const fields = event.form_schema;
  const hasMinors = event.has_minors;
  const health = hasHealthQuestion(fields);
  const schema = useMemo(() => buildRegistrationSchema(fields, hasMinors), [fields, hasMinors]);
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      participant_name: "",
      phone: "",
      email: "",
      guardian_name: "",
      guardian_phone: "",
      guardian_consent: false,
      answers: emptyAnswers(fields),
      health_consent: false,
      consent: false,
      website: "",
    },
  });
  const {
    register,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const [general, setGeneral] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { settings } = usePublicSettings();
  const whatsapp = whatsappUrl(settings?.whatsapp);
  const fieldNames = useMemo(
    () => [...FIXED_FIELDS, ...fields.map((field) => `answers.${field.key}`)],
    [fields],
  );

  async function submit(values: RegistrationValues): Promise<void> {
    setGeneral(null);

    try {
      const receipt = await registerForEvent(
        event.slug,
        toRegistrationPayload(values, fields, hasMinors),
      );
      void queryClient.invalidateQueries({ queryKey: ["public", "events"] });
      onRegistered({ receipt, participantName: values.participant_name.trim() });
    } catch (error) {
      setGeneral(applyApiErrors(error, form.setError, fieldNames).general);

      // As vagas acabaram ou o prazo venceu enquanto a pessoa preenchia: a página passa a mostrar a situação nova
      if (isApiError(error) && ["EVENT_FULL", "REGISTRATION_CLOSED"].includes(error.code)) {
        void queryClient.invalidateQueries({ queryKey: ["public", "events"] });
      }
    }
  }

  return (
    <form
      noValidate
      aria-labelledby="inscricao"
      onSubmit={form.handleSubmit(submit)}
      className="flex flex-col gap-[18px] rounded-2xl border border-border p-6"
    >
      <h2 id="inscricao" className="m-0 text-[22px] leading-tight">
        {text.registration}
      </h2>

      <FormField
        id="participant_name"
        label={text.fullName}
        error={errors.participant_name?.message}
      >
        {(control) => <Input {...control} autoComplete="name" {...register("participant_name")} />}
      </FormField>
      <FormField id="phone" label={text.whatsapp} error={errors.phone?.message}>
        {(control) => <PhoneInput {...control} {...register("phone")} />}
      </FormField>
      <FormField
        id="email"
        label={text.email}
        optionalLabel={text.optional}
        hint={text.emailHint}
        error={errors.email?.message}
      >
        {(control) => (
          <Input {...control} type="email" autoComplete="email" {...register("email")} />
        )}
      </FormField>

      {fields.map((field) => (
        <AnswerField key={field.key} field={field} form={form} />
      ))}

      {hasMinors ? (
        <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 rounded-[14px] border border-info-border bg-info p-4">
          <legend className="px-1.5 font-extrabold text-info-foreground">
            {text.guardianLegend}
          </legend>
          <FormField
            id="guardian_name"
            label={text.guardianName}
            error={errors.guardian_name?.message}
          >
            {(control) => <Input {...control} {...register("guardian_name")} />}
          </FormField>
          <FormField
            id="guardian_phone"
            label={text.guardianPhone}
            error={errors.guardian_phone?.message}
          >
            {(control) => (
              <PhoneInput {...control} autoComplete="off" {...register("guardian_phone")} />
            )}
          </FormField>
          <Controller
            control={control}
            name="guardian_consent"
            render={({ field }) => (
              <Field
                orientation="horizontal"
                data-invalid={errors.guardian_consent ? true : undefined}
              >
                <Checkbox
                  id="guardian_consent"
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-invalid={errors.guardian_consent ? true : undefined}
                  aria-describedby={errors.guardian_consent ? "guardian_consent-error" : undefined}
                />
                <FieldContent>
                  <FieldLabel htmlFor="guardian_consent" className="font-normal">
                    {text.guardianConsent}
                  </FieldLabel>
                  {errors.guardian_consent?.message ? (
                    <FieldError id="guardian_consent-error">
                      {errors.guardian_consent.message}
                    </FieldError>
                  ) : null}
                </FieldContent>
              </Field>
            )}
          />
        </fieldset>
      ) : null}

      {health ? (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-warning-foreground/30 bg-warning p-4 text-warning-foreground">
          <legend className="px-1.5 font-extrabold">{text.healthLegend}</legend>
          <p className="m-0 text-[15px]">{text.healthHint}</p>
          <Controller
            control={control}
            name="health_consent"
            render={({ field }) => (
              <Field
                orientation="horizontal"
                data-invalid={errors.health_consent ? true : undefined}
              >
                <Checkbox
                  id="health_consent"
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-invalid={errors.health_consent ? true : undefined}
                  aria-describedby={errors.health_consent ? "health_consent-error" : undefined}
                />
                <FieldContent>
                  <FieldLabel htmlFor="health_consent" className="font-bold">
                    {text.healthConsent}
                  </FieldLabel>
                  {errors.health_consent?.message ? (
                    <FieldError id="health_consent-error">
                      {errors.health_consent.message}
                    </FieldError>
                  ) : null}
                </FieldContent>
              </Field>
            )}
          />
        </fieldset>
      ) : null}

      <Honeypot {...register("website")} />

      <Controller
        control={control}
        name="consent"
        render={({ field }) => (
          <ConsentCheckbox
            id="consent"
            name={field.name}
            checked={field.value}
            onCheckedChange={field.onChange}
            error={errors.consent?.message}
          />
        )}
      />

      {general ? (
        <div
          role="alert"
          className="flex flex-col gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 p-3.5 text-destructive"
        >
          <span className="font-bold">{general}</span>
          <span className="flex flex-wrap gap-2.5">
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              {text.retry}
            </Button>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({ variant: "whatsapp" })}
              >
                {messages.common.whatsapp}
                <span className="sr-only"> {messages.forms.opensInNewTab}</span>
              </a>
            ) : null}
          </span>
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="min-h-[52px] px-5 font-bold"
        disabled={isSubmitting}
      >
        {isSubmitting ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
        {isSubmitting ? text.sending : text.confirm}
      </Button>
    </form>
  );
}
