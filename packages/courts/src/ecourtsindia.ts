/**
 * eCourtsIndia (ecourtsindia.com), a paid service that reads the official eCourts portal and
 * answers by CNR. Their public docs show GET /api/partner/case/{cnr} for one case.
 *
 * The exact answer was not available to test against when this was written: the examples in
 * their docs and blog differ (a `data.results[]` list, a `data` object, camelCase or snake_case
 * names). So the reader below accepts each of those shapes and refuses anything it cannot
 * place, rather than guessing. Before turning tracking on, run one live check with the real key:
 *   pnpm --filter @vakilmitra/worker courts:check <CNR>
 * and compare what it prints with the case on services.ecourts.gov.in.
 */
import { parseCourtDate } from "./dates.js";
import { type CourtCase, type CourtHearing, type CourtOrder, type CourtProvider, CourtProviderError } from "./types.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** The first of several names that holds a value. */
function pick(o: Obj, names: string[]): unknown {
  for (const n of names) {
    const v = o[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}
const str = (o: Obj, names: string[]): string | null => {
  const v = pick(o, names);
  return typeof v === "string" ? v.trim() || null : typeof v === "number" ? String(v) : null;
};
const date = (o: Obj, names: string[]) => parseCourtDate(pick(o, names));

/** Names from a list of strings, or of objects with a name. */
function names(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v
    .map((p) => (typeof p === "string" ? p : isObj(p) ? str(p, ["name", "partyName", "party_name"]) : null))
    .filter((n): n is string => !!n?.trim())
    .map((n) => n.trim());
}

function list(o: Obj, keys: string[]): Obj[] {
  const v = pick(o, keys);
  return Array.isArray(v) ? v.filter(isObj) : [];
}

const newestFirst = <T extends { date: string }>(xs: T[]) => xs.sort((a, b) => b.date.localeCompare(a.date));

/** Finds the case record inside the answer: { data: { results: [case] } }, { data: case }, { case }, or the case itself. */
export function findCaseRecord(body: unknown): Obj | null {
  const candidates: unknown[] = [];
  if (isObj(body)) {
    const data = body.data;
    if (isObj(data)) {
      if (Array.isArray(data.results)) candidates.push(data.results[0]);
      candidates.push(data.case, data);
    } else if (Array.isArray(data)) candidates.push(data[0]);
    if (Array.isArray(body.results)) candidates.push(body.results[0]);
    candidates.push(body.case, body);
  }
  return (candidates.find((c) => isObj(c) && pick(c, ["cnr", "cnrNumber", "cnr_number", "cino"]) !== undefined) as Obj) ?? null;
}

const DISPOSED = /dispos|decided|closed|withdrawn|transferred/i;

/** Turns one eCourtsIndia case record into a CourtCase. Throws when the record has no CNR. */
export function readCase(record: Obj, cnr: string): CourtCase {
  const statusText = str(record, ["caseStatus", "case_status", "status"]);
  const decidedOn = date(record, ["decisionDate", "decision_date", "disposalDate", "disposal_date", "dateOfDecision"]);
  const history: CourtHearing[] = list(record, ["hearings", "hearingHistory", "hearing_history", "history", "caseHistory"])
    .map((h) => ({
      date: date(h, ["hearingDate", "hearing_date", "businessDate", "business_on_date", "date"]),
      purpose: str(h, ["purpose", "purposeOfHearing", "purpose_of_hearing", "stage"]),
      judge: str(h, ["judge", "judgeName", "judge_name", "courtNo"]),
    }))
    .filter((h): h is CourtHearing => h.date !== null);
  const orders: CourtOrder[] = [
    ...list(record, ["orders", "interimOrders", "interim_orders"]),
    ...list(record, ["finalOrders", "final_orders", "judgments", "judgements"]),
  ]
    .map((o) => ({
      date: date(o, ["orderDate", "order_date", "date"]),
      title: str(o, ["title", "orderTitle", "description", "orderType", "order_type"]),
      url: str(o, ["url", "pdfUrl", "pdf_url", "orderUrl", "order_url", "link"]),
    }))
    .filter((o): o is CourtOrder => o.date !== null);
  const nextHearingDate = date(record, ["nextHearingDate", "next_hearing_date", "nextDate", "next_date"]);
  return {
    cnr,
    disposed: !!decidedOn || (statusText !== null && DISPOSED.test(statusText)),
    statusText,
    caseType: str(record, ["caseType", "case_type", "typeName"]),
    caseNumber: str(record, ["caseNumber", "case_number", "registrationNumber", "registration_number", "caseNo"]),
    court: str(record, ["courtName", "court_name", "court", "establishmentName", "establishment_name", "establishment"]),
    courtNo: str(record, ["courtNumberAndJudge", "court_number_and_judge", "courtNo", "court_no", "judge", "judgeName"]),
    filedOn: date(record, ["filingDate", "filing_date", "registrationDate", "registration_date"]),
    nextHearingDate,
    nextPurpose: str(record, ["nextPurpose", "next_purpose", "purpose", "stageOfCase", "stage_of_case", "caseStage", "stage"]),
    lastHearingDate:
      date(record, ["lastHearingDate", "last_hearing_date"]) ??
      history
        .map((h) => h.date)
        .sort()
        .at(-1) ??
      null,
    decidedOn,
    disposalNature: str(record, ["natureOfDisposal", "nature_of_disposal", "disposalNature", "disposal_nature"]),
    petitioners: names(pick(record, ["petitioners", "petitioner", "petitionerNames", "petitioner_names"])),
    respondents: names(pick(record, ["respondents", "respondent", "respondentNames", "respondent_names"])),
    history: newestFirst(history),
    orders: newestFirst(orders),
  };
}

export interface EcourtsIndiaOptions {
  apiKey: string;
  baseUrl?: string;
  /** For tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class EcourtsIndiaProvider implements CourtProvider {
  readonly name = "ecourtsindia";
  private readonly base: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly opts: EcourtsIndiaOptions) {
    this.base = (opts.baseUrl ?? "https://ecourtsindia.com").replace(/\/+$/, "");
    this.doFetch = opts.fetch ?? fetch;
  }

  async fetchCase(cnr: string, { signal }: { signal?: AbortSignal } = {}): Promise<CourtCase | null> {
    const timeout = AbortSignal.timeout(this.opts.timeoutMs ?? 30_000);
    let res: Response;
    try {
      res = await this.doFetch(`${this.base}/api/partner/case/${encodeURIComponent(cnr)}`, {
        headers: { authorization: `Bearer ${this.opts.apiKey}`, accept: "application/json" },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      throw new CourtProviderError(`ecourtsindia: could not connect (${(err as Error).message})`, true);
    }
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new CourtProviderError("ecourtsindia: the API key was refused", false, res.status);
    if (res.status === 402) throw new CourtProviderError("ecourtsindia: out of credits", false, res.status);
    if (res.status === 429 || res.status >= 500) throw new CourtProviderError(`ecourtsindia: busy (${res.status})`, true, res.status);
    if (!res.ok) throw new CourtProviderError(`ecourtsindia: answered ${res.status}`, false, res.status);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new CourtProviderError("ecourtsindia: the answer was not JSON", true, res.status);
    }
    // Some services answer 200 with an empty list for an unknown CNR.
    if (isObj(body) && isObj(body.data) && Array.isArray(body.data.results) && body.data.results.length === 0) return null;
    const record = findCaseRecord(body);
    if (!record) throw new CourtProviderError("ecourtsindia: no case record found in the answer", false, res.status);
    return readCase(record, cnr);
  }
}
