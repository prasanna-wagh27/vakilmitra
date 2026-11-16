export type Locale = "mr" | "en";
export interface Advocate { id: string; name: string; email: string; phone?: string | null; barCouncilNo?: string | null; locale: Locale }
export interface Client { id: string; name: string; phone?: string | null; email?: string | null; address?: string | null; whatsappOptIn: boolean; notes?: string | null; outstandingPaise?: number; _count?: { cases: number } }
export type CaseStatus = "ACTIVE" | "DISPOSED" | "ON_HOLD" | "CLOSED";
export type CaseKind = "CIVIL" | "LAND_PROPERTY" | "TITLE_SEARCH" | "CRIMINAL" | "FAMILY" | "REVENUE" | "OTHER";
export interface Hearing { id: string; caseId: string; date: string; court?: string | null; purpose?: string | null; nextStep?: string | null; outcome?: string | null }
export interface Party { id: string; name: string; role: string; isOurClient: boolean; opposingCounsel?: string | null }
export interface Property { id: string; surveyNo?: string | null; gatNo?: string | null; hissaNo?: string | null; village?: string | null; taluka?: string | null; district?: string | null; _count?: { events: number } }
export interface Flag { id: string; rule: string; severity: "HIGH" | "MEDIUM" | "LOW"; message: string; eventIds: string[]; factIds: string[]; resolved: boolean; resolution?: string | null; propertyId?: string | null }
export interface Payment { id: string; amountPaise: number; paidOn: string; mode?: string | null; reference?: string | null }
export interface Installment { id: string; dueDate: string; amountPaise: number; note?: string | null }
export interface FeeAgreement { id: string; description: string; totalPaise: number; caseId?: string | null; clientId: string; payments: Payment[]; installments: Installment[]; case?: { title: string; caseNumber?: string | null; court?: string | null } | null }
export interface CaseSummary {
  id: string; title: string; kind: CaseKind; caseNumber?: string | null; court?: string | null; status: CaseStatus;
  client?: { id: string; name: string; phone?: string | null } | null; nextHearing?: Hearing | null; shared?: boolean; _count?: { flags: number };
}
export interface CaseDetail extends CaseSummary {
  cnrNumber?: string | null; filedOn?: string | null; notes?: string | null; clientId?: string | null;
  parties: Party[]; properties: Property[]; hearings: Hearing[]; flags: Flag[]; feeAgreements: FeeAgreement[];
  drafts: { id: string; title: string; status: string; language: Locale; updatedAt: string }[];
  grants?: { id: string; role: "EDITOR" | "VIEWER"; advocate: { id: string; name: string; email: string } }[];
}
export interface OwnershipEvent {
  id: string; kind: "RECORD_SNAPSHOT" | "DEED" | "MUTATION"; date: string; subtype?: string | null; ferfarNo?: string | null; deedRegNo?: string | null;
  refDeedRegNo?: string | null; fromParties: string[]; toParties: string[]; owners: string[]; areaSqm?: number | null; landClass?: string | null;
  otherRights: string[]; section155: boolean; notes?: string | null;
}
export interface ClientTotals { clientId: string; clientName: string; totalPaise: number; paidPaise: number; outstandingPaise: number; overduePaise: number; nextDue: { date: string; amountPaise: number } | null }
