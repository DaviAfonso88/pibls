import { formatCnpj } from "~/shared/format";
import { messages } from "~/shared/messages";
import { usePublicSettings, type PublicSettings } from "~/shared/site/settings";
import { ErrorState } from "~/shared/ui/error-state";
import { LoadingBlock } from "~/shared/ui/loading-block";
import { PixCopy } from "~/shared/ui/pix-copy";
import { contribuaMessages as text } from "../messages";

type Pix = NonNullable<PublicSettings["pix"]>;

const STEP_NUMBER =
  "flex size-8 flex-none items-center justify-center rounded-full bg-primary font-extrabold text-primary-foreground";

/** O cartão do PIX: QR Code, favorecido, chave formatada com o botão de copiar e, se houver, o Copia e Cola. */
function PixCard({ pix }: { pix: Pix }) {
  const key = pix.pix_key ?? "";

  return (
    <section
      aria-labelledby="pix"
      className="flex min-w-[min(100%,21rem)] flex-[1_1_21rem] flex-col gap-4 rounded-2xl border border-border p-6"
    >
      <h2 id="pix" className="m-0 text-[22px] leading-tight">
        {text.pixHeading}
      </h2>
      {pix.qr_image_url ? (
        <img
          src={pix.qr_image_url}
          alt={text.qrAlt}
          width={200}
          height={200}
          decoding="async"
          className="size-[200px] self-center rounded-xl border border-border bg-background object-contain"
        />
      ) : null}
      {pix.beneficiary_name ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-muted-foreground">{text.beneficiary}</span>
          <span className="font-bold">{pix.beneficiary_name}</span>
        </div>
      ) : null}
      {key ? (
        <PixCopy
          value={key}
          display={formatCnpj(key)}
          caption={text.keyCaption}
          copyLabel={text.copyKey}
          copiedLabel={text.keyCopied}
          hint={text.keyHint}
          copiedHint={text.keyCopiedHint}
          failedHint={text.keyFailedHint}
        />
      ) : null}
      {pix.copy_paste_code ? (
        <PixCopy
          value={pix.copy_paste_code}
          caption={text.codeCaption}
          copyLabel={text.copyCode}
          copiedLabel={text.codeCopied}
          hint={text.codeHint}
          copiedHint={text.codeCopiedHint}
          failedHint={text.codeFailedHint}
          long
          className="border-t border-border pt-4"
        />
      ) : null}
    </section>
  );
}

/** Como contribuir em 3 passos e o versículo (conteúdo fixo, versionado no código). */
function Steps({ beneficiary }: { beneficiary: string }) {
  return (
    <section
      aria-labelledby="passos"
      className="flex min-w-[min(100%,21rem)] flex-[1_1_21rem] flex-col gap-4"
    >
      <h2 id="passos" className="m-0 text-[22px] leading-tight">
        {text.stepsHeading}
      </h2>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        <li className="flex items-start gap-3.5 rounded-[14px] border border-border bg-muted p-4">
          <span aria-hidden="true" className={STEP_NUMBER}>
            1
          </span>
          <span>
            {text.step1} <strong>{text.step1Strong}</strong>.
          </span>
        </li>
        <li className="flex items-start gap-3.5 rounded-[14px] border border-border bg-muted p-4">
          <span aria-hidden="true" className={STEP_NUMBER}>
            2
          </span>
          <span>{text.step2}</span>
        </li>
        <li className="flex items-start gap-3.5 rounded-[14px] border border-border bg-muted p-4">
          <span aria-hidden="true" className={STEP_NUMBER}>
            3
          </span>
          <span>
            {text.step3Before} <strong>{beneficiary}</strong> {text.step3After}
          </span>
        </li>
      </ol>
      <figure className="m-0 mt-2 rounded-[14px] border border-info-border bg-info p-5 text-info-foreground">
        <blockquote className="m-0 text-[19px] italic">“{text.verse}”</blockquote>
        <figcaption className="mt-1.5 text-sm font-bold">{text.verseRef}</figcaption>
      </figure>
    </section>
  );
}

/**
 * O conteúdo da página Contribua (design: Contribua; CAP-04). Os dados do PIX vêm das configurações públicas
 * (`data/settings.json` com a API de reserva), nunca de constantes no código (BG-3): quando a Tesouraria troca a chave no
 * painel, o site passa a mostrar a nova em até 1 minuto. A campanha só aparece enquanto está ativa.
 */
export function ContribuaContent() {
  const { settings, isPending, isError, isFetching, refetch } = usePublicSettings();

  if (isError) {
    return (
      <section className="container py-8">
        <ErrorState
          message={messages.errors.generic}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </section>
    );
  }

  if (isPending || !settings) {
    return (
      <section className="container py-8">
        <LoadingBlock count={3} />
      </section>
    );
  }

  const pix = settings.pix;
  const campaign = settings.campaign_notice?.active ? settings.campaign_notice : null;

  if (!pix?.pix_key) {
    return (
      <section className="container py-8">
        <p className="m-0 rounded-2xl border border-border p-6" role="status">
          {text.unavailable}
        </p>
      </section>
    );
  }

  return (
    <div className="container flex flex-wrap items-start gap-4 pt-6 pb-12">
      <PixCard pix={pix} />
      <Steps beneficiary={pix.beneficiary_name ?? ""} />
      {campaign ? (
        <section
          aria-labelledby="campanha"
          className="flex flex-[1_1_100%] flex-col gap-2.5 rounded-2xl bg-footer p-6 text-footer-text"
        >
          <p className="m-0 text-[13px] font-bold tracking-widest text-highlight uppercase">
            {text.campaign}
          </p>
          {campaign.title ? (
            <h2 id="campanha" className="m-0 text-[22px] leading-tight text-footer-foreground">
              {campaign.title}
            </h2>
          ) : null}
          {campaign.text ? <p className="m-0">{campaign.text}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
