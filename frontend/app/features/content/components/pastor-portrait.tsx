import type { SitePortrait } from "~/content/photos";

/** As larguras (quadradas) que `scripts/optimize-images.py` gera para os retratos. */
const WIDTHS = [160, 320, 480] as const;

/** "Pr. Alan Gefferson de Assunção Taques" → "AT": a inicial do primeiro nome e a do último, sem o "Pr.". */
export function initialsOf(name: string): string {
  const words = name
    .replace(/^pr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";

  return `${first}${last}`.toUpperCase();
}

const frame =
  "size-36 flex-none overflow-hidden rounded-full border border-border bg-info sm:size-44";

/**
 * Retrato redondo de uma pessoa (design: Quem somos, pastor titular). Com o retrato publicado, mostra a foto quadrada em
 * WebP com `srcset`; sem ele, as iniciais sobre o fundo de destaque, que não dizem nada a quem usa leitor de tela
 * (a pessoa já está no texto ao lado). O tamanho é fixo, então a foto chega sem deslocar o layout.
 */
export function PastorPortrait({
  portrait,
  name,
}: {
  portrait: SitePortrait | null;
  name: string;
}) {
  if (portrait === null) {
    return (
      <div
        aria-hidden="true"
        className={`${frame} flex items-center justify-center text-5xl font-extrabold tracking-tight text-info-foreground`}
      >
        {initialsOf(name)}
      </div>
    );
  }

  const url = (width: number) => `/images/${portrait.name}-${width}.webp`;

  return (
    <div className={frame}>
      <img
        src={url(320)}
        srcSet={WIDTHS.map((width) => `${url(width)} ${width}w`).join(", ")}
        sizes="(min-width: 640px) 176px, 144px"
        width={480}
        height={480}
        alt={portrait.alt}
        loading="lazy"
        decoding="async"
        className="block size-full object-cover"
      />
    </div>
  );
}
