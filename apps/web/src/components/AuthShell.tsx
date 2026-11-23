import { Link01Icon, ShieldKeyIcon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Brand } from "./Brand";
import { LanguageToggle } from "./LanguageToggle";
import { PolicyFooter } from "./legal/LegalPage";

/** The signed-out pages: what VakilMitra is on one side, the form on the other. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  const trust = [
    { icon: SquareLock02Icon, text: t("auth.trust1") },
    { icon: Link01Icon, text: t("auth.trust2") },
    { icon: ShieldKeyIcon, text: t("auth.trust3") },
  ];
  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl content-start items-center gap-4 px-4 py-4 md:content-center md:grid-cols-[1.05fr_1fr] md:gap-8 md:py-10">
      {/* Brand side: what this is and why it can be trusted. */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-lilac-deep p-6 text-white md:flex md:min-h-[34rem] md:flex-col md:justify-between md:rounded-[2rem] md:p-10">
        <Link to="/" aria-label={t("app.name")} className="self-start">
          <Brand />
        </Link>
        <div>
          <h1 className="font-display mt-8 text-[1.75rem] leading-[1.15] text-balance md:mt-0 md:text-5xl md:leading-[1.05]">
            {t("auth.hero")}
          </h1>
          <p className="mt-4 hidden max-w-md text-white/70 sm:block md:text-lg">{t("auth.heroSub")}</p>
        </div>
        <ul className="mt-8 hidden space-y-3 border-t border-white/15 pt-6 sm:block">
          {trust.map((x) => (
            <li key={x.text} className="flex items-center gap-3 text-sm text-white/85">
              <HugeiconsIcon icon={x.icon} className="size-4 shrink-0 text-lilac-text" aria-hidden />
              {x.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel w-full p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl">{title}</h2>
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
      <PolicyFooter className="border-0 md:col-span-2" />
    </main>
  );
}
