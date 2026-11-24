import { Link } from "@tanstack/react-router";
import { type BillingInterval, GST_REGISTERED, TRIAL_DAYS } from "@vakilmitra/shared";
import { useState } from "react";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PlanCards } from "../PlanCards";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { PublicPage } from "./LegalPage";

export function PricingContent() {
  const { t, tf, locale } = useI18n();
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");
  return (
    <PublicPage title={t("legal.pricing")}>
      <p className="mt-3 max-w-2xl text-muted-foreground">{tf("legal.pricingIntro", { days: fmtNumber(TRIAL_DAYS, locale) })}</p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("billing.everyPlan")}</p>
      <Tabs className="my-6" value={interval} onValueChange={(v) => setInterval(v as BillingInterval)}>
        <TabsList>
          <TabsTrigger value="MONTHLY">{t("billing.monthly")}</TabsTrigger>
          <TabsTrigger value="YEARLY">
            {t("billing.yearly")} <span className="ml-1 text-xs text-success">{t("billing.yearlySave")}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <PlanCards
        interval={interval}
        action={(p) => (
          <Button className="w-full" variant={p === "PRO" ? "default" : "outline"} asChild>
            <Link to="/register">{t("legal.startTrial")}</Link>
          </Button>
        )}
      />
      <p className="mt-6 text-sm text-muted-foreground">
        {t(GST_REGISTERED ? "legal.pricingNote" : "legal.pricingNoteNoGst")}{" "}
        <Link to="/refunds" className="text-brand underline underline-offset-4">
          {t("legal.refunds")}
        </Link>
      </p>
    </PublicPage>
  );
}
