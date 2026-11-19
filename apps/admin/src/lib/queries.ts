import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AccessState, BillingInterval, BillingStatus, PlanId } from "@vakilmitra/shared";
import { api } from "./api";

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "SUPPORT";
}

export interface Dashboard {
  accounts: {
    total: number;
    byState: Record<AccessState, number>;
    paidByPlan: Record<"SOLO" | "PRO" | "CHAMBER", number>;
    complimentary: number;
    paymentFailing: number;
  };
  mrrPaise: number;
  revenue30d: { totalPaise: number; netPaise: number; payments: number };
  conversion: { trialsEnded: number; paid: number };
  signups30d: { day: string; n: number }[];
  pages30d: { route: string; n: number }[];
  storageBytes: number;
  ocrFailed7d: number;
}

export interface AccountRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  plan: PlanId;
  interval: BillingInterval | null;
  state: AccessState;
  endsAt: string;
  complimentary: boolean;
  paymentFailing: boolean;
  cases: number;
  pages: number;
  storageBytes: number;
}

export interface AdminInvoice {
  id: string;
  advocateId: string | null;
  number: string;
  plan: PlanId;
  interval: BillingInterval;
  amountPaise: number;
  totalPaise: number;
  billingName: string;
  billingEmail: string;
  status: "PAID" | "REFUNDED";
  razorpayPaymentId: string;
  createdAt: string;
}

export interface AccountDetail {
  account: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    barCouncilNo: string | null;
    emailVerified: boolean;
    locale: string;
    createdAt: string;
  };
  billing: BillingStatus;
  counts: { cases: number; clients: number; documents: number };
  lastSeenAt: string | null;
  invoices: AdminInvoice[];
  history: { id: string; action: string; details: Record<string, unknown> | null; at: string; staffName: string | null }[];
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  at: string;
  staffName: string | null;
}

export interface Health {
  db: { ok: boolean; ms: number };
  ocrQueue: Record<string, number> | null;
  pagesStuck: number;
  razorpay: boolean;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => api<{ staff: Staff }>("/me").then((r) => r.staff),
  staleTime: 5 * 60_000,
  retry: false,
});

export const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
export const healthQuery = queryOptions({ queryKey: ["health"], queryFn: () => api<Health>("/health"), refetchInterval: 60_000 });

export const accountsQuery = (f: { q?: string; state?: string; plan?: string; page: number }) =>
  queryOptions({
    queryKey: ["accounts", f],
    queryFn: () => api<{ accounts: AccountRow[]; hasMore: boolean }>("/accounts", { query: { ...f, page: String(f.page) } }),
  });

export const accountQuery = (id: string) =>
  queryOptions({ queryKey: ["account", id], queryFn: () => api<AccountDetail>(`/accounts/${id}`) });

export const invoicesQuery = (page: number) =>
  queryOptions({
    queryKey: ["invoices", page],
    queryFn: () => api<{ invoices: AdminInvoice[]; hasMore: boolean }>("/invoices", { query: { page: String(page) } }),
  });

export const auditQuery = queryOptions({
  queryKey: ["audit"],
  queryFn: () => api<{ entries: AuditEntry[] }>("/audit").then((r) => r.entries),
});

/** A change, then refresh everything (staff actions are rare). */
export function useAdminMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}
