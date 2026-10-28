import { privacyPolicy } from "~/content/privacidade";
import { PageHeader } from "~/shared/layout/page-header";
import { pageMeta } from "~/shared/seo/meta";
import { leadMessages } from "~/features/leads/messages";

export function meta() {
  return pageMeta({
    title: "Política de Privacidade",
    description:
      "Como a Primeira Igreja Batista em Lagoa Santa cuida dos dados enviados pelo site: o que coleta, para que usa, quem acessa e por quanto tempo guarda.",
    path: "/privacidade",
  });
}

function PolicySection({ title, paragraphs }: { title: string; paragraphs: readonly string[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-[21px] leading-snug text-foreground">{title}</h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="m-0">
          {paragraph}
        </p>
      ))}
    </section>
  );
}

/** Política de Privacidade vigente (design: Privacidade). O texto é conteúdo fixo, versionado no código. */
export default function Privacidade() {
  const { version, effectiveSince, sections, retention, closingSections } = privacyPolicy;

  return (
    <>
      <PageHeader
        title={leadMessages.privacyTitle}
        intro={`Versão ${version}${effectiveSince ? ` · em vigor desde ${effectiveSince}` : ""}`}
      />
      <article className="container pt-8 pb-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-7 leading-relaxed text-foreground/90">
          {sections.map((section) => (
            <PolicySection key={section.title} {...section} />
          ))}

          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-[21px] leading-snug text-foreground">{retention.title}</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr className="bg-muted text-left">
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 font-bold">
                      Dado
                    </th>
                    <th scope="col" className="border-b border-border px-3.5 py-2.5 font-bold">
                      Prazo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {retention.rows.map((row) => (
                    <tr key={row.data} className="border-b border-border last:border-b-0">
                      <td className="px-3.5 py-2.5 align-top">{row.data}</td>
                      <td className="px-3.5 py-2.5">{row.period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0">{retention.footnote}</p>
          </section>

          {closingSections.map((section) => (
            <PolicySection key={section.title} {...section} />
          ))}
        </div>
      </article>
    </>
  );
}
