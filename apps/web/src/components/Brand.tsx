import { JusticeScale01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Brand: the scales mark on an indigo tile (or a near-black one with `mono`), with the wordmark. */
export function Brand({ compact = false, mono = false }: { compact?: boolean; mono?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          mono ? "bg-primary text-primary-foreground" : "bg-brand text-brand-foreground",
        )}
      >
        <HugeiconsIcon icon={JusticeScale01Icon} className="size-4" strokeWidth={2} />
      </span>
      {!compact && <span className="font-heading text-[15px] font-semibold tracking-[-0.02em]">{t("app.name")}</span>}
    </span>
  );
}
