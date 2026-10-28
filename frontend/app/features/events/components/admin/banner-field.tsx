import { useEffect, useState } from "react";
import { Button } from "~/shared/ui/button";
import { FileDrop } from "~/shared/ui/file-drop";
import { eventAdminMessages } from "../../admin-messages";

const { form: text } = eventAdminMessages;

const ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * A imagem de capa do evento (BR-045): JPEG, PNG ou WebP de até 3 MB. A escolha só vira envio quando a pessoa salva o
 * evento; até lá, a tela mostra a nova imagem (ou a atual, ou o aviso de que ela será removida). O servidor confere o
 * conteúdo de verdade e gera as versões de 1600 e 800 px.
 */
export function BannerField({
  currentUrl,
  file,
  removed,
  onFileChange,
  onRemovedChange,
  error,
  disabled = false,
}: {
  /** A imagem pequena já salva no servidor, se houver. */
  currentUrl: string | null;
  file: File | null;
  removed: boolean;
  onFileChange: (file: File | null) => void;
  onRemovedChange: (removed: boolean) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file === null || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = previewUrl ?? (removed ? null : currentUrl);

  return (
    <div className="flex flex-col gap-3">
      {shown !== null ? (
        <img
          src={shown}
          alt=""
          width={800}
          height={419}
          loading="lazy"
          className="aspect-[1.91/1] w-full rounded-[10px] border border-border object-cover"
        />
      ) : null}

      {file !== null ? (
        <p className="m-0 text-sm font-semibold">{text.bannerChosen(file.name)}</p>
      ) : null}

      {removed && file === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0" role="status">
            {text.bannerRemoved}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onRemovedChange(false)}
          >
            {text.bannerUndoRemove}
          </Button>
        </div>
      ) : null}

      <FileDrop
        id="banner"
        label={text.bannerLabel}
        hint={text.bannerHint}
        accept={ACCEPT}
        maxBytes={MAX_BYTES}
        file={file}
        onFileChange={(next) => {
          onFileChange(next);
          if (next !== null) onRemovedChange(false);
        }}
        typeMessage={text.bannerType}
        sizeMessage={text.bannerSize}
        error={error}
        disabled={disabled}
      />

      {currentUrl !== null && !removed && file === null ? (
        <Button
          type="button"
          variant="outline"
          className="self-start font-bold text-destructive"
          disabled={disabled}
          onClick={() => onRemovedChange(true)}
        >
          {text.bannerRemove}
        </Button>
      ) : null}
    </div>
  );
}
