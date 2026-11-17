import { JusticeScale01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useI18n } from "@/lib/i18n";

/** Brand: the scales mark on a primary tile, with the wordmark. */
export function Brand({ compact = false }: { compact?: boolean; onDark?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <HugeiconsIcon icon={JusticeScale01Icon} className="size-4" strokeWidth={2} />
      </span>
      {!compact && <span className="font-heading text-[15px] font-semibold tracking-tight">{t("app.name")}</span>}
    </span>
  );
}
