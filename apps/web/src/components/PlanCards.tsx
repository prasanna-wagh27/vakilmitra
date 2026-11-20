import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type BillingInterval, PAID_PLANS, type PaidPlanId, PLANS } from "@vakilmitra/shared";
import type { ReactNode } from "react";
import { fmtNumber, rupees } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";

const GB = 1024 ** 3;

/** The three paid plans side by side; the caller supplies each card's button. */
export function PlanCards({ interval, action }: { interval: BillingInterval; action: (p: PaidPlanId) => ReactNode }) {
  const { t, tf, locale } = useI18n();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PAID_PLANS.map((p) => {
        const { limits, price } = PLANS[p];
        const amount = price![interval];
        const feats = [
          limits.juniors === 0
            ? t("billing.featJuniors0")
            : limits.juniors === 1
              ? t("billing.featJuniors1")
              : tf("billing.featJuniors", { n: fmtNumber(limits.juniors, locale) }),
          tf("billing.featPages", { n: fmtNumber(limits.pagesPerMonth, locale) }),
          tf("billing.featStorage", { n: fmtNumber(limits.storageBytes / GB, locale) }),
        ];
        return (
          <Card key={p} className={cn(p === "PRO" && "ring-2 ring-primary")}>
            <CardHeader>
              <CardTitle>{t(`billing.plan.${p}` as MessageKey)}</CardTitle>
              <CardDescription>{t(`billing.planHint.${p}` as MessageKey)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div>
                <span className="text-3xl font-semibold tabular-nums">{rupees(amount, locale)}</span>
                <span className="text-sm text-muted-foreground">{t(interval === "MONTHLY" ? "billing.perMonth" : "billing.perYear")}</span>
                <p className="text-xs text-muted-foreground">{t("billing.plusGst")}</p>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {feats.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <HugeiconsIcon icon={Tick02Icon} className="size-4 text-success" /> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>{action(p)}</CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
