"use client";
import { useI18n } from "@/lib/i18n";
import type { Flag } from "@/lib/types";
import { Badge } from "./ui";

const tone = { HIGH: "red", MEDIUM: "amber", LOW: "neutral" } as const;

export function FlagCard({ flag, compact, onSource, children }: { flag: Flag; compact?: boolean; onSource?: (eventIds: string[]) => void; children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className={`surface rounded-2xl border p-3 ${flag.resolved ? "opacity-60" : flag.severity === "HIGH" ? "border-red-300 dark:border-red-900" : ""}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone={flag.resolved ? "green" : tone[flag.severity]}>{flag.resolved ? t("land.resolved") : `⚑ ${t(`sev.${flag.severity}`)}`}</Badge>
        <code className="muted text-xs">{flag.rule}</code>
      </div>
      <p className={compact ? "text-sm" : ""}>{flag.message}</p>
      {flag.resolution && <p className="muted mt-1 text-sm">✓ {flag.resolution}</p>}
      {onSource && flag.eventIds.length > 0 && (
        <button className="mt-1 text-sm text-brand-600 underline" onClick={() => onSource(flag.eventIds)}>
          {t("land.sources")} ({flag.eventIds.length})
        </button>
      )}
      {children}
    </div>
  );
}
