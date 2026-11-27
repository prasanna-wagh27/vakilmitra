import { AlertCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { checkDraftParts, type DraftKind } from "@vakilmitra/shared";
import { useDeferredValue, useMemo } from "react";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The parts a court filing needs (CPC Order VI to VIII), ticked off from the draft's words as the
 * advocate edits, with the [blanks] still to fill. Nothing for notices: they have no set parts.
 */
export function DraftParts({ kind, body }: { kind: DraftKind; body: string }) {
  const { t, tf, locale } = useI18n();
  // Long drafts: let typing stay quick and check a moment behind.
  const text = useDeferredValue(body);
  const check = useMemo(() => checkDraftParts(kind, text), [kind, text]);
  if (!check) return null;
  const required = check.parts.filter((p) => p.need === "required");
  const n = (v: number) => fmtNumber(v, locale);

  return (
    <section className="panel p-4" aria-labelledby="draft-parts">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="draft-parts" className="font-heading font-semibold">
          {t("draft.parts")}
        </h2>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {tf("draft.partsCount", { found: n(required.filter((p) => p.found).length), total: n(required.length) })}
          {" · "}
          <span className={cn(check.blanks > 0 && "font-medium text-warning")}>
            {check.blanks === 0
              ? t("draft.noBlanks")
              : check.blanks === 1
                ? t("draft.blanksOne")
                : tf("draft.blanks", { n: n(check.blanks) })}
          </span>
        </p>
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {check.parts.map((p) => (
          <li key={p.key} className="flex items-start gap-2">
            <HugeiconsIcon
              icon={p.found ? CheckmarkCircle02Icon : AlertCircleIcon}
              className={cn(
                "mt-0.5 size-4 shrink-0",
                p.found ? "text-success" : p.need === "required" ? "text-warning" : "text-muted-foreground",
              )}
            />
            <span>
              <span className="sr-only">{p.found ? t("draft.partFound") : t("draft.partMissing")}: </span>
              {t(`draft.part.${p.key}`)}
              {(p.rule || p.need === "usual") && (
                <span className="text-muted-foreground">
                  {" "}
                  ({[p.rule, p.need === "usual" && t("draft.partUsual")].filter(Boolean).join(", ")})
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{t("draft.partsHint")}</p>
    </section>
  );
}
