import { Scale } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Brand: a scales mark with the wordmark. On the dark bar, a bare mark (the wordmark shows from sm up). */
export function Brand({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  const { t } = useI18n();
  if (onDark) {
    return (
      <span className="flex items-center gap-2 text-white">
        <Scale className="size-6" strokeWidth={1.6} aria-hidden />
        {!compact && <span className="hidden text-[17px] leading-none sm:inline">{t("app.name")}</span>}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <Scale className={cn("size-6 text-foreground")} strokeWidth={1.6} aria-hidden />
      {!compact && <span className="text-[19px] leading-none tracking-tight">{t("app.name")}</span>}
    </span>
  );
}
