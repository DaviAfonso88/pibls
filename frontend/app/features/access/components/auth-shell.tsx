import type { ReactNode } from "react";
import { Link } from "react-router";
import { accessMessages } from "../messages";

/**
 * Moldura das telas de entrada (design: AdminEntrar): marca, um cartão de 420 px com o formulário e o aviso de "sem acesso".
 * O painel não é indexado: `noindex` fica no layout do painel, não aqui.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center gap-6 bg-muted px-4 py-12 sm:py-16">
      <Link
        to="/"
        className="flex min-h-11 flex-col items-center gap-1 rounded-2xl border border-border bg-card px-6 py-3 text-foreground no-underline hover:text-foreground"
      >
        <img
          src="/logos/logo-horizontal.png"
          width={286}
          height={100}
          alt="PIBLS"
          decoding="async"
          className="block h-12 w-auto flex-none"
        />
        <span className="text-sm text-muted-foreground">{accessMessages.church}</span>
      </Link>

      <main
        id="conteudo"
        className="flex w-full max-w-105 flex-col gap-5 rounded-2xl border border-border bg-card p-8 shadow-xs"
      >
        {children}
      </main>

      <p className="m-0 max-w-105 text-center text-sm text-muted-foreground">
        {accessMessages.noAccessYet}{" "}
        <Link to="/" className="font-semibold text-primary underline underline-offset-2">
          {accessMessages.backToSite}
        </Link>
      </p>
    </div>
  );
}

/** Título e frase de apoio de uma tela de entrada. */
export function AuthHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 text-2xl leading-tight font-extrabold text-balance">{title}</h1>
      {intro ? <p className="m-0 text-muted-foreground">{intro}</p> : null}
    </div>
  );
}
