import { Scale } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Brand: a scales mark on an ink tile, with the Marathi-first serif wordmark. */
export function Brand({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          onDark ? "bg-white text-black" : "bg-primary text-primary-foreground shadow-[0_6px_14px_-8px_rgb(17_17_20/0.7)]",
        )}
      >
        <Scale className="size-[18px]" strokeWidth={2.2} />
      </span>
      {!compact && <span className="font-display text-[1.35rem] leading-none">{t("app.name")}</span>}
    </span>
  );
}
