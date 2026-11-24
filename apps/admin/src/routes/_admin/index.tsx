import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PLANS } from "@vakilmitra/shared";
import { useState } from "react";
import { ErrorBox, Loading, PageHeader, PLAN_LABEL, STATE_LABEL, Stat } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBytes, fmtNum, rupees } from "@/lib/format";
import { type Dashboard, dashboardQuery, type Health, healthQuery } from "@/lib/queries";

export const Route = createFileRoute("/_admin/")({ component: DashboardPage });

function DashboardPage() {
  const d = useQuery(dashboardQuery);
  if (d.isPending) return <Loading rows={6} />;
  if (d.error || !d.data) return <ErrorBox error={d.error} onRetry={() => d.refetch()} />;
  const x = d.data;
  const paid = x.accounts.paidByPlan.SOLO + x.accounts.paidByPlan.PRO + x.accounts.paidByPlan.CHAMBER;
  const conv = x.conversion.trialsEnded ? Math.round((x.conversion.paid / x.conversion.trialsEnded) * 100) : null;
  const trouble = x.accounts.byState.GRACE + x.accounts.paymentFailing;

  return (
    <>
      <PageHeader title="Dashboard" description="Revenue excludes GST. Complimentary plans are not counted as paid." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={rupees(x.mrrPaise)} hint={`${rupees(x.mrrPaise * 12)} a year`} />
        <Stat label="Paid accounts" value={fmtNum(paid)} hint={`${fmtNum(x.accounts.complimentary)} complimentary`} />
        <Stat label="Active trials" value={fmtNum(x.accounts.byState.TRIAL)} hint={`${fmtNum(x.accounts.total)} accounts in all`} />
        <Stat
          label="Trial to paid"
          value={conv === null ? "—" : `${conv}%`}
          hint={`${fmtNum(x.conversion.paid)} of ${fmtNum(x.conversion.trialsEnded)} finished trials`}
        />
        <Stat
          label="Collected, last 30 days"
          value={rupees(x.revenue30d.netPaise)}
          hint={`${fmtNum(x.revenue30d.payments)} payments · ${rupees(x.revenue30d.totalPaise)} including any GST`}
        />
        <Stat label="Need attention" value={fmtNum(trouble)} tone={trouble ? "warn" : undefined} hint="In grace or with a failed renewal" />
        <Stat label="Read-only" value={fmtNum(x.accounts.byState.READ_ONLY)} hint="Plan or trial ran out" />
        <Stat
          label="OCR failures, 7 days"
          value={fmtNum(x.ocrFailed7d)}
          tone={x.ocrFailed7d ? "bad" : undefined}
          hint={`${fmtBytes(x.storageBytes)} stored`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Signups data={x.signups30d} />
        <Plans x={x} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Pages data={x.pages30d} />
        <HealthCard />
      </div>
    </>
  );
}

/** New sign-ups per day for the last 30 days (IST). Single series: bars from a shared baseline. */
function Signups({ data }: { data: Dashboard["signups30d"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const counts = new Map(data.map((d) => [d.day, d.n]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() + 330 * 60_000 - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, n: counts.get(day) ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const total = days.reduce((s, d) => s + d.n, 0);
  const label = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const shown = hover === null ? null : days[hover];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-ups</CardTitle>
        <CardDescription>{shown ? `${label(shown.day)}: ${fmtNum(shown.n)}` : `${fmtNum(total)} in the last 30 days`}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <div className="flex h-40 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums">
            <span>{fmtNum(max)}</span>
            <span>0</span>
          </div>
          <div className="flex-1">
            <ul className="flex h-40 items-end gap-0.5 border-b border-border" aria-label="Sign-ups per day, last 30 days">
              {days.map((d, i) => (
                <li key={d.day} className="flex h-full flex-1">
                  {/* A full-height hit target, larger than the bar; hover or focus shows the day's number above. */}
                  <button
                    type="button"
                    aria-label={`${label(d.day)}: ${d.n}`}
                    className="flex h-full w-full items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  >
                    <span
                      className="block w-full rounded-t-[4px] bg-chart-3 transition-opacity"
                      style={{ height: d.n ? `${Math.max(3, (d.n / max) * 100)}%` : 0, opacity: hover === null || hover === i ? 1 : 0.45 }}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{label(days[0]!.day)}</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Plans({ x }: { x: Dashboard }) {
  const rows = (["SOLO", "PRO", "CHAMBER"] as const).map((p) => ({ p, n: x.accounts.paidByPlan[p] }));
  const states = (["TRIAL", "ACTIVE", "GRACE", "READ_ONLY"] as const).map((s) => ({ s, n: x.accounts.byState[s] }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>Paid accounts by plan, and every account by state.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2">
          {rows.map(({ p, n }) => (
            <div key={p} className="contents">
              <dt>{PLAN_LABEL[p]}</dt>
              <dd className="text-right tabular-nums">{fmtNum(n)}</dd>
              <dd className="text-right text-muted-foreground tabular-nums">{rupees(PLANS[p].price!.MONTHLY)}/mo</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {states.map(({ s, n }) => (
            <Link key={s} to="/accounts" search={{ state: s }}>
              <Badge variant="outline">
                {STATE_LABEL[s]} · {fmtNum(n)}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const ROUTE_LABEL: Record<string, string> = {
  local: "On our server",
  "local:confident": "On our server",
  "local:no-consent": "On our server (no cloud consent)",
  "local:cloud-queued": "Waiting for cloud",
  cloud: "Cloud OCR",
  "local:cloud-failed": "Cloud failed, kept local",
  "local:cloud-empty": "Cloud returned nothing",
  pending: "Not read yet",
};

/** Where pages were read in the last 30 days; cloud pages are the ones that cost money. */
function Pages({ data }: { data: Dashboard["pages30d"] }) {
  const merged = new Map<string, number>();
  for (const r of data) merged.set(ROUTE_LABEL[r.route] ?? r.route, (merged.get(ROUTE_LABEL[r.route] ?? r.route) ?? 0) + r.n);
  const total = [...merged.values()].reduce((a, b) => a + b, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pages scanned</CardTitle>
        <CardDescription>{fmtNum(total)} in the last 30 days, by where they were read.</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No pages yet.</p>
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            {[...merged].map(([k, n]) => (
              <div key={k} className="contents">
                <dt>{k}</dt>
                <dd className="text-right tabular-nums">{fmtNum(n)}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

const HOURS = 3600_000;
const ago = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / HOURS);
  return h < 1 ? "under an hour ago" : h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`;
};

/** Nightly at 03:00 IST: anything older than 26 hours means last night's backup did not happen. */
function BackupRows({ b }: { b: Health["backup"] }) {
  const ok = b.lastOk;
  const fresh = ok && Date.now() - new Date(ok.at).getTime() < 26 * HOURS;
  const failedSince = b.lastFailed && (!ok || b.lastFailed.at > ok.at) ? b.lastFailed : null;
  return (
    <>
      <dt>Last backup</dt>
      <dd className="text-right">
        <Badge tone={fresh ? "green" : "red"} title={failedSince?.error ?? undefined}>
          {ok ? ago(ok.at) : "None yet"}
          {failedSince ? " · last try failed" : ""}
        </Badge>
      </dd>
      <dt>Restore check</dt>
      <dd className="text-right">
        <Badge
          tone={ok?.checkOk ? "green" : ok?.checkOk === false ? "red" : "amber"}
          title={ok?.checkedAt ? new Date(ok.checkedAt).toLocaleString("en-IN") : undefined}
        >
          {ok?.checkOk ? "Restored OK" : ok?.checkOk === false ? "Failed" : "Not run"}
        </Badge>
      </dd>
    </>
  );
}

function HealthCard() {
  const h = useQuery(healthQuery);
  const q = h.data?.ocrQueue;
  return (
    <Card>
      <CardHeader>
        <CardTitle>System</CardTitle>
        <CardDescription>Checked every minute.</CardDescription>
      </CardHeader>
      <CardContent>
        {h.error ? (
          <ErrorBox error={h.error} />
        ) : !h.data ? (
          <Loading rows={2} />
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt>Database</dt>
            <dd className="text-right">
              <Badge tone="green">OK · {h.data.db.ms} ms</Badge>
            </dd>
            <dt>OCR queue</dt>
            <dd className="text-right tabular-nums">
              {q ? `${fmtNum(q.waiting ?? 0)} waiting · ${fmtNum(q.active ?? 0)} running · ${fmtNum(q.failed ?? 0)} failed` : "—"}
            </dd>
            <dt>Pages stuck over an hour</dt>
            <dd className="text-right">
              <Badge tone={h.data.pagesStuck ? "amber" : "green"}>{fmtNum(h.data.pagesStuck)}</Badge>
            </dd>
            <BackupRows b={h.data.backup} />
            <dt>Razorpay</dt>
            <dd className="text-right">
              <Badge tone={h.data.razorpay ? "green" : "amber"}>{h.data.razorpay ? "Connected" : "Not set up"}</Badge>
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
