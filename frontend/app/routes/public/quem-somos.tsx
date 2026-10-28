import { aboutMessages } from "~/features/content/messages";
import {
  BookOpenIcon,
  CalendarIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  UsersIcon,
  WineIcon,
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
} from "~/content/quem-somos";
import { photos, portraits } from "~/content/photos";
import { PastorPortrait } from "~/features/content/components/pastor-portrait";
import { PageHeader } from "~/shared/layout/page-header";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { buttonClassName } from "~/shared/ui/button-variants";
import { Photo } from "~/shared/ui/photo";

export function meta() {
  return pageMeta({
    title: "Quem somos",
    description:
      "A história da Primeira Igreja Batista em Lagoa Santa, fundada em 1985 no bairro Promissão: linha do tempo, pastores e no que cremos.",
    path: "/quem-somos",
  });
}

export default function QuemSomos() {
  // O número é calculado no navegador a cada visita; no HTML pré-renderizado vale o do dia do build
  const age = churchAge();

  return (
    <>
      <PageHeader title={aboutMessages.aboutTitle} className="pb-8">
        {/* O cartão e a foto dividem a faixa; em tela estreita a foto desce para baixo do cartão */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-[min(100%,18rem)] flex-[1_1_18rem] flex-col gap-1 rounded-2xl bg-primary p-6 text-primary-foreground">
            <span className="text-6xl leading-none font-extrabold tracking-tight">{age}</span>
            <span className="text-xl font-bold">{aboutMessages.yearsOfFaith}</span>
            <span className="mt-2 text-primary-foreground">
              Desde 13 de janeiro de 1985, quando a igreja nasceu no bairro Promissão, em Lagoa
              Santa.
            </span>
          </div>
          <Photo
            photo={photos.youth}
            priority
            sizes="(min-width: 1152px) 560px, (min-width: 704px) calc(50vw - 3rem), calc(100vw - 2rem)"
            className="aspect-16/9 min-w-[min(100%,18rem)] flex-[1_1_22rem] rounded-2xl"
            imgClassName="object-[50%_35%]"
          />
        </div>
      </PageHeader>

      <section aria-labelledby="historia" className="py-10">
        <div className="container flex max-w-3xl flex-col gap-5">
          <h2 id="historia" className="m-0 text-2xl leading-tight">
            {aboutMessages.ourHistory}
          </h2>
          <ol className="m-0 ml-2 flex list-none flex-col gap-6 border-l-2 border-info-border p-0">
            {timeline.map((milestone) => (
              <li key={milestone.year} className="relative pl-6">
                <span
                  aria-hidden="true"
                  className="absolute top-1 -left-[9px] size-4 rounded-full border-[3px] border-background bg-primary"
                />
                <span className="block text-[15px] font-extrabold text-primary">
                  {milestone.year}
                </span>
                <h3 className="mt-0.5 mb-1 text-lg leading-snug">{milestone.title}</h3>
                <p className="m-0 text-foreground/80">{milestone.text}</p>
              </li>
            ))}
          </ol>
          <Link
            to="/contribua"
            className="inline-flex min-h-11 items-center self-start font-bold text-primary underline-offset-4 hover:underline"
          >
            {aboutMessages.supportRebuild}
          </Link>
        </div>
      </section>

      <section aria-labelledby="pastor" className="border-y border-border bg-muted py-10">
        <div className="container flex max-w-3xl flex-col gap-5">
          <h2 id="pastor" className="m-0 text-2xl leading-tight">
            {aboutMessages.titularPastor}
          </h2>
          <article className="flex flex-col gap-6 rounded-2xl border border-border bg-background p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
              <PastorPortrait portrait={portraits.pastor} name={titularPastor.name} />
              <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-2">
                <p className="m-0 text-balance text-[28px] leading-tight font-extrabold tracking-tight">
                  {titularPastor.name}
                </p>
                {titularPastor.since ? (
                  <p className="m-0 flex items-center gap-2 text-foreground/80">
                    <CalendarIcon
                      aria-hidden="true"
                      className="size-[18px] flex-none text-primary"
                    />
                    À frente da igreja desde {titularPastor.since}.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex max-w-prose flex-col gap-3">
              {titularPastor.biography.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className={
                    index === 0
                      ? "m-0 text-lg leading-relaxed"
                      : "m-0 leading-relaxed text-foreground/80"
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-5">
              <h3 className="m-0 flex items-center gap-2 text-lg">
                <GraduationCapIcon aria-hidden="true" className="size-5 flex-none text-primary" />
                {aboutMessages.pastorEducation}
              </h3>
              <ul className="m-0 grid list-none gap-x-8 gap-y-3 p-0 sm:grid-cols-2">
                {titularPastor.education.map((item) => (
                  <li key={item.title} className="flex min-w-0 flex-col">
                    <span className="font-bold">{item.title}</span>
                    {item.institution ? (
                      <span className="text-[15px] text-muted-foreground">{item.institution}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="ex-pastores" className="py-10">
        <div className="container flex max-w-3xl flex-col gap-3">
          <h2 id="ex-pastores" className="m-0 text-2xl leading-tight">
            {aboutMessages.formerPastors}
          </h2>
          <p className="m-0 text-muted-foreground">
            Na ordem do Guia Institucional. O Pr. {pastorWithTwoTerms} pastoreou a igreja em duas
            ocasiões.
          </p>
          <ol className="m-0 mt-1 flex list-none flex-col border-t border-border p-0">
            {formerPastors.map((name, index) => (
              <li
                key={name}
                className="flex min-h-[52px] items-center gap-3.5 border-b border-border"
              >
                <span
                  aria-hidden="true"
                  className="flex size-7 flex-none items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground/80"
                >
                  {index + 1}
                </span>
                <span className="font-semibold">Pr. {name}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="como-somos" className="pb-10">
        <div className="container flex max-w-3xl flex-col gap-4">
          <h2 id="como-somos" className="m-0 text-2xl leading-tight">
            {aboutMessages.howWeAre}
          </h2>
          <p className="m-0 max-w-prose text-lg leading-relaxed">{howWeAre.intro}</p>
          <p className="m-0 text-balance text-2xl leading-snug font-extrabold text-primary">
            {howWeAre.highlight}
          </p>
          <div className="mt-2 flex items-start gap-3.5 rounded-2xl border border-border p-6">
            <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-info text-info-foreground">
              <WineIcon aria-hidden="true" className="size-[22px]" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h3 className="m-0 text-[22px] leading-tight">{lordsSupper.title}</h3>
              <p className="m-0 max-w-prose text-foreground/80">{lordsSupper.text}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="cremos" className="pb-10">
        <div className="container max-w-3xl">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border p-6">
            <h2 id="cremos" className="m-0 text-[22px] leading-tight">
              {aboutMessages.whatWeBelieve}
            </h2>
            <p className="m-0 text-foreground/80">
              Somos uma igreja batista filiada à Convenção Batista Brasileira (CBB) e seguimos a sua
              Declaração Doutrinária.
            </p>
            <a
              href={creedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                className: "mt-1.5 self-start px-5 font-bold",
              })}
            >
              <BookOpenIcon data-icon="inline-start" aria-hidden="true" />
              {aboutMessages.readCreed}
              <span className="sr-only"> {messages.forms.opensInNewTab}</span>
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="ser-membro" className="pb-12">
        <div className="container max-w-3xl">
          <article className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border border-info-border bg-info p-6 text-info-foreground">
            <div className="flex min-w-[min(100%,16rem)] flex-[2_1_16rem] items-start gap-3.5">
              <UsersIcon aria-hidden="true" className="mt-0.5 size-7 flex-none" />
              <div className="flex flex-col gap-1.5">
                <h2 id="ser-membro" className="m-0 text-[22px] leading-tight">
                  {aboutMessages.memberTitle}
                </h2>
                <p className="m-0">{aboutMessages.memberHint}</p>
              </div>
            </div>
            <Link
              to="/quero-ser-membro"
              className={buttonClassName({
                size: "lg",
                className: "min-w-52 flex-1 px-5 font-bold sm:flex-none",
              })}
            >
              {aboutMessages.memberCta}
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
