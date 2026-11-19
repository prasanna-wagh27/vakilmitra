import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AccessState } from "@vakilmitra/shared";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={`s${i}`} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="my-3">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>
        <p>{error instanceof Error ? error.message : "Something went wrong"}</p>
        {onRetry && (
          <button type="button" className="mt-1 underline underline-offset-4" onClick={onRetry}>
            Retry
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** One headline number. */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "bad" }) {
  return (
    <Card size="sm" className="gap-1">
      <CardHeader className="gap-1">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle
          className={cn("text-2xl font-semibold tabular-nums", tone === "warn" && "text-warning", tone === "bad" && "text-destructive")}
        >
          {value}
        </CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
}

export const STATE_LABEL: Record<AccessState, string> = { TRIAL: "Trial", ACTIVE: "Active", GRACE: "Grace", READ_ONLY: "Read-only" };
const STATE_TONE = { TRIAL: "blue", ACTIVE: "green", GRACE: "amber", READ_ONLY: "red" } as const;
export const PLAN_LABEL = { TRIAL: "Trial", SOLO: "Solo", PRO: "Pro", CHAMBER: "Chamber" } as const;

export function StateBadge({ state }: { state: AccessState }) {
  return <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>;
}

/** Plain table styling shared by the list pages. */
export const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
export const td = "px-3 py-2.5 align-top whitespace-nowrap";
