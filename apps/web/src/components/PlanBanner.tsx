import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fmtDate, fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { billingQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

/** One line above every page when the trial is ending, a payment failed, or the plan has run out. */
export function PlanBanner() {
  const { t, tf, locale } = useI18n();
  const { data: b } = useQuery(billingQuery);
  if (!b || b.coveredBy) return null;
  const daysLeft = Math.ceil((Date.parse(b.endsAt) - Date.now()) / DAY);

  let text: string | null = null;
  let tone: "info" | "warn" | "danger" = "info";
  if (b.state === "READ_ONLY") {
    text = t("billing.readOnlyNow");
    tone = "danger";
  } else if (b.state === "GRACE") {
    text = tf("billing.graceBanner", { date: fmtDate(b.readOnlyAt, locale) });
    tone = "warn";
  } else if (b.paymentFailing) {
    text = t("billing.paymentFailing");
    tone = "warn";
  } else if (b.state === "TRIAL" && daysLeft <= 5) {
    text = daysLeft <= 1 ? t("billing.trialBannerOne") : tf("billing.trialBanner", { n: fmtNumber(daysLeft, locale) });
  }
  if (!text) return null;

  return (
    <div
      role="status"
      className={cn(
        "no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-sm",
        tone === "danger" && "bg-destructive-soft text-destructive",
        tone === "warn" && "bg-warning-soft text-warning",
        tone === "info" && "bg-brand-soft text-brand",
      )}
    >
      <span>{text}</span>
      <Link to="/billing" className="font-medium underline underline-offset-4">
        {t("billing.seePlans")}
      </Link>
    </div>
  );
}
