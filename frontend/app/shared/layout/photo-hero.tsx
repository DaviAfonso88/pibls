import type { ReactNode } from "react";
import type { SitePhoto } from "~/content/photos";
import { Photo } from "~/shared/ui/photo";

/**
 * Abertura das páginas institucionais (Quem somos, Ministérios): etiqueta, o `h1`, uma frase de apoio e, se houver, algo
 * mais embaixo (atalhos), com a foto ao lado no desktop e embaixo no celular. O selo opcional (um número e o que ele
 * conta) fica sobre o canto da foto ou, com `badgeBelowPhoto`, quase todo abaixo dela, quando há rostos nesse canto. O
 * espaço do selo é reservado mesmo sem ele, então um número que chega depois (da API) não desloca a página.
 */
export function PhotoHero({
  eyebrow,
  title,
  intro,
  photo,
  imgClassName,
  badge,
  badgeBelowPhoto = false,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  photo: SitePhoto;
  /** Ajuste do recorte da foto (`object-[50%_35%]`). */
  imgClassName?: string;
  badge?: { value: ReactNode; label: string } | null;
  badgeBelowPhoto?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="bg-linear-to-b from-muted to-background pt-8 pb-6 md:pt-16 md:pb-20">
      <div className="container grid items-center gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
        <div className="flex flex-col items-start gap-5">
          <p className="m-0 rounded-full bg-background px-3.5 py-1.5 text-[13px] font-bold tracking-wider text-primary uppercase ring-1 ring-border">
            {eyebrow}
          </p>
          <h1 className="m-0 text-[2.5rem] leading-[1.05] tracking-tight text-balance md:text-6xl">
            {title}
          </h1>
          <p className="m-0 max-w-prose text-lg text-pretty text-muted-foreground md:text-xl">
            {intro}
          </p>
          {children}
        </div>

        <div className={`relative md:mb-0 ${badgeBelowPhoto ? "mb-20" : "mb-10"}`}>
          <Photo
            photo={photo}
            priority
            sizes="(min-width: 1152px) 540px, (min-width: 768px) 52vw, calc(100vw - 2rem)"
            className="aspect-3/2 rounded-3xl md:aspect-4/3"
            imgClassName={imgClassName}
          />
          {badge ? (
            <div
              className={`absolute left-4 flex items-end gap-3 rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-xl shadow-primary/25 md:-left-6 ${badgeBelowPhoto ? "-bottom-20" : "-bottom-10 md:-bottom-6"}`}
            >
              <span className="text-6xl leading-none font-extrabold tracking-tight tabular-nums">
                {badge.value}
              </span>
              <span className="max-w-[8rem] pb-1 text-lg leading-tight font-bold">
                {badge.label}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
