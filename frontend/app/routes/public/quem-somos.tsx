import { aboutMessages } from "~/features/content/messages";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  ChevronRightIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  HeartIcon,
  UsersIcon,
  WineIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import {
  churchAge,
  creedUrl,
  formerPastors,
  howWeAre,
  lordsSupper,
  pastorWithTwoTerms,
  timeline,
  titularPastor,
  type Pillar,
} from "~/content/quem-somos";
import { photos, portraits } from "~/content/photos";
import { PastorPortrait } from "~/features/content/components/pastor-portrait";
import { PhotoHero } from "~/shared/layout/photo-hero";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { buttonClassName } from "~/shared/ui/button-variants";

export function meta() {
  return pageMeta({
    title: "Quem somos",
    description:
      "A história da Primeira Igreja Batista em Lagoa Santa, fundada em 1985 no bairro Promissão: linha do tempo, pastores e no que cremos.",
    path: "/quem-somos",
  });
}

// `scroll-mt` nos títulos: o atalho "Nesta página" não encosta o título na borda da tela
const sectionTitle =
  "m-0 scroll-mt-8 text-balance text-2xl leading-tight tracking-tight md:text-3xl";
const eyebrow = "m-0 text-sm font-bold tracking-wider text-primary uppercase";

const pillarIcons: Record<Pillar["key"], LucideIcon> = {
  biblia: BookOpenIcon,
  amor: HeartHandshakeIcon,
  missao: GlobeIcon,
};

/** Atalhos para as seções, na ordem da página; o `href` é o `id` do título de cada uma. */
const sections = [
  { id: "como-somos", label: aboutMessages.howWeAre },
  { id: "historia", label: aboutMessages.ourHistory },
  { id: "pastor", label: aboutMessages.titularPastor },
  { id: "cremos", label: aboutMessages.whatWeBelieve },
] as const;

/**
 * Quem somos (design: QuemSomos, redesenhado a pedido do responsável): abertura com a foto e os anos de fé, o jeito da
 * igreja em blocos, a linha do tempo, o pastor titular, os pastores que serviram e, lado a lado, a Declaração de Fé e o
 * convite para ser membro. O conteúdo vem de `~/content/quem-somos`.
 */
export default function QuemSomos() {
  // O número é calculado no navegador a cada visita; no HTML pré-renderizado vale o do dia do build
  const age = churchAge();
  const lastMilestone = timeline.length - 1;

  return (
    <>
      <PhotoHero
        eyebrow={aboutMessages.aboutEyebrow}
        title={aboutMessages.aboutTitle}
        intro={aboutMessages.aboutIntro}
        photo={photos.about}
        badge={{ value: age, label: aboutMessages.yearsOfFaith }}
      >
        <nav aria-label={aboutMessages.onThisPage} className="mt-1">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-background px-4 text-[15px] font-semibold text-foreground no-underline ring-1 ring-border transition-[color,box-shadow] hover:text-primary hover:ring-primary"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PhotoHero>

      <section aria-labelledby="como-somos" className="pt-10 pb-12 md:py-20">
        <div className="container flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className={eyebrow}>{aboutMessages.howWeAreEyebrow}</p>
            <h2 id="como-somos" className={sectionTitle}>
              {aboutMessages.howWeAre}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col justify-between gap-10 rounded-3xl bg-primary p-7 text-primary-foreground md:p-10">
              <HeartIcon aria-hidden="true" className="size-9" />
              <p className="m-0 text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-[2.75rem] md:leading-[1.1]">
                {howWeAre.highlight}
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-3xl bg-muted p-7">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-background text-primary">
                <WineIcon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="m-0 text-xl leading-tight">{lordsSupper.title}</h3>
              <p className="m-0 text-foreground/80">{lordsSupper.text}</p>
            </div>

            <ul className="m-0 grid list-none gap-4 p-0 md:col-span-2 md:grid-cols-3">
              {howWeAre.pillars.map((pillar) => {
                const Icon = pillarIcons[pillar.key];
                return (
                  <li
                    key={pillar.key}
                    className="flex flex-col gap-3 rounded-3xl border border-border p-7"
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-info text-info-foreground">
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <h3 className="m-0 text-xl leading-tight">{pillar.title}</h3>
                    <p className="m-0 text-foreground/80">{pillar.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="historia"
        className="border-y border-border bg-muted py-12 md:py-20"
      >
        <div className="container grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-16">
          <div className="flex flex-col items-start gap-4 md:sticky md:top-8 md:self-start">
            <p className={eyebrow}>{aboutMessages.historyEyebrow}</p>
            <h2 id="historia" className={sectionTitle}>
              {aboutMessages.ourHistory}
            </h2>
            <p className="m-0 text-lg text-pretty text-muted-foreground">
              {aboutMessages.historyIntro}
            </p>
            <Link
              to="/contribua"
              className={buttonClassName({ size: "lg", className: "mt-2 px-5 font-bold" })}
            >
              {aboutMessages.supportRebuild}
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </div>

          {/* Cada marco liga o seu ponto ao do seguinte (centro a 44 px do topo; 16 px de espaço entre os marcos), então
              a linha termina no último. O último marco (a reconstrução, em curso) fica em destaque */}
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {timeline.map((milestone, index) => {
              const current = index === lastMilestone;
              return (
                <li
                  key={milestone.year}
                  className={`relative grid grid-cols-[2.5rem_1fr] gap-4 ${current ? "" : "before:absolute before:top-11 before:-bottom-15 before:left-5 before:w-0.5 before:-translate-x-1/2 before:bg-info-border"}`}
                >
                  <span
                    aria-hidden="true"
                    className="relative z-10 mt-6 flex size-10 items-center justify-center rounded-full bg-background ring-2 ring-info-border"
                  >
                    <span className="size-3 rounded-full bg-primary" />
                  </span>
                  <div
                    className={
                      current
                        ? "rounded-2xl bg-primary p-5 text-primary-foreground md:p-6"
                        : "rounded-2xl bg-background p-5 ring-1 ring-border md:p-6"
                    }
                  >
                    <span
                      className={`block text-2xl leading-none font-extrabold tracking-tight tabular-nums ${current ? "" : "text-primary"}`}
                    >
                      {milestone.year}
                    </span>
                    <h3 className="mt-2 mb-1 text-xl leading-snug">{milestone.title}</h3>
                    <p className={current ? "m-0" : "m-0 text-foreground/80"}>{milestone.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section aria-labelledby="pastor" className="py-12 md:py-20">
        <div className="container flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className={eyebrow}>{aboutMessages.pastorEyebrow}</p>
            <h2 id="pastor" className={sectionTitle}>
              {aboutMessages.titularPastor}
            </h2>
          </div>

          <article className="grid overflow-hidden rounded-3xl border border-border md:grid-cols-[20rem_1fr]">
            <div className="flex flex-col items-center gap-5 bg-muted p-8 text-center md:items-start md:p-10 md:text-left">
              <div className="rounded-full bg-background p-1.5 shadow-sm ring-1 ring-border">
                <PastorPortrait portrait={portraits.pastor} name={titularPastor.name} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-2xl leading-tight font-extrabold tracking-tight text-balance md:text-[28px]">
                  {titularPastor.name}
                </p>
                {titularPastor.since ? (
                  <p className="m-0 flex items-start justify-center gap-2 text-foreground/80 md:justify-start">
                    <CalendarIcon
                      aria-hidden="true"
                      className="mt-1 size-[18px] flex-none text-primary"
                    />
                    À frente da igreja desde {titularPastor.since}.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-8 p-6 sm:p-8 md:p-10">
              <div className="flex max-w-prose flex-col gap-4">
                {titularPastor.biography.map((paragraph, index) => (
                  <p
                    key={paragraph}
                    className={
                      index === 0
                        ? "m-0 text-lg leading-relaxed md:text-xl"
                        : "m-0 leading-relaxed text-foreground/80"
                    }
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="m-0 flex items-center gap-2 text-lg">
                  <GraduationCapIcon aria-hidden="true" className="size-5 flex-none text-primary" />
                  {aboutMessages.pastorEducation}
                </h3>
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                  {titularPastor.education.map((item) => (
                    <li
                      key={item.title}
                      className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-muted p-4"
                    >
                      <span className="font-bold">{item.title}</span>
                      {item.institution ? (
                        <span className="text-[15px] break-words text-muted-foreground">
                          {item.institution}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="ex-pastores" className="pb-12 md:pb-20">
        <div className="container flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 id="ex-pastores" className="m-0 text-xl leading-tight tracking-tight md:text-2xl">
              {aboutMessages.formerPastors}
            </h2>
            <p className="m-0 text-muted-foreground">
              {aboutMessages.formerPastorsHint(pastorWithTwoTerms)}
            </p>
          </div>
          <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {formerPastors.map((name, index) => (
              <li
                key={name}
                className="flex min-h-16 items-center gap-4 rounded-2xl border border-border px-5 py-3"
              >
                <span
                  aria-hidden="true"
                  className="flex-none text-2xl leading-none font-extrabold text-primary tabular-nums"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 font-semibold">Pr. {name}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="container grid gap-4 pb-16 md:grid-cols-2 md:pb-24">
        <section
          aria-labelledby="cremos"
          className="relative overflow-hidden rounded-3xl bg-footer p-7 text-footer-foreground md:p-10"
        >
          <BookOpenIcon
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -bottom-6 size-32 text-footer-border/60 md:-right-8 md:-bottom-8 md:size-44"
          />
          {/* `relative`: o texto e o botão ficam acima do ícone decorativo */}
          <div className="relative flex h-full flex-col items-start gap-4">
            <p className="m-0 text-sm font-bold tracking-wider text-footer-muted uppercase">
              {aboutMessages.creedEyebrow}
            </p>
            <h2 id="cremos" className={sectionTitle}>
              {aboutMessages.whatWeBelieve}
            </h2>
            <p className="m-0 text-footer-text">{aboutMessages.creedText}</p>
            <a
              href={creedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                // A variante herda a cor do texto; sobre o cartão escuro, ela precisa ser a escura do botão claro
                className: "mt-auto px-5 font-bold text-foreground",
              })}
            >
              <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
              {aboutMessages.readCreed}
              <span className="sr-only"> {messages.forms.opensInNewTab}</span>
            </a>
          </div>
        </section>

        <section
          aria-labelledby="ser-membro"
          className="flex flex-col items-start gap-4 rounded-3xl bg-info p-7 text-info-foreground ring-1 ring-info-border md:p-10"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-background text-primary">
            <UsersIcon aria-hidden="true" className="size-6" />
          </span>
          <h2 id="ser-membro" className={sectionTitle}>
            {aboutMessages.memberTitle}
          </h2>
          <p className="m-0">{aboutMessages.memberHint}</p>
          <Link
            to="/quero-ser-membro"
            className={buttonClassName({ size: "lg", className: "mt-auto px-5 font-bold" })}
          >
            {aboutMessages.memberCta}
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </>
  );
}
