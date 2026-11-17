import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, FolderOpen, IndianRupee, Search, Settings, Sun, Users } from "lucide-react";
import type { ReactNode } from "react";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Brand } from "./Brand";
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
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
          <Link to="/" aria-label={t("app.name")} className="mr-4">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active(n.to) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active(n.to) ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LanguageToggle persist compact />
            <Link
              to="/search"
              aria-label={t("nav.search")}
              className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <Search className="size-[18px]" />
            </Link>
            <Link
              to="/settings"
              aria-label={t("nav.settings")}
              className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              <Settings className="size-[18px]" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 pb-28 md:pb-12">{children}</main>

      {/* Phone: a flat tab bar on the bottom edge, easy to reach one-handed. */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const on = active(n.to);
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    on ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {on && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-primary" />}
                  <n.icon className="size-5" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                  {t(n.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
