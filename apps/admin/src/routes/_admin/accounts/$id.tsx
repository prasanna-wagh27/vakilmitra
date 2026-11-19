import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PAID_PLANS, type PaidPlanId } from "@vakilmitra/shared";
import { useState } from "react";
import { ErrorBox, Loading, PageHeader, PLAN_LABEL, StateBadge } from "@/components/common";
import { describe, InvoiceTable } from "@/components/Invoices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input-base";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api";
import { fmtBytes, fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import { type AccountDetail, accountQuery, meQuery, useAdminMutation } from "@/lib/queries";

export const Route = createFileRoute("/_admin/accounts/$id")({ component: AccountPage });

const ACTION_LABEL: Record<string, string> = {
  "trial.extend": "Trial extended",
  "plan.comp": "Free plan given",
  "invoice.refund": "Payment refunded",
};

function AccountPage() {
  const { id } = Route.useParams();
  const q = useQuery(accountQuery(id));
  const me = useQuery(meQuery);
  if (q.isPending) return <Loading rows={6} />;
  if (q.error || !q.data) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const { account: a, billing: b, counts } = q.data;
  const owner = me.data?.role === "OWNER";

  return (
    <>
      <Link to="/accounts" className="mb-3 inline-block text-sm text-muted-foreground hover:underline">
        ← Accounts
      </Link>
      <PageHeader
        title={a.name}
        description={[a.email, a.phone, a.barCouncilNo && `Bar Council ${a.barCouncilNo}`].filter(Boolean).join(" · ")}
        action={<StateBadge state={b.state} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Plan</CardDescription>
            <CardTitle className="text-xl">
              {PLAN_LABEL[b.plan]}
              {b.interval && (
                <span className="text-sm font-normal text-muted-foreground"> · {b.interval === "MONTHLY" ? "monthly" : "yearly"}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{b.plan === "TRIAL" ? "Trial ends" : "Paid until"}</dt>
              <dd>{fmtDate(b.endsAt)}</dd>
              <dt className="text-muted-foreground">Read-only from</dt>
              <dd>{fmtDate(b.readOnlyAt)}</dd>
              {b.coveredBy && (
                <>
                  <dt className="text-muted-foreground">Covered by</dt>
                  <dd>{b.coveredBy.name}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Flags</dt>
              <dd className="flex flex-wrap gap-1">
                {b.complimentary && <Badge variant="outline">Complimentary</Badge>}
                {b.cancelAtPeriodEnd && <Badge variant="outline">Won't renew</Badge>}
                {b.paymentFailing && <Badge tone="amber">Payment failed</Badge>}
                {!b.complimentary && !b.cancelAtPeriodEnd && !b.paymentFailing && "—"}
              </dd>
              <dt className="text-muted-foreground">GST details</dt>
              <dd>{[b.details.billingName, b.details.gstin, b.details.billingState].filter(Boolean).join(" · ") || "—"}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Usage</CardDescription>
            <CardTitle className="text-xl">{fmtNum(counts.cases)} cases</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Clients</dt>
              <dd className="text-right tabular-nums">{fmtNum(counts.clients)}</dd>
              <dt className="text-muted-foreground">Documents</dt>
              <dd className="text-right tabular-nums">{fmtNum(counts.documents)}</dd>
              <dt className="text-muted-foreground">Pages this month</dt>
              <dd className="text-right tabular-nums">
                {fmtNum(b.usage.pagesThisMonth)} / {fmtNum(b.limits.pagesPerMonth)}
              </dd>
              <dt className="text-muted-foreground">Storage</dt>
              <dd className="text-right tabular-nums">
                {fmtBytes(b.usage.storageBytes)} / {fmtBytes(b.limits.storageBytes)}
              </dd>
              <dt className="text-muted-foreground">Juniors</dt>
              <dd className="text-right tabular-nums">
                {fmtNum(b.usage.juniors)} / {fmtNum(b.limits.juniors)}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Account</CardDescription>
            <CardTitle className="text-xl">Joined {fmtDate(a.createdAt)}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Last active</dt>
              <dd>{q.data.lastSeenAt ? fmtDateTime(q.data.lastSeenAt) : "—"}</dd>
              <dt className="text-muted-foreground">Email verified</dt>
              <dd>{a.emailVerified ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Language</dt>
              <dd>{a.locale === "mr" ? "Marathi" : "English"}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {b.plan === "TRIAL" && <ExtendTrial id={a.id} />}
        {owner && <GiveFreePlan id={a.id} />}
      </div>

      <h2 className="mt-8 mb-3 font-heading text-base font-semibold">Payments</h2>
      <InvoiceTable invoices={q.data.invoices} owner={owner} />

      <h2 className="mt-8 mb-3 font-heading text-base font-semibold">Staff actions</h2>
      <History items={q.data.history} />
    </>
  );
}

function ExtendTrial({ id }: { id: string }) {
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const m = useAdminMutation(() => api(`/accounts/${id}/trial`, { body: { days, note: note || undefined } }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extend trial</CardTitle>
        <CardDescription>Adds days from today, or from the current trial end if that is later.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate(undefined, { onSuccess: () => setNote("") });
          }}
        >
          <div className="flex gap-3">
            <div className="flex w-28 flex-col gap-2">
              <Label htmlFor="days">Days</Label>
              <NativeSelect id="days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="trial-note">Reason (optional)</Label>
              <Input id="trial-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <ErrorBox error={m.error} />
          <Button type="submit" className="self-start" disabled={m.isPending}>
            {m.isSuccess ? "Extended ✓" : `Extend by ${days} days`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function GiveFreePlan({ id }: { id: string }) {
  const [plan, setPlan] = useState<PaidPlanId>("PRO");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const m = useAdminMutation(() => api(`/accounts/${id}/comp`, { body: { plan, until, note } }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Give a free plan</CardTitle>
        <CardDescription>For pilots, partners and support cases. Owner only; not counted as revenue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirm(`Give ${PLAN_LABEL[plan]} free until ${until}?`)) m.mutate(undefined);
          }}
        >
          <div className="flex gap-3">
            <div className="flex w-32 flex-col gap-2">
              <Label htmlFor="comp-plan">Plan</Label>
              <NativeSelect id="comp-plan" value={plan} onChange={(e) => setPlan(e.target.value as PaidPlanId)}>
                {PAID_PLANS.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABEL[p]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="comp-until">Until</Label>
              <Input id="comp-until" type="date" required value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="comp-note">Reason</Label>
            <Input id="comp-note" required minLength={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <ErrorBox error={m.error} />
          <Button type="submit" variant="outline" className="self-start" disabled={m.isPending}>
            {m.isSuccess ? "Given ✓" : "Give free plan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function History({ items }: { items: AccountDetail["history"] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">None.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((h) => (
        <li key={h.id} className="flex flex-wrap gap-x-2">
          <span className="text-muted-foreground">{fmtDateTime(h.at)}</span>
          <span className="font-medium">{ACTION_LABEL[h.action] ?? h.action}</span>
          <span>by {h.staffName ?? "—"}</span>
          {h.details && <span className="text-muted-foreground">{describe(h.details)}</span>}
        </li>
      ))}
    </ul>
  );
}
