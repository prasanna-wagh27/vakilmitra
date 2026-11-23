import {
  Analytics01Icon,
  Invoice01Icon,
  JusticeScale01Icon,
  Logout01Icon,
  SecurityCheckIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import type { Staff } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: Analytics01Icon },
  { to: "/accounts", label: "Accounts", icon: UserGroupIcon },
  { to: "/invoices", label: "Payments", icon: Invoice01Icon },
  { to: "/audit", label: "Audit log", icon: SecurityCheckIcon },
] as const;

export function Shell({ staff, children }: { staff: Staff; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await api("/logout", { method: "POST" }).catch(() => undefined);
    qc.clear();
    await navigate({ to: "/login" });
  }

  return (
    <div className="min-h-svh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="flex flex-col border-b bg-sidebar md:sticky md:top-0 md:h-svh md:border-r md:border-b-0">
        <div className="flex h-16 items-center gap-2 px-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <HugeiconsIcon icon={JusticeScale01Icon} className="size-4" strokeWidth={2} />
          </span>
          <span className="font-semibold tracking-[-0.02em]">VakilMitra</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Admin</span>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <Button
              key={n.to}
              asChild
              variant="ghost"
              className={cn(
                "justify-start rounded-xl",
                active(n.to) ? "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand" : "text-foreground/70",
              )}
            >
              <Link to={n.to} aria-current={active(n.to) ? "page" : undefined}>
                <HugeiconsIcon icon={n.icon} data-icon="inline-start" />
                {n.label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="mt-auto hidden border-t p-3 md:block">
          <p className="truncate text-sm font-medium">{staff.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {staff.email} · {staff.role === "OWNER" ? "Owner" : "Support"}
          </p>
          <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={signOut}>
            <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" /> Sign out
          </Button>
        </div>
      </aside>
      <main className={cn("mx-auto w-full max-w-6xl px-4 py-8 md:px-10 md:py-10")}>
        {children}
        <Button variant="ghost" size="sm" className="mt-8 md:hidden" onClick={signOut}>
          <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" /> Sign out ({staff.name})
        </Button>
      </main>
    </div>
  );
}
