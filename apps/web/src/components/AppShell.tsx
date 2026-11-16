import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, FolderOpen, IndianRupee, Search, Settings, Sun, Users } from "lucide-react";
import type { ReactNode } from "react";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { LanguageToggle } from "./LanguageToggle";

const NAV: { to: string; key: MessageKey; icon: typeof Sun }[] = [
  { to: "/", key: "nav.today", icon: Sun },
  { to: "/cases", key: "nav.cases", icon: FolderOpen },
  { to: "/diary", key: "nav.diary", icon: CalendarDays },
  { to: "/clients", key: "nav.clients", icon: Users },
  { to: "/fees", key: "nav.fees", icon: IndianRupee },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <Link to="/" className="text-lg font-bold text-primary">
            {t("app.name")}
          </Link>
          <nav className="ml-6 hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-lg px-3 py-2 text-sm ${active(n.to) ? "bg-primary-soft font-semibold text-primary" : "hover:bg-muted"}`}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LanguageToggle persist />
            <Link
              to="/search"
              aria-label={t("nav.search")}
              className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
            >
              <Search className="size-5" />
            </Link>
            <Link
              to="/settings"
              aria-label={t("nav.settings")}
              className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
            >
              <Settings className="size-5" />
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-28 md:pb-10">{children}</main>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to}>
              <Link
                to={n.to}
                aria-current={active(n.to) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${active(n.to) ? "font-semibold text-primary" : "text-muted-foreground"}`}
              >
                <n.icon className="size-5" aria-hidden />
                {t(n.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
