import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * VakilMitra mark: a balance drawn as geometry — a beam with two equal weights on a fulcrum.
 * Equal weights: both sides heard; the fulcrum: the record everything rests on.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-7", className)} fill="currentColor">
      <rect x="2" y="10" width="20" height="2.2" rx="1.1" />
      <rect x="3" y="4.2" width="5.6" height="5" rx="1" />
      <rect x="15.4" y="4.2" width="5.6" height="5" rx="1" />
      <path d="M12 12.6 7.6 20.2h8.8z" />
    </svg>
  );
}

/** Brand: the mark with the wordmark. On the dark bar the wordmark shows from sm up. */
export function Brand({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  const { t } = useI18n();
  return (
    <span className={cn("flex items-center gap-2", onDark ? "text-white" : "text-foreground")}>
      <Mark />
      {!compact && (
        <span className={cn("text-[18px] leading-none font-medium tracking-[-0.02em]", onDark && "hidden sm:inline")}>{t("app.name")}</span>
      )}
    </span>
  );
}
