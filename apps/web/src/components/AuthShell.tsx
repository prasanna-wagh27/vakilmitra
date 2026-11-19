import { Link01Icon, ShieldKeyIcon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Brand } from "./Brand";
import { LanguageToggle } from "./LanguageToggle";

/** The signed-out pages: what VakilMitra is on one side, the form on the other. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  const trust = [
    { icon: SquareLock02Icon, text: t("auth.trust1") },
    { icon: Link01Icon, text: t("auth.trust2") },
    { icon: ShieldKeyIcon, text: t("auth.trust3") },
  ];
  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl content-start items-center gap-4 px-4 py-4 md:content-center md:grid-cols-[1.05fr_1fr] md:gap-10 md:py-10">
      {/* Brand side: what this is and why it can be trusted. */}
      <section className="px-1 py-2 md:py-0">
        <Brand />
        <h1 className="font-display mt-6 text-2xl leading-8 md:mt-10 md:text-4xl md:leading-[1.15]">{t("auth.hero")}</h1>
        <p className="mt-3 hidden max-w-md text-muted-foreground sm:block">{t("auth.heroSub")}</p>
        <ul className="mt-8 hidden space-y-3 border-t pt-6 sm:block">
          {trust.map((x) => (
            <li key={x.text} className="flex items-center gap-3 text-sm">
              <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {x.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel w-full p-6">
        <div className="mb-6 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl">{title}</h2>
          <LanguageToggle />
        </div>
        {children}
        <ul className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t pt-5 text-xs text-muted-foreground sm:hidden">
          {trust.map((x) => (
            <li key={x.text} className="flex items-center gap-1.5">
              <HugeiconsIcon icon={x.icon} className="size-3.5" aria-hidden />
              {x.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
