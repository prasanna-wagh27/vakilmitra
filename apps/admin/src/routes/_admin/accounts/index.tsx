import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorBox, Loading, PageHeader, PLAN_LABEL, StateBadge, td, th } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input-base";
import { NativeSelect } from "@/components/ui/native-select";
import { fmtBytes, fmtDate, fmtNum } from "@/lib/format";
import { accountsQuery } from "@/lib/queries";

const STATES = ["TRIAL", "ACTIVE", "GRACE", "READ_ONLY"] as const;
const PLANS = ["TRIAL", "SOLO", "PRO", "CHAMBER"] as const;

interface Search {
  q?: string;
  state?: (typeof STATES)[number];
  plan?: (typeof PLANS)[number];
  page?: number;
}

export const Route = createFileRoute("/_admin/accounts/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    state: STATES.includes(s.state as never) ? (s.state as Search["state"]) : undefined,
    plan: PLANS.includes(s.plan as never) ? (s.plan as Search["plan"]) : undefined,
    page: Number(s.page) > 1 ? Number(s.page) : undefined,
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const page = search.page ?? 1;
  const [q, setQ] = useState(search.q ?? "");
  const list = useQuery(accountsQuery({ q: search.q, state: search.state, plan: search.plan, page }));
  const set = (patch: Partial<Search>) => navigate({ search: (s) => ({ ...s, page: undefined, ...patch }) });

  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== q) void set({ q: q || undefined });
    }, 300);
    return () => clearTimeout(t);
  });

  return (
    <>
      <PageHeader title="Accounts" description="Advocates and their plans. Client files are never shown here." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
        <NativeSelect
          aria-label="State"
          value={search.state ?? ""}
          onChange={(e) => set({ state: (e.target.value || undefined) as Search["state"] })}
        >
          <option value="">Any state</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s === "READ_ONLY" ? "Read-only" : s[0] + s.slice(1).toLowerCase()}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Plan"
          value={search.plan ?? ""}
          onChange={(e) => set({ plan: (e.target.value || undefined) as Search["plan"] })}
        >
          <option value="">Any plan</option>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {PLAN_LABEL[p]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <Card className="overflow-x-auto py-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className={th}>Advocate</th>
                  <th className={th}>Plan</th>
                  <th className={th}>State</th>
                  <th className={th}>Ends</th>
                  <th className={`${th} text-right`}>Cases</th>
                  <th className={`${th} text-right`}>Pages</th>
                  <th className={`${th} text-right`}>Storage</th>
                  <th className={th}>Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.data.accounts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No accounts match.
                    </td>
                  </tr>
                )}
                {list.data.accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className={td}>
                      <Link to="/accounts/$id" params={{ id: a.id }} className="font-medium hover:underline">
                        {a.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className={td}>
                      {PLAN_LABEL[a.plan]}
                      {a.interval && <span className="text-muted-foreground"> · {a.interval === "MONTHLY" ? "monthly" : "yearly"}</span>}
                      {a.complimentary && (
                        <Badge variant="outline" className="ml-1">
                          Free
                        </Badge>
                      )}
                    </td>
                    <td className={td}>
                      <StateBadge state={a.state} />
                      {a.paymentFailing && (
                        <Badge tone="amber" className="ml-1">
                          Payment failed
                        </Badge>
                      )}
                    </td>
                    <td className={td}>{fmtDate(a.endsAt)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtNum(a.cases)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtNum(a.pages)}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtBytes(a.storageBytes)}</td>
                    <td className={td}>{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => navigate({ search: (s) => ({ ...s, page: page - 1 > 1 ? page - 1 : undefined }) })}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!list.data.hasMore}
              onClick={() => navigate({ search: (s) => ({ ...s, page: page + 1 }) })}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
