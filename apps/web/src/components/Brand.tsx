import { JusticeScale01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useI18n } from "@/lib/i18n";

/** Brand: the scales mark on an indigo tile, with the wordmark. */
export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
        <HugeiconsIcon icon={JusticeScale01Icon} className="size-4" strokeWidth={2} />
      </span>
      {!compact && <span className="font-heading text-[15px] font-semibold tracking-[-0.02em]">{t("app.name")}</span>}
    </span>
  );
}
