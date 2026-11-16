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
      <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <Link to="/" aria-label={t("app.name")}>
            <Brand />
          </Link>
          <nav className="ml-6 hidden rounded-full border bg-card p-1 shadow-[0_1px_2px_rgb(17_17_20/0.05)] md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active(n.to) ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  active(n.to) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle persist compact />
            <Link to="/search" aria-label={t("nav.search")} className="icon-ring size-10 hover:bg-muted">
              <Search className="size-[18px]" />
            </Link>
            <Link to="/settings" aria-label={t("nav.settings")} className="icon-ring size-10 hover:bg-muted">
              <Settings className="size-[18px]" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-5 pb-32 md:pb-12">{children}</main>

      {/* Phone: a floating dock, easy to reach one-handed. */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Main"
      >
        <ul className="panel grid grid-cols-5 gap-1 rounded-[1.75rem] p-1.5 shadow-[var(--shadow-float)]">
          {NAV.map((n) => {
            const on = active(n.to);
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.4rem] text-[11px] font-medium",
                    on ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                      on && "bg-primary text-primary-foreground",
                    )}
                  >
                    <n.icon className="size-[18px]" aria-hidden />
                  </span>
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
