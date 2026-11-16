import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Advocate,
  CaseAccessLevel,
  CaseDetail,
  CaseListItem,
  CaseStatus,
  Client,
  ClientListItem,
  ClientTotals,
  DocumentDetail,
  DocumentSummary,
  FeeAgreement,
  FeeTotals,
  Flag,
  HearingWithCase,
  OwnershipEvent,
  Property,
  SearchHit,
} from "@vakilmitra/shared";
import { API_BASE, api } from "./api";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => api<{ advocate: Advocate }>("/me").then((r) => r.advocate),
  staleTime: 5 * 60_000,
  retry: false,
});

export const casesQuery = (q: string, status: CaseStatus | "") =>
  queryOptions({
    queryKey: ["cases", { q, status }],
    queryFn: () => api<{ cases: CaseListItem[] }>("/cases", { query: { q, status } }).then((r) => r.cases),
  });

export const caseQuery = (id: string) =>
  queryOptions({ queryKey: ["case", id], queryFn: () => api<{ case: CaseDetail; access: CaseAccessLevel }>(`/cases/${id}`) });

export type PropertyDetail = Property & { events: OwnershipEvent[]; flags: Flag[] };
export const propertyQuery = (caseId: string, propertyId: string) =>
  queryOptions({
    queryKey: ["property", propertyId],
    queryFn: () => api<{ property: PropertyDetail }>(`/cases/${caseId}/properties/${propertyId}`).then((r) => r.property),
  });

export interface Board {
  date: string;
  hearings: HearingWithCase[];
  needsNextDate: { id: string; title: string; caseNumber: string | null; lastHearing: { date: string; purpose: string | null } | null }[];
}
export const boardQuery = (date: string) =>
  queryOptions({ queryKey: ["board", date], queryFn: () => api<Board>("/diary/board", { query: { date } }) });

export const diaryQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["diary", from, to],
    queryFn: () => api<{ hearings: HearingWithCase[] }>("/diary", { query: { from, to } }).then((r) => r.hearings),
  });

export const clientsQuery = (q: string) =>
  queryOptions({
    queryKey: ["clients", q],
    queryFn: () => api<{ clients: ClientListItem[] }>("/clients", { query: { q } }).then((r) => r.clients),
  });

export type ClientDetail = { client: Client & { cases: CaseListItem[]; feeAgreements: FeeAgreement[] }; totals: FeeTotals };
export const clientQuery = (id: string) => queryOptions({ queryKey: ["client", id], queryFn: () => api<ClientDetail>(`/clients/${id}`) });

export const feeSummaryQuery = queryOptions({
  queryKey: ["fees"],
  queryFn: () => api<{ clients: ClientTotals[]; totals: FeeTotals }>("/fees/summary"),
});

export interface Invoice {
  advocate: Pick<Advocate, "name" | "email" | "phone" | "barCouncilNo">;
  client: Client & { feeAgreements: FeeAgreement[] };
  totals: FeeTotals | null;
  issuedOn: string;
}
export const invoiceQuery = (clientId: string) =>
  queryOptions({ queryKey: ["invoice", clientId], queryFn: () => api<Invoice>(`/fees/invoice/${clientId}`) });

/**
 * A mutation that calls the API and then refreshes everything it may have changed.
 * Writes are rare and lists are small, so broad invalidation keeps the UI simple and correct.
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      opts.onSuccess?.(r);
    },
  });
}

export const documentsQuery = (caseId: string) =>
  queryOptions({
    queryKey: ["documents", caseId],
    queryFn: () => api<{ documents: DocumentSummary[] }>(`/cases/${caseId}/documents`).then((r) => r.documents),
    // Keep statuses fresh while pages are still being read.
    // Poll only while pages are being read; an empty document stays PENDING and must not poll forever.
    refetchInterval: (q) =>
      q.state.data?.some((d) => d.ocrStatus === "PROCESSING" || (d.ocrStatus === "PENDING" && d.pageCount > 0)) ? 3000 : false,
  });

export const documentQuery = (documentId: string) =>
  queryOptions({
    queryKey: ["document", documentId],
    queryFn: () => api<{ document: DocumentDetail }>(`/documents/${documentId}`).then((r) => r.document),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return false;
      if (d.ocrStatus === "PROCESSING" || (d.ocrStatus === "PENDING" && d.pages.length > 0)) return 2000;
      // Local text is shown already; a cloud reading may still replace it (that can take a minute or two).
      // Give up after about 5 minutes (a stuck cloud job must not keep the screen polling).
      return d.pages.some((p) => p.ocrRoute === "local:cloud-queued") && q.state.dataUpdateCount < 60 ? 5000 : false;
    },
  });

export const searchQuery = (q: string, caseId?: string) =>
  queryOptions({
    queryKey: ["search", q, caseId],
    queryFn: () => api<{ hits: SearchHit[] }>("/search", { query: { q, caseId } }).then((r) => r.hits),
    enabled: q.trim().length >= 2,
  });

export const pageImageUrl = (documentId: string, pageId: string) => `${API_BASE}/api/documents/${documentId}/pages/${pageId}/image`;
