import type { SitePhoto } from "~/content/photos";

/** As larguras que `scripts/optimize-images.py` gera; todas as fotos são 3:2 (1600 × 1067 na maior). */
const WIDTHS = [480, 800, 1200, 1600] as const;
const INTRINSIC = { width: 1600, height: 1067 } as const;

/**
 * Foto do site com `srcset`: o navegador escolhe a menor variante que cobre o espaço (`sizes`), em WebP. A proporção e o
 * raio vêm de `className` (`aspect-3/2 rounded-2xl`: sempre os dois, porque aqui não há tailwind-merge); a moldura
 * reserva o espaço antes de a imagem chegar, sem salto de layout. `imgClassName` ajusta o recorte (`object-[50%_30%]`).
 * `priority` é só para a imagem que pode ser a maior do primeiro viewport: carrega já e com prioridade; as demais ficam
 * preguiçosas.
 */
export function Photo({
  photo,
  sizes,
  priority = false,
  className,
  imgClassName,
}: {
  photo: SitePhoto;
  sizes: string;
  priority?: boolean;
  className: string;
  imgClassName?: string;
}) {
  const url = (width: number) => `/images/${photo.name}-${width}.webp`;

  return (
    <div className={`overflow-hidden bg-muted ${className}`}>
      <img
        src={url(800)}
        srcSet={WIDTHS.map((width) => `${url(width)} ${width}w`).join(", ")}
        sizes={sizes}
        width={INTRINSIC.width}
        height={INTRINSIC.height}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={`block size-full object-cover ${imgClassName ?? ""}`}
      />
    </div>
  );
}
