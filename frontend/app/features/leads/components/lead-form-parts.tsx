import { CheckIcon, LockIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Link } from "react-router";
import { whatsappUrl } from "~/shared/site/links";
import { usePublicSettings } from "~/shared/site/settings";
import { messages } from "~/shared/messages";
import { Button } from "~/shared/ui/button";
import { buttonClassName } from "~/shared/ui/button-variants";
import { ConsentCheckbox } from "~/shared/ui/consent-checkbox";
import { Honeypot } from "~/shared/ui/honeypot";
import { Spinner } from "~/shared/ui/spinner";
import { leadMessages } from "../messages";

/** Campos que todo formulário de contato tem (consentimento e honeypot). */
export interface CommonFields {
  consent: boolean;
  website: string;
}

/**
 * O fim comum dos cinco formulários: o honeypot oculto (BR-002), o consentimento (BR-001), o alerta de erro geral com
 * "Tentar novamente" e "Falar no WhatsApp", e o botão de enviar, travado com indicador durante o envio. Lê o
 * formulário pelo contexto do React Hook Form.
 */
export function LeadFormTail({
  submitLabel,
  general,
}: {
  submitLabel: string;
  /** Erro que não é de campo (limite de envios, servidor fora, rede); `null` se não há. */
  general: string | null;
}) {
  const {
    register,
    control,
    formState: { errors, isSubmitting },
  } = useFormContext<CommonFields>();
  const { settings } = usePublicSettings();
  const whatsapp = whatsappUrl(settings?.whatsapp);

  return (
    <>
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
              {leadMessages.retry}
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
        {isSubmitting ? leadMessages.sending : submitLabel}
      </Button>
    </>
  );
}

/** A nota de privacidade embaixo do formulário. */
export function PrivacyNote({ children = leadMessages.privacyNote }: { children?: ReactNode }) {
  return (
    <p className="m-0 flex items-start gap-2.5 text-[15px] text-muted-foreground">
      <LockIcon aria-hidden="true" className="mt-1 size-[18px] flex-none" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Confirmação depois do envio (design: "Recebemos seu contato!"). Anunciada como `status`, e o foco vai para o título:
 * o formulário que tinha o foco sumiu, e quem usa leitor de tela não pode ficar no vazio.
 */
export function LeadSuccess({
  title = leadMessages.successTitle,
  text,
  action,
}: {
  title?: string;
  text: string;
  action?: { to: string; label: string };
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-2xl border border-success-foreground/30 bg-success p-6 text-success-foreground"
    >
      <div className="flex items-center gap-2.5">
        <CheckIcon aria-hidden="true" className="size-6 flex-none" strokeWidth={2.5} />
        <h2
          ref={heading}
          tabIndex={-1}
          className="m-0 text-[22px] leading-tight text-success-foreground"
        >
          {title}
        </h2>
      </div>
      <p className="m-0">{text}</p>
      {action ? (
        <Link
          to={action.to}
          className="inline-flex min-h-11 items-center self-start font-bold underline"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
