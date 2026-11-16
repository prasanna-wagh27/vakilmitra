"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { Advocate } from "@/lib/types";
import { LanguageToggle } from "./LanguageToggle";
import { Loading } from "./ui";

const AdvocateCtx = createContext<{ advocate: Advocate; setAdvocate: (a: Advocate) => void } | null>(null);
export const useAdvocate = () => {
  const c = useContext(AdvocateCtx);
  if (!c) throw new Error("useAdvocate outside AppShell");
  return c;
};

const NAV: { href: string; key: MessageKey; icon: string }[] = [
  { href: "/", key: "nav.today", icon: "☀" },
  { href: "/cases", key: "nav.cases", icon: "📁" },
  { href: "/diary", key: "nav.diary", icon: "📅" },
  { href: "/clients", key: "nav.clients", icon: "👥" },
  { href: "/fees", key: "nav.fees", icon: "₹" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, setLocale } = useI18n();
  const pathname = usePathname();
  const [advocate, setAdvocate] = useState<Advocate | null>(null);

  useEffect(() => {
    api<{ advocate: Advocate }>("/auth/me")
      .then((r) => {
        setAdvocate(r.advocate);
        try {
          if (!localStorage.getItem("vm_locale")) setLocale(r.advocate.locale);
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined); // 401 redirects to /login inside api()
  }, [setLocale]);

  if (!advocate) return <Loading />;

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <AdvocateCtx.Provider value={{ advocate, setAdvocate }}>
      <header className="no-print surface sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <Link href="/" className="text-lg font-bold text-brand-700 dark:text-brand-100">{t("app.name")}</Link>
          <nav className="ml-6 hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-2 text-sm ${active(n.href) ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-100" : ""}`}>
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle persist />
            <Link href="/settings" aria-label={t("nav.settings")} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5">⚙</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-4 md:pb-10">{children}</main>
      <nav className="no-print surface fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                className={`flex min-h-14 flex-col items-center justify-center text-xs ${active(n.href) ? "font-semibold text-brand-600" : "muted"}`}
                aria-current={active(n.href) ? "page" : undefined}
              >
                <span aria-hidden className="text-lg leading-none">{n.icon}</span>
                {t(n.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </AdvocateCtx.Provider>
  );
}
