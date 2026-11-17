/**
 * Land-file red-flag rules.
 *
 * Design principle: "Flags come from rules, not opinions." Every check here is a
 * deterministic function over structured events. The LLM extracts and drafts; it never
 * decides what is suspicious. Each flag carries the event ids (and through them the fact
 * ids) that triggered it, so the advocate can tap through to the source scan crop.
 *
 * This module is pure: no database, no clock (pass `asOf`), no I/O.
 */

import { addMonths, addYears, differenceInDays } from "date-fns";

export type EventKind = "RECORD_SNAPSHOT" | "DEED" | "MUTATION";
export type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface ChainEvent {
  id: string;
  kind: EventKind;
  date: Date;
  subtype?: string | null;
  ferfarNo?: string | null;
  deedRegNo?: string | null;
  refDeedRegNo?: string | null;
  fromParties?: string[];
  toParties?: string[];
  owners?: string[];
  areaSqm?: number | null;
  landClass?: string | null;
  otherRights?: string[];
  section155?: boolean;
  factIds?: string[];
}

export interface RuleFlag {
  rule: RuleName;
  severity: Severity;
  message: { en: string; mr: string };
  eventIds: string[];
  factIds: string[];
  /**
   * Distinguishes flags of the same rule on the same events (e.g. two other-rights entries on
   * one 7/12), so resolving one never hides another. Empty when the events identify the flag.
   */
  key?: string;
}

export type RuleName =
  | "DEED_WITHOUT_MUTATION"
  | "MUTATION_WITHOUT_DEED"
  | "AREA_CHANGE"
  | "LAND_CLASS_CHANGE"
  | "SECTION_155_CORRECTION"
  | "OTHER_RIGHTS_ENTRY"
  | "CHAIN_START_GAP"
  | "CHAIN_BREAK";

export interface RuleOptions {
  /** Reference date for the 30-year look-back. */
  asOf: Date;
  /** Years of title the chain must cover. Default 30. */
  chainYears?: number;
  /** Months after a deed within which a matching mutation is expected. Default 24. */
  mutationWindowMonths?: number;
  /** Relative area difference treated as a change. Default 0.5% (absorbs rounding of R/Are/Ha). */
  areaTolerance?: number;
}

/** Transfer types that must be backed by a registered instrument. Heirship does not. */
const DEED_BACKED_MUTATIONS = new Set(["SALE", "GIFT", "PARTITION", "MORTGAGE", "RELEASE", "EXCHANGE"]);
/** Deed types that should be followed by a mutation entry. Wills mutate only after death, so skip. */
const MUTATING_DEEDS = new Set(["SALE", "GIFT", "PARTITION", "RELEASE", "EXCHANGE"]);

/** Keyword classes for the इतर हक्क (other rights) column. Matched on normalised text. */
const OTHER_RIGHTS_KEYWORDS: { category: string; en: string; mr: string; words: string[] }[] = [
  {
    category: "BANK_CHARGE",
    en: "bank charge / loan",
    mr: "बँक बोजा / कर्ज",
    words: ["बँक", "बैंक", "बोजा", "कर्ज", "तारण", "सोसायटी", "bank", "loan", "charge", "mortgage", "society"],
  },
  {
    category: "HEIR",
    en: "heir entry",
    mr: "वारस नोंद",
    words: ["वारस", "वारसा", "heir"],
  },
  {
    category: "ENCUMBRANCE",
    en: "encumbrance / restriction",
    mr: "बोजा / निर्बंध",
    words: ["कुळ", "पुनर्वसन", "अटी", "शर्त", "प्रतिबंध", "tenant", "kul", "restriction", "lis pendens", "दावा"],
  },
];

export function normaliseName(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,()\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesOverlap(a: string[] = [], b: string[] = []): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a.map(normaliseName));
  return b.some((n) => set.has(normaliseName(n)));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function facts(...events: ChainEvent[]): string[] {
  return [...new Set(events.flatMap((e) => e.factIds ?? []))];
}

function ref(e: ChainEvent): string {
  if (e.kind === "MUTATION") return e.ferfarNo ? `Ferfar ${e.ferfarNo}` : `mutation dated ${ymd(e.date)}`;
  if (e.kind === "DEED") return e.deedRegNo ? `deed ${e.deedRegNo}` : `deed dated ${ymd(e.date)}`;
  return `7/12 of ${e.date.getUTCFullYear()}`;
}

function refMr(e: ChainEvent): string {
  if (e.kind === "MUTATION") return e.ferfarNo ? `फेरफार क्र. ${e.ferfarNo}` : `दि. ${ymd(e.date)} ची फेरफार नोंद`;
  if (e.kind === "DEED") return e.deedRegNo ? `दस्त क्र. ${e.deedRegNo}` : `दि. ${ymd(e.date)} चा दस्त`;
  return `${e.date.getUTCFullYear()} चा ७/१२`;
}

const sub = (e: ChainEvent) => (e.subtype ?? "").toUpperCase();

/** A mutation "matches" a deed if it cites the deed's registration number, or, failing that,
 *  if it is the same transfer type, falls inside the window and names the same transferees. */
function mutationMatchesDeed(m: ChainEvent, d: ChainEvent, windowMonths: number): boolean {
  if (m.refDeedRegNo && d.deedRegNo) {
    return m.refDeedRegNo.trim().toLowerCase() === d.deedRegNo.trim().toLowerCase();
  }
  const inWindow = m.date >= d.date && m.date <= addMonths(d.date, windowMonths);
  const sameType = !sub(m) || !sub(d) || sub(m) === sub(d);
  return inWindow && sameType && namesOverlap(m.toParties, d.toParties);
}

export function checkDeedsHaveMutations(events: ChainEvent[], opts: RuleOptions): RuleFlag[] {
  const window = opts.mutationWindowMonths ?? 24;
  const deeds = events.filter((e) => e.kind === "DEED" && MUTATING_DEEDS.has(sub(e)));
  const mutations = events.filter((e) => e.kind === "MUTATION");
  const out: RuleFlag[] = [];
  for (const d of deeds) {
    if (mutations.some((m) => mutationMatchesDeed(m, d, window))) continue;
    // Do not flag deeds too recent for a mutation to be expected yet.
    if (addMonths(d.date, window) > opts.asOf) continue;
    out.push({
      rule: "DEED_WITHOUT_MUTATION",
      severity: "HIGH",
      message: {
        en: `Registered ${ref(d)} (${ymd(d.date)}) has no matching mutation entry within ${window} months.`,
        mr: `नोंदणीकृत ${refMr(d)} (${ymd(d.date)}) नंतर ${window} महिन्यांत जुळणारी फेरफार नोंद नाही.`,
      },
      eventIds: [d.id],
      factIds: facts(d),
    });
  }
  return out;
}

export function checkMutationsHaveDeeds(events: ChainEvent[], opts: RuleOptions): RuleFlag[] {
  const window = opts.mutationWindowMonths ?? 24;
  const deeds = events.filter((e) => e.kind === "DEED");
  const out: RuleFlag[] = [];
  for (const m of events) {
    if (m.kind !== "MUTATION" || !DEED_BACKED_MUTATIONS.has(sub(m))) continue;
    if (!deeds.some((d) => mutationMatchesDeed(m, d, window))) {
      out.push({
        rule: "MUTATION_WITHOUT_DEED",
        severity: "HIGH",
        message: {
          en: `${ref(m)} records a ${sub(m).toLowerCase()} but no matching registered deed is in the file.`,
          mr: `${refMr(m)} मध्ये हस्तांतरणाची नोंद आहे, पण फाईलमध्ये जुळणारा नोंदणीकृत दस्त नाही.`,
        },
        eventIds: [m.id],
        factIds: facts(m),
      });
    }
  }
  return out;
}

function snapshots(events: ChainEvent[]): ChainEvent[] {
  return events.filter((e) => e.kind === "RECORD_SNAPSHOT").sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function checkAreaChanges(events: ChainEvent[], opts: RuleOptions): RuleFlag[] {
  const tol = opts.areaTolerance ?? 0.005;
  const snaps = snapshots(events).filter((s) => s.areaSqm != null);
  const out: RuleFlag[] = [];
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1],
      b = snaps[i];
    const diff = Math.abs(b.areaSqm! - a.areaSqm!);
    if (diff / Math.max(a.areaSqm!, 1) <= tol) continue;
    // Only a partition or acquisition between the two extracts can explain an area change; then
    // still flag, but lower. A sale transfers the holding without resizing it, and a correction
    // entry in between makes the change more suspicious, not less.
    const between = events.filter((e) => e.kind === "MUTATION" && e.date > a.date && e.date <= b.date);
    const corrected = between.some((e) => e.section155 || sub(e) === "CORRECTION");
    const explained = !corrected && between.some((e) => ["PARTITION", "ACQUISITION"].includes(sub(e)));
    out.push({
      rule: "AREA_CHANGE",
      severity: explained ? "LOW" : "HIGH",
      message: {
        en: `Area changed from ${a.areaSqm} to ${b.areaSqm} sq m between ${ref(a)} and ${ref(b)}${explained ? " (a mutation in between may explain it)" : " with no mutation explaining it"}.`,
        mr: `${refMr(a)} ते ${refMr(b)} दरम्यान क्षेत्र ${a.areaSqm} वरून ${b.areaSqm} चौ.मी. झाले${explained ? " (मधील फेरफार कारण असू शकते)" : "; याचे कारण देणारी फेरफार नोंद नाही"}.`,
      },
      eventIds: [a.id, b.id],
      factIds: facts(a, b),
    });
  }
  return out;
}

const normClass = (c: string) => c.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]/g, "");

export function checkLandClassChanges(events: ChainEvent[]): RuleFlag[] {
  const snaps = snapshots(events).filter((s) => s.landClass);
  const out: RuleFlag[] = [];
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1],
      b = snaps[i];
    if (normClass(a.landClass!) === normClass(b.landClass!)) continue;
    out.push({
      rule: "LAND_CLASS_CHANGE",
      severity: "HIGH",
      message: {
        en: `Land class changed from ${a.landClass} to ${b.landClass} between ${ref(a)} and ${ref(b)}. Verify the conversion order.`,
        mr: `${refMr(a)} ते ${refMr(b)} दरम्यान भोगवटा वर्ग ${a.landClass} वरून ${b.landClass} झाला. रूपांतरण आदेश तपासा.`,
      },
      eventIds: [a.id, b.id],
      factIds: facts(a, b),
    });
  }
  return out;
}

export function checkSection155(events: ChainEvent[]): RuleFlag[] {
  return events
    .filter((e) => e.kind === "MUTATION" && (e.section155 || sub(e) === "CORRECTION"))
    .map((e) => ({
      rule: "SECTION_155_CORRECTION" as const,
      severity: "HIGH" as const,
      message: {
        en: `${ref(e)} is a correction entry under Section 155. Check the order and what it changed.`,
        mr: `${refMr(e)} ही कलम १५५ अंतर्गत दुरुस्ती नोंद आहे. आदेश आणि झालेला बदल तपासा.`,
      },
      eventIds: [e.id],
      factIds: facts(e),
    }));
}

export function classifyOtherRight(entry: string): (typeof OTHER_RIGHTS_KEYWORDS)[number] | null {
  const t = entry.normalize("NFC").toLowerCase();
  return OTHER_RIGHTS_KEYWORDS.find((k) => k.words.some((w) => t.includes(w))) ?? null;
}

export function checkOtherRights(events: ChainEvent[]): RuleFlag[] {
  // Report each distinct entry once, against the latest extract that still shows it.
  const latest = new Map<string, ChainEvent>();
  for (const s of snapshots(events)) {
    for (const entry of s.otherRights ?? []) latest.set(entry.trim(), s);
  }
  const out: RuleFlag[] = [];
  for (const [entry, s] of latest) {
    if (!entry) continue;
    const cls = classifyOtherRight(entry);
    out.push({
      rule: "OTHER_RIGHTS_ENTRY",
      severity: cls?.category === "BANK_CHARGE" || cls?.category === "ENCUMBRANCE" ? "HIGH" : "MEDIUM",
      message: {
        en: `Other-rights column on ${ref(s)} shows${cls ? ` a ${cls.en}` : " an entry"}: "${entry}".`,
        mr: `${refMr(s)} च्या इतर हक्क रकान्यात${cls ? ` ${cls.mr}` : " नोंद"}: "${entry}".`,
      },
      eventIds: [s.id],
      factIds: facts(s),
      key: entry.normalize("NFC"),
    });
  }
  return out;
}

export function checkChainCoverage(events: ChainEvent[], opts: RuleOptions): RuleFlag[] {
  const years = opts.chainYears ?? 30;
  const start = addYears(opts.asOf, -years);
  const out: RuleFlag[] = [];
  if (events.length === 0) {
    out.push({
      rule: "CHAIN_START_GAP",
      severity: "HIGH",
      message: {
        en: `No records in the file. A ${years}-year chain is required.`,
        mr: `फाईलमध्ये एकही नोंद नाही. ${years} वर्षांची साखळी आवश्यक आहे.`,
      },
      eventIds: [],
      factIds: [],
    });
    return out;
  }
  const sorted = chronological(events);
  const first = sorted[0];
  // Allow a year of slack: a 7/12 from early in the start year covers it.
  if (differenceInDays(first.date, start) > 365) {
    out.push({
      rule: "CHAIN_START_GAP",
      severity: "HIGH",
      message: {
        en: `Earliest record is ${ref(first)} (${ymd(first.date)}); the ${years}-year chain must start by ${ymd(start)}.`,
        mr: `सर्वात जुनी नोंद ${refMr(first)} (${ymd(first.date)}) आहे; ${years} वर्षांची साखळी ${ymd(start)} पासून हवी.`,
      },
      eventIds: [first.id],
      factIds: facts(first),
    });
  }

  // Ownership continuity: each transfer's transferors should be owners as of the previous record.
  let owners: string[] | null = null;
  let lastOwnerEvent: ChainEvent | null = null;
  for (const e of sorted) {
    if (e.kind === "RECORD_SNAPSHOT" && e.owners?.length) {
      owners = e.owners;
      lastOwnerEvent = e;
      continue;
    }
    if (!isOwnershipTransfer(e)) continue;
    if (owners && lastOwnerEvent && !namesOverlap(owners, e.fromParties)) {
      out.push({
        rule: "CHAIN_BREAK",
        severity: "HIGH",
        message: {
          en: `${ref(e)} transfers from ${e.fromParties.join(", ")}, who are not owners per ${ref(lastOwnerEvent)} (${owners.join(", ")}).`,
          mr: `${refMr(e)} मध्ये ${e.fromParties.join(", ")} यांच्याकडून हस्तांतरण आहे, पण ${refMr(lastOwnerEvent)} नुसार मालक ${owners.join(", ")} आहेत.`,
        },
        eventIds: [lastOwnerEvent.id, e.id],
        factIds: facts(lastOwnerEvent, e),
      });
    }
    // Apply the transfer: transferors out, transferees in (partial sales keep the remaining co-owners).
    const removed = new Set(e.fromParties.map(normaliseName));
    owners = [...(owners ?? []).filter((o) => !removed.has(normaliseName(o))), ...e.toParties];
    lastOwnerEvent = e;
  }
  return out;
}

/**
 * Events in the order the chain is read. Same date: transfers first, then the 7/12 that reflects
 * them; ties by id, so the result does not depend on the order rows come back from the database.
 */
export function chronological<T extends ChainEvent>(events: T[]): T[] {
  const rank: Record<EventKind, number> = { DEED: 0, MUTATION: 1, RECORD_SNAPSHOT: 2 };
  return [...events].sort((a, b) => a.date.getTime() - b.date.getTime() || rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id));
}

/** A mutation that moves ownership (not a mortgage), with both sides named. */
function isOwnershipTransfer(e: ChainEvent): e is ChainEvent & { fromParties: string[]; toParties: string[] } {
  const moves = e.kind === "MUTATION" && ((DEED_BACKED_MUTATIONS.has(sub(e)) && sub(e) !== "MORTGAGE") || sub(e) === "HEIRSHIP");
  return moves && !!e.fromParties?.length && !!e.toParties?.length;
}

/**
 * Owners at the end of the chain: the latest 7/12's owners, with later recorded transfers applied
 * (the same reading the chain-break rule uses). Null when no 7/12 names owners.
 */
export function currentOwners(events: ChainEvent[]): { owners: string[]; asPer: ChainEvent } | null {
  let owners: string[] | null = null;
  let asPer: ChainEvent | null = null;
  for (const e of chronological(events)) {
    if (e.kind === "RECORD_SNAPSHOT" && e.owners?.length) {
      owners = e.owners;
      asPer = e;
    } else if (owners && isOwnershipTransfer(e)) {
      const removed = new Set(e.fromParties.map(normaliseName));
      owners = [...owners.filter((o) => !removed.has(normaliseName(o))), ...e.toParties];
      asPer = e;
    }
  }
  return owners && asPer ? { owners, asPer } : null;
}

const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Run every rule over one property's chain. Output is stable-sorted by severity then date. */
export function runRules(events: ChainEvent[], opts: RuleOptions): RuleFlag[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const flags = [
    ...checkDeedsHaveMutations(events, opts),
    ...checkMutationsHaveDeeds(events, opts),
    ...checkAreaChanges(events, opts),
    ...checkLandClassChanges(events),
    ...checkSection155(events),
    ...checkOtherRights(events),
    ...checkChainCoverage(events, opts),
  ];
  const firstDate = (f: RuleFlag) => Math.min(...f.eventIds.map((id) => byId.get(id)?.date.getTime() ?? 0));
  return flags.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || firstDate(a) - firstDate(b));
}
