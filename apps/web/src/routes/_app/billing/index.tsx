import { CheckmarkCircle02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  type BillingInterval,
  type BillingStatus,
  type Checkout,
  INDIAN_STATES,
  PAID_PLANS,
  type PaidPlanId,
  PLANS,
} from "@vakilmitra/shared";
import { useEffect, useState } from "react";
import { Empty, ErrorBox, Field, Loading, PageHeader, Section } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { fmtDate, fmtNumber, rupees } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { billingQuery, meQuery, planInvoicesQuery, useApiMutation } from "@/lib/queries";
import { payWithRazorpay } from "@/lib/razorpay";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/billing/")({ component: BillingPage });

const GB = 1024 ** 3;
const stateTone = { TRIAL: "blue", ACTIVE: "green", GRACE: "amber", READ_ONLY: "red" } as const;

function BillingPage() {
  const { t } = useI18n();
  const billing = useQuery(billingQuery);
  if (billing.isPending) return <Loading />;
  if (billing.error || !billing.data) return <ErrorBox error={billing.error} onRetry={() => billing.refetch()} />;
  const b = billing.data;
  return (
    <>
      <PageHeader title={t("billing.title")} back="/settings" />
      <CurrentPlan b={b} />
      <Plans b={b} />
      <BillingDetails b={b} />
      <Invoices />
    </>
  );
}

function CurrentPlan({ b }: { b: BillingStatus }) {
  const { t, tf, locale } = useI18n();
  const qc = useQueryClient();
  const cancel = useApiMutation(() => api<{ billing: BillingStatus }>("/billing/cancel", { method: "POST" }), {
    onSuccess: (r) => qc.setQueryData(billingQuery.queryKey, r.billing),
  });
  const date = (iso: string) => fmtDate(iso, locale);
  const num = (n: number) => fmtNumber(n, locale);
  const paid = b.plan !== "TRIAL";

  const line =
    b.state === "READ_ONLY"
      ? t("billing.readOnlyNow")
      : b.state === "GRACE"
        ? tf("billing.graceBanner", { date: date(b.readOnlyAt) })
        : b.plan === "TRIAL"
          ? tf("billing.trialEnds", { date: date(b.endsAt) })
          : b.cancelAtPeriodEnd || b.interval === "YEARLY" || b.complimentary
            ? tf("billing.ends", { date: date(b.endsAt) })
            : tf("billing.renews", { date: date(b.endsAt) });

  return (
    <Card>
      <CardHeader>
        <CardDescription>{t("billing.yourPlan")}</CardDescription>
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
          {t(`billing.plan.${b.plan}` as MessageKey)}
          {b.interval && (
            <span className="text-sm font-normal text-muted-foreground">
              · {t(b.interval === "MONTHLY" ? "billing.monthly" : "billing.yearly")}
            </span>
          )}
          <Badge tone={stateTone[b.state]}>{t(`billing.state.${b.state}` as MessageKey)}</Badge>
          {b.complimentary && <Badge tone="neutral">{t("billing.complimentary")}</Badge>}
        </CardTitle>
        <CardDescription className={cn(b.state === "READ_ONLY" && "text-destructive", b.state === "GRACE" && "text-warning")}>
          {b.coveredBy ? tf("billing.coveredBy", { name: b.coveredBy.name }) : line}
        </CardDescription>
        {b.paymentFailing && <p className="rounded-lg bg-warning-soft p-2 text-sm text-warning">{t("billing.paymentFailing")}</p>}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <Meter label={t("billing.pagesMonth")} used={b.usage.pagesThisMonth} max={b.limits.pagesPerMonth} fmt={num} />
        <Meter
          label={t("billing.storage")}
          used={b.usage.storageBytes}
          max={b.limits.storageBytes}
          fmt={(n) =>
            n > 0 && n < GB / 10
              ? `${fmtNumber(Math.max(1, Math.round(n / 1024 ** 2)), locale)} MB`
              : `${fmtNumber(Math.round((n / GB) * 10) / 10, locale)} GB`
          }
        />
        <Meter label={t("billing.juniors")} used={b.usage.juniors} max={b.limits.juniors} fmt={num} />
      </CardContent>
      {paid && !b.cancelAtPeriodEnd && !b.complimentary && b.interval === "MONTHLY" && (
        <CardFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => confirm(tf("billing.cancelConfirm", { date: date(b.endsAt) })) && cancel.mutate(undefined)}
          >
            {t("billing.cancel")}
          </Button>
          <ErrorBox error={cancel.error} />
        </CardFooter>
      )}
    </Card>
  );
}

function Meter({ label, used, max, fmt }: { label: string; used: number; max: number; fmt: (n: number) => string }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : used > 0 ? 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {fmt(used)} / {fmt(max)}
        </span>
      </div>
      <Progress value={pct} className={cn(pct >= 90 && "[&>*]:bg-destructive")} />
    </div>
  );
}

function Plans({ b }: { b: BillingStatus }) {
  const { t, tf, locale } = useI18n();
  const qc = useQueryClient();
  const [interval, setInterval] = useState<BillingInterval>(b.interval ?? "YEARLY");
  const [paid, setPaid] = useState(false);
  const buy = useApiMutation(
    async (plan: PaidPlanId) => {
      const { checkout } = await api<{ checkout: Checkout }>("/billing/checkout", { body: { plan, interval } });
      const description = tf("billing.item", {
        plan: t(`billing.plan.${plan}` as MessageKey),
        interval: t(interval === "MONTHLY" ? "billing.monthly" : "billing.yearly"),
      });
      const result = await payWithRazorpay(checkout, { description, locale });
      if (!result) return null;
      return api<{ billing: BillingStatus }>("/billing/verify", { body: result });
    },
    {
      onSuccess: (r) => {
        if (!r) return;
        qc.setQueryData(billingQuery.queryKey, r.billing);
        setPaid(true);
      },
    },
  );
  const isCurrent = (p: PaidPlanId) => b.plan === p && b.interval === interval && b.state === "ACTIVE" && !b.coveredBy;

  return (
    <Section
      title={t("billing.plans")}
      action={
        <Tabs value={interval} onValueChange={(v) => setInterval(v as BillingInterval)}>
          <TabsList>
            <TabsTrigger value="MONTHLY">{t("billing.monthly")}</TabsTrigger>
            <TabsTrigger value="YEARLY">
              {t("billing.yearly")} <span className="ml-1 text-xs text-success">{t("billing.yearlySave")}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">{t("billing.everyPlan")}</p>
      {paid && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-sm text-success">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" /> {t("billing.paid")}
        </p>
      )}
      {!b.razorpayKeyId && <p className="mb-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t("billing.unavailable")}</p>}
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
                  <span className="text-sm text-muted-foreground">
                    {t(interval === "MONTHLY" ? "billing.perMonth" : "billing.perYear")}
                  </span>
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
              <CardFooter>
                <Button
                  className="w-full"
                  variant={p === "PRO" ? "default" : "outline"}
                  disabled={!b.razorpayKeyId || buy.isPending || isCurrent(p)}
                  onClick={() => buy.mutate(p)}
                >
                  {isCurrent(p) ? t("billing.currentPlan") : tf("billing.choose", { plan: t(`billing.plan.${p}` as MessageKey) })}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <ErrorBox error={buy.error} />
    </Section>
  );
}

function BillingDetails({ b }: { b: BillingStatus }) {
  const { t } = useI18n();
  const advocateName = useQuery(meQuery).data?.name;
  const qc = useQueryClient();
  const [v, setV] = useState({
    billingName: b.details.billingName ?? "",
    gstin: b.details.gstin ?? "",
    billingState: b.details.billingState ?? "MH",
  });
  useEffect(() => {
    setV({ billingName: b.details.billingName ?? "", gstin: b.details.gstin ?? "", billingState: b.details.billingState ?? "MH" });
  }, [b.details]);
  const save = useApiMutation(
    () =>
      api<{ billing: BillingStatus }>("/billing/details", {
        method: "PUT",
        body: { billingName: v.billingName, gstin: v.gstin.trim() || null, billingState: v.billingState || null },
      }),
    { onSuccess: (r) => qc.setQueryData(billingQuery.queryKey, r.billing) },
  );
  return (
    <Section title={t("billing.details")}>
      <Card className="px-(--card-spacing)">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined);
          }}
        >
          <Field id="billingName" label={t("billing.billingName")}>
            <Input
              id="billingName"
              placeholder={advocateName}
              required
              minLength={2}
              value={v.billingName}
              onChange={(e) => setV({ ...v, billingName: e.target.value })}
            />
          </Field>
          <Field id="gstin" label={t("billing.gstin")}>
            <Input id="gstin" value={v.gstin} maxLength={15} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} />
          </Field>
          <Field id="billingState" label={t("billing.state")}>
            <NativeSelect id="billingState" value={v.billingState} onChange={(e) => setV({ ...v, billingState: e.target.value })}>
              {Object.entries(INDIAN_STATES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="sm:col-span-3">
            <ErrorBox error={save.error} />
            <Button type="submit" disabled={save.isPending}>
              {save.isSuccess ? "✓" : t("common.save")}
            </Button>
          </div>
        </form>
      </Card>
    </Section>
  );
}

function Invoices() {
  const { t, locale } = useI18n();
  const invoices = useQuery(planInvoicesQuery);
  return (
    <Section title={t("billing.invoices")}>
      {invoices.isPending ? (
        <Loading rows={2} />
      ) : invoices.error ? (
        <ErrorBox error={invoices.error} onRetry={() => invoices.refetch()} />
      ) : invoices.data.length === 0 ? (
        <Empty>{t("billing.noInvoices")}</Empty>
      ) : (
        <Card className="gap-0 py-0">
          <div className="divide-y">
            {invoices.data.map((i) => (
              <Item key={i.id} asChild size="sm" className="rounded-none px-4">
                <Link to="/billing/invoices/$invoiceId" params={{ invoiceId: i.id }}>
                  <ItemContent>
                    <ItemTitle>{i.number}</ItemTitle>
                    <ItemDescription>
                      {fmtDate(i.createdAt, locale)} · {t(`billing.plan.${i.plan}` as MessageKey)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {i.status === "REFUNDED" && <Badge tone="neutral">{t("billing.refunded")}</Badge>}
                    <span className="font-medium tabular-nums">{rupees(i.totalPaise, locale)}</span>
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </div>
        </Card>
      )}
    </Section>
  );
}
