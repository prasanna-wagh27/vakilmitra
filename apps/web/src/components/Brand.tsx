import { Scale } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Brand: a scales mark on an ink tile, with the wordmark. */
export function Brand({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          onDark ? "bg-white text-black" : "bg-primary text-primary-foreground",
        )}
      >
        <Scale className="size-4" strokeWidth={2.2} />
      </span>
      {!compact && <span className="text-[17px] leading-none font-semibold tracking-tight">{t("app.name")}</span>}
    </span>
  );
}
