/**
 * Title search report: assembled from the property's ownership chain, its red flags and the
 * documents examined. Pure: the same inputs give the same report, so an approved report can be
 * stored as a snapshot and compared with the chain later.
 */
import type { TitleReport } from "@vakilmitra/shared";
import { addYears, differenceInDays } from "date-fns";
import { type ChainEvent, chronological, classifyOtherRight, currentOwners } from "./rules.js";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export interface ReportInput {
  property: {
    village: string | null;
    taluka: string | null;
    district: string | null;
    surveyNo: string | null;
    gatNo: string | null;
    hissaNo: string | null;
  };
  events: (ChainEvent & { notes?: string | null; documentId?: string | null })[];
  flags: {
    id: string;
    rule: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    message: string;
    resolved: boolean;
    resolution: string | null;
    eventIds: string[];
  }[];
  documents: { id: string; type: string; year: number | null; title: string | null; pageCount: number }[];
  asOf: Date;
  years?: number;
}

export function buildTitleReport(input: ReportInput): TitleReport {
  const years = input.years ?? 30;
  const chain = chronological(input.events);
  const snaps = chain.filter((e) => e.kind === "RECORD_SNAPSHOT");
  const latest = snaps.at(-1) ?? null;
  const start = addYears(input.asOf, -years);
  const first = chain[0] ?? null;
  const owners = currentOwners(chain);

  // Encumbrances: the latest 7/12's other-rights entries, and mortgages not followed by a release.
  const encumbrances: TitleReport["encumbrances"] = (latest?.otherRights ?? [])
    .filter((r) => r.trim())
    .map((entry) => ({
      source: "other_right" as const,
      text: entry,
      category: classifyOtherRight(entry)?.category ?? null,
      eventId: latest?.id ?? null,
    }));
  for (const e of chain) {
    if ((e.subtype ?? "").toUpperCase() !== "MORTGAGE") continue;
    const released = chain.some((r) => (r.subtype ?? "").toUpperCase() === "RELEASE" && r.date >= e.date);
    if (!released) {
      const text = [e.deedRegNo ?? e.ferfarNo, e.toParties?.join(", ")].filter(Boolean).join(" · ");
      encumbrances.push({ source: "mortgage", text, category: "BANK_CHARGE", eventId: e.id });
    }
  }

  return {
    property: {
      ...input.property,
      areaSqm: latest?.areaSqm ?? null,
      landClass: latest?.landClass ?? null,
    },
    period: {
      from: first ? ymd(first.date) : null,
      to: ymd(input.asOf),
      years,
      // A year of slack, as in the chain-coverage rule: a 7/12 from early in the start year covers it.
      complete: !!first && differenceInDays(first.date, start) <= 365,
    },
    owners: owners ? { names: owners.owners, asPerEventId: owners.asPer.id, asPerDate: ymd(owners.asPer.date) } : null,
    chain: chain.map((e) => ({
      id: e.id,
      date: ymd(e.date),
      kind: e.kind,
      subtype: e.subtype ?? null,
      ferfarNo: e.ferfarNo ?? null,
      deedRegNo: e.deedRegNo ?? e.refDeedRegNo ?? null,
      from: e.fromParties ?? [],
      to: e.toParties ?? [],
      owners: e.owners ?? [],
      areaSqm: e.areaSqm ?? null,
      section155: !!e.section155,
      notes: e.notes ?? null,
      documentId: e.documentId ?? null,
    })),
    encumbrances,
    flags: {
      open: input.flags
        .filter((f) => !f.resolved)
        .map(({ id, rule, severity, message, eventIds }) => ({ id, rule, severity, message, eventIds })),
      resolved: input.flags
        .filter((f) => f.resolved)
        .map(({ id, rule, severity, message, resolution, eventIds }) => ({ id, rule, severity, message, resolution, eventIds })),
    },
    documents: input.documents.map(({ id, type, year, title, pageCount }) => ({ id, type, year, title, pageCount })),
  };
}
