import { CheckmarkCircle02Icon, Flag02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Flag } from "@vakilmitra/shared";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const tone = { HIGH: "red", MEDIUM: "amber", LOW: "neutral" } as const;

export function FlagCard({
  flag,
  compact,
  onSource,
  children,
}: {
  flag: Flag;
  compact?: boolean;
  onSource?: (eventIds: string[]) => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn("row-card p-4", flag.resolved && "opacity-60", !flag.resolved && flag.severity === "HIGH" && "border-destructive/40")}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone={flag.resolved ? "green" : tone[flag.severity]}>
          {flag.resolved ? <HugeiconsIcon icon={CheckmarkCircle02Icon} /> : <HugeiconsIcon icon={Flag02Icon} />}
          {flag.resolved ? t("land.resolved") : t(`sev.${flag.severity}`)}
        </Badge>
        <code className="text-xs text-muted-foreground">{flag.rule}</code>
      </div>
      <p className={compact ? "text-sm" : ""}>{flag.message}</p>
      {flag.resolution && <p className="mt-1 text-sm text-muted-foreground">✓ {flag.resolution}</p>}
      {onSource && flag.eventIds.length > 0 && (
        <button type="button" className="mt-1 text-sm text-brand underline underline-offset-4" onClick={() => onSource(flag.eventIds)}>
          {t("land.sources")} ({flag.eventIds.length})
        </button>
      )}
      {children}
    </div>
  );
}
