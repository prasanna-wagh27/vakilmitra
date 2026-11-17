import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Brand } from "./Brand";
import { LanguageToggle } from "./LanguageToggle";

const GROUPS: { label: MessageKey; items: { to: string; key: MessageKey }[] }[] = [
  {
    label: "nav.groupWork",
    items: [
      { to: "/", key: "nav.today" },
      { to: "/cases", key: "nav.cases" },
      { to: "/diary", key: "nav.diary" },
    ],
  },
  {
    label: "nav.groupPractice",
    items: [
      { to: "/clients", key: "nav.clients" },
      { to: "/fees", key: "nav.fees" },
    ],
  },
  {
    label: "nav.groupAccount",
    items: [
      { to: "/search", key: "nav.search" },
      { to: "/settings", key: "nav.settings" },
    ],
  },
];
const INLINE = GROUPS.slice(0, 2).flatMap((g) => g.items);

/** A floating, see-through bar (after Libra's), with a full-screen menu on phones. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const [open, setOpen] = useState(false);

  // Close the menu on navigation; stop the page scrolling under it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the path changes
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const bar = (
    <div className="mx-auto flex h-12 max-w-4xl items-center gap-2 rounded-xl bg-[rgb(22_26_27/0.72)] pr-2 pl-4 text-white backdrop-blur-xl">
      <Link to="/" aria-label={t("app.name")} className="mr-2">
        <Brand onDark />
      </Link>
      <nav className="hidden items-center md:flex" aria-label="Main">
        {INLINE.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            aria-current={active(n.to) ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-[15px]", active(n.to) ? "text-white" : "text-white/65 hover:text-white")}
          >
            {t(n.key)}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle persist compact onDark />
        <Link
          to="/cases/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-[15px] text-foreground hover:bg-white/90"
        >
          <Plus className="size-4" aria-hidden /> {t("case.new")}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t("nav.close") : t("nav.menu")}
          className="inline-flex size-9 items-center justify-center rounded-md text-white/85 hover:bg-white/10 hover:text-white"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <header className="no-print sticky top-0 z-40 px-4 pt-3">{bar}</header>

      {open && (
        <div className="no-print fixed inset-0 z-30 overflow-y-auto bg-[rgb(22_26_27/0.86)] px-4 pt-20 pb-8 text-white backdrop-blur-xl">
          <nav className="mx-auto max-w-4xl" aria-label="Main">
            {GROUPS.map((g) => (
              <div key={g.label} className="border-b border-white/12 py-4 first:pt-0">
                <p className="label-mono mb-1 !text-white/55">{t(g.label)}</p>
                <ul>
                  {g.items.map((n) => (
                    <li key={n.to}>
                      <Link
                        to={n.to}
                        aria-current={active(n.to) ? "page" : undefined}
                        className={cn(
                          "block py-1.5 text-[22px] leading-snug",
                          active(n.to) ? "text-white" : "text-white/80 hover:text-white",
                        )}
                      >
                        {t(n.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}

      <main key={pathname} className="page-enter mx-auto max-w-4xl px-6 pt-8 pb-16">
        {children}
      </main>
    </>
  );
}
