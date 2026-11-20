import {
  Calendar03Icon,
  Folder01Icon,
  Home01Icon,
  Money03Icon,
  Search01Icon,
  Settings01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Brand } from "./Brand";
import { LanguageToggle } from "./LanguageToggle";
import { PlanBanner } from "./PlanBanner";
import { Button } from "./ui/button";

const NAV: { to: string; key: MessageKey; icon: typeof Home01Icon }[] = [
  { to: "/today", key: "nav.today", icon: Home01Icon },
  { to: "/cases", key: "nav.cases", icon: Folder01Icon },
  { to: "/diary", key: "nav.diary", icon: Calendar03Icon },
  { to: "/clients", key: "nav.clients", icon: UserGroupIcon },
  { to: "/fees", key: "nav.fees", icon: Money03Icon },
];

/** Header with brand and quick actions; a tab bar on phones, inline navigation from md up. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string) => pathname.startsWith(to);

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link to="/today" aria-label={t("app.name")} className="mr-4">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.main")}>
            {NAV.map((n) => (
              <Button key={n.to} asChild variant={active(n.to) ? "secondary" : "ghost"} size="sm">
                <Link to={n.to} aria-current={active(n.to) ? "page" : undefined}>
                  {t(n.key)}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LanguageToggle persist compact />
            <Button asChild variant="ghost" size="icon">
              <Link to="/search" aria-label={t("nav.search")}>
                <HugeiconsIcon icon={Search01Icon} />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link to="/settings" aria-label={t("nav.settings")}>
                <HugeiconsIcon icon={Settings01Icon} />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main key={pathname} className="page-enter mx-auto max-w-5xl px-4 pt-6 pb-28 md:pb-12">
        {!pathname.startsWith("/billing") && <PlanBanner />}
        {children}
      </main>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
        aria-label={t("nav.main")}
      >
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const on = active(n.to);
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    on ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", on && "bg-secondary")}>
                    <HugeiconsIcon icon={n.icon} className="size-5" strokeWidth={on ? 2 : 1.6} />
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
