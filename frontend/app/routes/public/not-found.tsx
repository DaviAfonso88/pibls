import { ChevronRightIcon } from "lucide-react";
import { Link } from "react-router";
import { messages } from "~/shared/messages";
import { pageMeta } from "~/shared/seo/meta";
import { buttonClassName } from "~/shared/ui/button-variants";

export function meta() {
  return pageMeta({
    title: messages.states.notFoundTitle,
    description: messages.states.notFoundText,
    path: "/",
    // Uma página que não existe não entra no Google
    noindex: true,
  });
}

const shortcuts = [
  { to: "/", label: messages.states.notFoundHome, primary: true },
  { to: "/#horarios", label: messages.states.notFoundSchedules, primary: false },
  { to: "/contato", label: messages.states.notFoundContact, primary: false },
] as const;

/** 404 amigável (design: NaoEncontrado): três caminhos para o que as pessoas mais procuram. */
export default function NaoEncontrado() {
  return (
    <div className="container flex max-w-[35rem] flex-col gap-4 py-14">
      <p className="m-0 text-sm font-bold tracking-wider text-primary uppercase">
        {messages.states.notFoundEyebrow}
      </p>
      <h1 className="m-0 text-balance">{messages.states.notFoundTitle}</h1>
      <p className="m-0 text-lg text-muted-foreground">{messages.states.notFoundText}</p>

      <nav
        aria-label={messages.states.notFoundShortcutsLabel}
        className="mt-2 flex flex-col gap-2.5"
      >
        {shortcuts.map(({ to, label, primary }) => (
          <Link
            key={to}
            to={to}
            className={buttonClassName({
              variant: primary ? "default" : "outline",
              size: "lg",
              className: "h-14 justify-between px-4 font-bold",
            })}
          >
            {label}
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
