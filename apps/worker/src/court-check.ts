/**
 * Case tracking in the worker: read a tracked case from the court-data service, store the
 * reading, note what changed, keep the diary's next date in step, and every evening send each
 * advocate tomorrow's board and the day's court changes by email.
 */

import { type CourtCase, type CourtChange, type CourtProvider, CourtProviderError, courtChanges, isDue } from "@vakilmitra/courts";
import {
  accessLogs,
  advocates,
  and,
  caseAccess,
  cases,
  caseTracking,
  courtUpdates,
  type Db,
  eq,
  gte,
  hearings,
  inArray,
  lt,
  subscriptions,
} from "@vakilmitra/db";
import { addDays, courtDateIso, GRACE_DAYS, istDate, istDayRange } from "@vakilmitra/shared";
import type { Mailer } from "./mail.js";

export interface Log {
  info(o: object, msg?: string): void;
  warn(o: object, msg?: string): void;
  error(o: object, msg?: string): void;
}

export interface CourtDeps {
  db: Db;
  provider: CourtProvider;
  log: Log;
  now?: () => Date;
}

export type CheckResult = "ok" | "not_found" | "error" | "gone";

/** In plain words for the case page; the service's own message goes to the log only. */
function plainError(err: unknown): string {
  if (err instanceof CourtProviderError) {
    if (err.retryable) return "The court records service did not answer. We will try again this evening.";
    if (err.status === 401 || err.status === 402 || err.status === 403) return "Case tracking is paused on our side. We are fixing it.";
  }
  return "The court records could not be read. We will try again this evening.";
}

const HALL_MAX = 40;

/**
 * Put the court's next date in the diary. A date already there (entered by hand) is kept and
 * only filled in; a future date the court has moved is moved, keeping its notes; otherwise a
 * new hearing is added, marked as coming from eCourts.
 */
async function syncDiary(tx: Db, c: { id: string; court: string | null }, prev: CourtCase | null, next: CourtCase, today: string) {
  const day = next.nextHearingDate;
  if (next.disposed || !day || day < today) return;
  const purpose = next.nextPurpose?.slice(0, 200) ?? null;
  const hall = next.courtNo?.slice(0, HALL_MAX) ?? null;
  const onDay = async (d: string) => {
    const { start, end } = istDayRange(d);
    return tx.query.hearings.findFirst({ where: and(eq(hearings.caseId, c.id), gte(hearings.date, start), lt(hearings.date, end)) });
  };

  const existing = await onDay(day);
  if (existing) {
    if (!existing.purpose || !existing.courtHall) {
      await tx
        .update(hearings)
        .set({ purpose: existing.purpose ?? purpose, courtHall: existing.courtHall ?? hall })
        .where(eq(hearings.id, existing.id));
    }
    return;
  }
  const was = prev?.nextHearingDate;
  const moved = was && was >= today && was !== day ? await onDay(was) : null;
  if (moved && !moved.outcome) {
    await tx
      .update(hearings)
      .set({ date: new Date(courtDateIso(day)), purpose: purpose ?? moved.purpose, courtHall: moved.courtHall ?? hall })
      .where(eq(hearings.id, moved.id));
    return;
  }
  await tx.insert(hearings).values({
    caseId: c.id,
    date: new Date(courtDateIso(day)),
    purpose,
    court: c.court ?? next.court?.slice(0, 200) ?? null,
    courtHall: hall,
    source: "ecourts",
  });
}

/** Read one tracked case now. Never throws for a service failure: it is recorded on the case. */
export async function checkCase(deps: CourtDeps, caseId: string): Promise<CheckResult> {
  const { db, provider, log } = deps;
  const now = deps.now?.() ?? new Date();
  const t = await db.query.caseTracking.findFirst({
    where: eq(caseTracking.caseId, caseId),
    with: { case: { columns: { id: true, advocateId: true, court: true, status: true, caseNumber: true } } },
  });
  if (!t) return "gone";

  let reading: CourtCase | null;
  try {
    reading = await provider.fetchCase(t.cnr);
  } catch (err) {
    const failures = t.failures + 1;
    const level = err instanceof CourtProviderError && !err.retryable ? "error" : "warn";
    log[level]({ caseId, provider: provider.name, failures, err }, "court check failed");
    await db
      .update(caseTracking)
      .set({ failures, lastCheckedAt: now, error: plainError(err), status: t.snapshot ? t.status : "ERROR" })
      .where(eq(caseTracking.caseId, caseId));
    await audit(db, t.case.advocateId, caseId, provider.name, "error", 0);
    return "error";
  }

  if (!reading) {
    await db
      .update(caseTracking)
      .set({ status: "NOT_FOUND", error: null, failures: 0, lastCheckedAt: now, provider: provider.name })
      .where(eq(caseTracking.caseId, caseId));
    await audit(db, t.case.advocateId, caseId, provider.name, "not_found", 0);
    return "not_found";
  }

  const prev = t.status === "OK" ? (t.snapshot as unknown as CourtCase | null) : null;
  const changes = courtChanges(prev, reading);
  const today = istDate(now);
  await db.transaction(async (tx) => {
    await tx
      .update(caseTracking)
      .set({
        status: "OK",
        error: null,
        failures: 0,
        provider: provider.name,
        snapshot: reading as unknown as typeof caseTracking.$inferInsert.snapshot,
        lastCheckedAt: now,
        ...(changes.length || !prev ? { lastChangedAt: now } : {}),
      })
      .where(eq(caseTracking.caseId, caseId));
    if (changes.length) await tx.insert(courtUpdates).values(changes.map((ch) => ({ caseId, kind: ch.kind, detail: ch, createdAt: now })));
    await syncDiary(tx as unknown as Db, t.case, prev, reading, today);
    // Fill what the advocate left blank; never overwrite what they wrote.
    const fill: Partial<typeof cases.$inferInsert> = {};
    if (!t.case.caseNumber && reading.caseNumber) fill.caseNumber = reading.caseNumber.slice(0, 80);
    if (!t.case.court && reading.court) fill.court = reading.court.slice(0, 200);
    if (changes.some((ch) => ch.kind === "DISPOSED") && (t.case.status === "ACTIVE" || t.case.status === "ON_HOLD"))
      fill.status = "DISPOSED";
    if (Object.keys(fill).length) await tx.update(cases).set(fill).where(eq(cases.id, caseId));
  });
  await audit(db, t.case.advocateId, caseId, provider.name, "ok", changes.length);
  return "ok";
}

/** The CNR was sent to the court-data service: kept in the case's activity record. */
async function audit(db: Db, ownerId: string, caseId: string, provider: string, result: string, changes: number) {
  await db.insert(accessLogs).values({
    advocateId: ownerId,
    actor: "system",
    action: "case.court_check",
    entityType: "case",
    entityId: caseId,
    caseId,
    details: { provider, result, changes },
  });
}

/** Cases whose account can still be used (in trial, paid, or in the grace days). Read-only accounts are not tracked. */
async function liveOwners(db: Db, ownerIds: string[], now: Date): Promise<Set<string>> {
  if (!ownerIds.length) return new Set();
  const subs = await db.query.subscriptions.findMany({ where: inArray(subscriptions.advocateId, ownerIds) });
  const grace = GRACE_DAYS * 86_400_000;
  return new Set(
    subs
      .filter((s) => {
        const end = s.plan === "TRIAL" || !s.paidUntil ? s.trialEndsAt : s.paidUntil;
        return now.getTime() < end.getTime() + grace;
      })
      .map((s) => s.advocateId),
  );
}

/** Every tracked case that is due, read one after another (the services limit how fast we may ask). */
export async function checkDueCases(deps: CourtDeps): Promise<Record<CheckResult, number> & { skipped: number }> {
  const now = deps.now?.() ?? new Date();
  const rows = await deps.db
    .select({
      caseId: caseTracking.caseId,
      status: caseTracking.status,
      snapshot: caseTracking.snapshot,
      lastCheckedAt: caseTracking.lastCheckedAt,
      lastChangedAt: caseTracking.lastChangedAt,
      createdAt: caseTracking.createdAt,
      ownerId: cases.advocateId,
      caseStatus: cases.status,
    })
    .from(caseTracking)
    .innerJoin(cases, eq(cases.id, caseTracking.caseId));
  const live = await liveOwners(deps.db, [...new Set(rows.map((r) => r.ownerId))], now);
  const tally = { ok: 0, not_found: 0, error: 0, gone: 0, skipped: 0 };
  for (const r of rows) {
    const due =
      live.has(r.ownerId) &&
      r.caseStatus !== "CLOSED" &&
      isDue({ ...r, status: r.status as "OK", snapshot: r.snapshot as unknown as CourtCase | null }, now);
    if (!due) {
      tally.skipped++;
      continue;
    }
    tally[await checkCase(deps, r.caseId)]++;
  }
  return tally;
}

// ---------- The evening email ----------

type Locale = "mr" | "en";

interface DigestCase {
  id: string;
  title: string;
  caseNumber: string | null;
  court: string | null;
}

export interface Digest {
  advocate: { id: string; name: string; email: string; locale: Locale };
  tomorrow: { case: DigestCase; time: string | null; courtHall: string | null; purpose: string | null; court: string | null }[];
  changes: { case: DigestCase; change: CourtChange }[];
}

/**
 * What each advocate should hear about this evening: hearings listed tomorrow on their cases
 * (own and shared), and court changes found since the last evening run. Advocates who turned
 * the email off, or have nothing to hear, are left out.
 */
export async function buildDigests(db: Db, now: Date): Promise<Digest[]> {
  const tomorrow = istDayRange(addDays(istDate(now), 1));
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const caseCols = { id: true, title: true, caseNumber: true, court: true, advocateId: true } as const;
  const [listed, changed] = await Promise.all([
    db.query.hearings.findMany({
      where: and(gte(hearings.date, tomorrow.start), lt(hearings.date, tomorrow.end)),
      with: { case: { columns: { ...caseCols, status: true } } },
    }),
    db.query.courtUpdates.findMany({ where: gte(courtUpdates.createdAt, since), with: { case: { columns: caseCols } } }),
  ]);
  const caseIds = [...new Set([...listed.map((h) => h.caseId), ...changed.map((u) => u.caseId)])];
  if (!caseIds.length) return [];
  const grants = await db
    .select({ caseId: caseAccess.caseId, advocateId: caseAccess.advocateId })
    .from(caseAccess)
    .where(inArray(caseAccess.caseId, caseIds));
  const owner = new Map([
    ...listed.map((h) => [h.caseId, h.case.advocateId] as const),
    ...changed.map((u) => [u.caseId, u.case.advocateId] as const),
  ]);
  const readers = (caseId: string) => [owner.get(caseId)!, ...grants.filter((g) => g.caseId === caseId).map((g) => g.advocateId)];

  const people = await db.query.advocates.findMany({
    where: and(inArray(advocates.id, [...new Set(caseIds.flatMap(readers))]), eq(advocates.dailyDigest, true)),
    columns: { id: true, name: true, email: true, locale: true },
  });
  const ref = ({ id, title, caseNumber, court }: DigestCase) => ({ id, title, caseNumber, court });
  return people
    .map((a) => {
      const mine = (caseId: string) => readers(caseId).includes(a.id);
      return {
        advocate: { ...a, locale: a.locale === "en" ? ("en" as const) : ("mr" as const) },
        tomorrow: listed
          .filter((h) => mine(h.caseId) && h.case.status !== "CLOSED")
          .sort((x, y) => (x.court ?? "").localeCompare(y.court ?? "") || (x.time ?? "99").localeCompare(y.time ?? "99"))
          .map((h) => ({ case: ref(h.case), time: h.time, courtHall: h.courtHall, purpose: h.purpose, court: h.court ?? h.case.court })),
        changes: changed
          .filter((u) => mine(u.caseId))
          .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
          .map((u) => ({ case: ref(u.case), change: u.detail as unknown as CourtChange })),
      };
    })
    .filter((d) => d.tomorrow.length || d.changes.length);
}

const DIGITS_MR = "०१२३४५६७८९";
const mrDigits = (s: string) => s.replace(/\d/g, (d) => DIGITS_MR[+d]);

function fmtDay(day: string, l: Locale) {
  return new Intl.DateTimeFormat(l === "mr" ? "mr-IN" : "en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

const M = {
  mr: {
    subject: (n: number, c: number) =>
      [n ? `उद्या ${mrDigits(String(n))} ${n === 1 ? "सुनावणी" : "सुनावण्या"}` : "", c ? `न्यायालयात ${mrDigits(String(c))} बदल` : ""]
        .filter(Boolean)
        .join(", "),
    hello: (name: string) => `नमस्कार ${name},`,
    tomorrow: (day: string) => `उद्याची बोर्ड (${day}):`,
    changes: "आज eCourts वर दिसलेले बदल:",
    nextDate: (to: string, from: string | null, purpose: string | null) =>
      `पुढील तारीख ${to}${from ? ` (आधी ${from})` : ""}${purpose ? ` — ${purpose}` : ""}`,
    order: (date: string, title: string | null) => `नवीन आदेश, ${date}${title ? ` — ${title}` : ""}`,
    disposed: (on: string | null, nature: string | null) => `प्रकरण निकाली${on ? ` ${on}` : ""}${nature ? ` — ${nature}` : ""}`,
    hall: "कोर्ट",
    open: "वकीलमित्र उघडा:",
    check: "तारखा eCourts वरून घेतल्या आहेत; कोर्टात जाण्यापूर्वी कॉज लिस्ट तपासा.",
    off: "हा ईमेल नको असल्यास: सेटिंग्ज → संध्याकाळचा ईमेल.",
    sign: "— वकीलमित्र",
    brand: "वकीलमित्र",
  },
  en: {
    subject: (n: number, c: number) =>
      [n ? `${n} ${n === 1 ? "hearing" : "hearings"} tomorrow` : "", c ? `${c} court ${c === 1 ? "change" : "changes"}` : ""]
        .filter(Boolean)
        .join(", "),
    hello: (name: string) => `Hello ${name},`,
    tomorrow: (day: string) => `Tomorrow's board (${day}):`,
    changes: "Changes on eCourts today:",
    nextDate: (to: string, from: string | null, purpose: string | null) =>
      `Next date ${to}${from ? ` (was ${from})` : ""}${purpose ? ` — ${purpose}` : ""}`,
    order: (date: string, title: string | null) => `New order, ${date}${title ? ` — ${title}` : ""}`,
    disposed: (on: string | null, nature: string | null) => `Case disposed${on ? ` on ${on}` : ""}${nature ? ` — ${nature}` : ""}`,
    hall: "Court",
    open: "Open VakilMitra:",
    check: "Dates are taken from eCourts; check the cause list before you go to court.",
    off: "To stop this email: Settings → Evening email.",
    sign: "— VakilMitra",
    brand: "VakilMitra",
  },
};

/** The evening email, plain text, in the advocate's language. */
export function digestMail(d: Digest, webOrigin: string, now: Date) {
  const l = d.advocate.locale;
  const m = M[l];
  const day = (s: string) => fmtDay(s, l);
  const num = (s: string) => (l === "mr" ? mrDigits(s) : s);
  const caseLine = (c: DigestCase) => [c.title, c.caseNumber].filter(Boolean).join(" · ");
  const lines = [m.hello(d.advocate.name), ""];
  if (d.tomorrow.length) {
    lines.push(m.tomorrow(day(addDays(istDate(now), 1))));
    let court: string | null | undefined;
    for (const h of d.tomorrow) {
      if (h.court !== court) {
        court = h.court;
        if (court) lines.push("", court);
      }
      const where = [h.time && num(h.time), h.courtHall && `${m.hall} ${num(h.courtHall)}`].filter(Boolean).join(", ");
      lines.push(`  • ${caseLine(h.case)}${where ? ` (${where})` : ""}${h.purpose ? ` — ${h.purpose}` : ""}`);
    }
    lines.push("");
  }
  if (d.changes.length) {
    lines.push(m.changes);
    for (const { case: c, change } of d.changes) {
      const what =
        change.kind === "NEXT_DATE"
          ? m.nextDate(day(change.to), change.from ? day(change.from) : null, change.purpose)
          : change.kind === "NEW_ORDER"
            ? m.order(day(change.date), change.title)
            : m.disposed(change.on ? day(change.on) : null, change.nature);
      lines.push(`  • ${caseLine(c)}: ${what}`);
      if (change.kind === "NEW_ORDER" && change.url) lines.push(`    ${change.url}`);
    }
    lines.push("");
  }
  lines.push(m.open, `${webOrigin.replace(/\/+$/, "")}/today`, "", m.check, m.off, "", m.sign);
  return { to: d.advocate.email, subject: `${m.brand}: ${m.subject(d.tomorrow.length, d.changes.length)}`, text: lines.join("\n") };
}

export async function sendDigests(deps: { db: Db; mailer: Mailer; log: Log; webOrigin: string; now?: () => Date }) {
  const now = deps.now?.() ?? new Date();
  const digests = await buildDigests(deps.db, now);
  let sent = 0;
  for (const d of digests) {
    try {
      await deps.mailer.send(digestMail(d, deps.webOrigin, now));
      sent++;
    } catch (err) {
      deps.log.warn({ advocateId: d.advocate.id, err }, "evening email failed");
    }
  }
  return { sent, of: digests.length };
}
