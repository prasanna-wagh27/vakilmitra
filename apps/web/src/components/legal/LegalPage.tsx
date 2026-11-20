import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LEGAL, legalComplete } from "@/lib/legal";
import { cn } from "@/lib/utils";
import { Brand } from "../Brand";
import { LanguageToggle } from "../LanguageToggle";

export const POLICY_LINKS = [
  { to: "/pricing", key: "legal.pricing" },
  { to: "/terms", key: "legal.terms" },
  { to: "/privacy", key: "legal.privacy" },
  { to: "/refunds", key: "legal.refunds" },
  { to: "/delivery", key: "legal.delivery" },
  { to: "/contact", key: "legal.contact" },
] as const;

/** A business detail from LEGAL, or a visible marker while it is missing. */
export function Fill({ v }: { v: string | null }) {
  const { t } = useI18n();
  return v ?? <mark className="rounded bg-warning-soft px-1 text-warning">{t("legal.toBeAdded")}</mark>;
}

/** Public pages (no sign-in): pricing and policies. */
export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/login" aria-label="VakilMitra">
            <Brand />
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-3xl">{title}</h1>
        {children}
      </main>
      <PolicyFooter />
    </div>
  );
}

/** A policy page. The text comes in full in each language; the caller renders the reader's one. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const { t, locale } = useI18n();
  return (
    <PublicPage title={title}>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("legal.updated")}{" "}
        {new Date(`${LEGAL.updated}T12:00:00`).toLocaleDateString(locale === "mr" ? "mr-IN" : "en-IN", { dateStyle: "long" })}
      </p>
      {!legalComplete() && <p className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">{t("legal.draft")}</p>}
      <article
        lang={locale}
        className={cn(
          "mt-6 max-w-3xl text-[15px] leading-7",
          "[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold",
          "[&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        )}
      >
        {children}
      </article>
    </PublicPage>
  );
}

export function PolicyFooter({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <footer className={cn("border-t", className)}>
      <nav className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-4 gap-y-2 px-4 py-5 text-xs text-muted-foreground">
        {POLICY_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="hover:text-foreground hover:underline" activeProps={{ className: "text-foreground" }}>
            {t(l.key)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
