import { randomUUID } from "node:crypto";
import type { CourtCase, CourtProvider } from "@vakilmitra/courts";
import { CourtProviderError } from "@vakilmitra/courts";
import {
  accessLogs,
  advocates,
  and,
  asc,
  caseAccess,
  cases,
  caseTracking,
  courtUpdates,
  createDb,
  eq,
  hearings,
  runMigrations,
  subscriptions,
} from "@vakilmitra/db";
import { courtDateIso, istDate } from "@vakilmitra/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDigests, checkCase, checkDueCases, digestMail } from "../src/court-check.js";

const url = process.env.DATABASE_URL!;
await runMigrations(url);
const { db, pool } = createDb(url);
afterAll(() => pool.end());

const silent = { info() {}, warn() {}, error() {} };
// 7:30 pm IST, Friday 27 November 2026.
const NOW = new Date("2026-11-27T14:00:00Z");
const DAY = 86_400_000;

/** A court-data service that answers from a table the test fills in. */
class FakeCourts implements CourtProvider {
  readonly name = "fake";
  records = new Map<string, CourtCase | Error>();
  calls: string[] = [];
  async fetchCase(cnr: string) {
    this.calls.push(cnr);
    const r = this.records.get(cnr);
    if (r instanceof Error) throw r;
    return r ?? null;
  }
}
const courts = new FakeCourts();
const deps = (now = NOW) => ({ db, provider: courts, log: silent, now: () => now });

let serial = 100000;
const newCnr = () => `MHPU01${String(serial++).padStart(6, "0")}2024`;

const record = (cnr: string, over: Partial<CourtCase> = {}): CourtCase => ({
  cnr,
  disposed: false,
  statusText: "Case pending",
  caseType: "R.C.S.",
  caseNumber: "RCS/123/2024",
  court: "Civil Court Senior Division, Pune",
  courtNo: "12-Jt. Civil Judge S.D.",
  filedOn: "2024-02-10",
  nextHearingDate: "2026-12-04",
  nextPurpose: "Evidence",
  lastHearingDate: "2026-11-20",
  decidedOn: null,
  disposalNature: null,
  petitioners: [],
  respondents: [],
  history: [],
  orders: [{ date: "2026-11-20", title: "Order", url: null }],
  ...over,
});

async function advocate(opts: { readOnly?: boolean; digest?: boolean; locale?: "mr" | "en" } = {}) {
  const id = randomUUID();
  await db.insert(advocates).values({
    id,
    name: "Adv. Kulkarni",
    email: `${id}@example.in`,
    locale: opts.locale ?? "mr",
    dailyDigest: opts.digest ?? true,
  });
  await db.insert(subscriptions).values({ advocateId: id, trialEndsAt: new Date(NOW.getTime() + (opts.readOnly ? -30 : 10) * DAY) });
  return id;
}

async function trackedCase(ownerId: string, over: Partial<typeof cases.$inferInsert> = {}) {
  const cnr = newCnr();
  const [c] = await db
    .insert(cases)
    .values({ advocateId: ownerId, title: "Patil v. Jadhav", cnrNumber: cnr, ...over })
    .returning();
  await db.insert(caseTracking).values({ caseId: c.id, cnr, enabledById: ownerId, createdAt: new Date(NOW.getTime() - 30 * DAY) });
  return { caseId: c.id, cnr };
}

const diary = (caseId: string) => db.query.hearings.findMany({ where: eq(hearings.caseId, caseId), orderBy: asc(hearings.date) });
const updates = (caseId: string) =>
  db.query.courtUpdates.findMany({ where: eq(courtUpdates.caseId, caseId), orderBy: asc(courtUpdates.createdAt) });
const tracking = (caseId: string) => db.query.caseTracking.findFirst({ where: eq(caseTracking.caseId, caseId) });

describe("reading a tracked case", () => {
  let owner: string;
  beforeAll(async () => {
    owner = await advocate();
  });

  it("stores the first reading, puts the next date in the diary and reports no changes", async () => {
    const { caseId, cnr } = await trackedCase(owner);
    courts.records.set(cnr, record(cnr));
    expect(await checkCase(deps(), caseId)).toBe("ok");

    const t = await tracking(caseId);
    expect(t).toMatchObject({ status: "OK", provider: "fake", failures: 0, error: null });
    expect(t!.snapshot).toMatchObject({ nextHearingDate: "2026-12-04" });
    expect(await updates(caseId)).toEqual([]);
    const [h] = await diary(caseId);
    expect(istDate(h.date)).toBe("2026-12-04");
    expect(h).toMatchObject({ source: "ecourts", purpose: "Evidence", courtHall: "12-Jt. Civil Judge S.D." });
    // Blank case details are filled from the court's record.
    expect(await db.query.cases.findFirst({ where: eq(cases.id, caseId) })).toMatchObject({
      caseNumber: "RCS/123/2024",
      court: "Civil Court Senior Division, Pune",
    });
    // The lookup is in the case's activity record.
    const logs = await db.query.accessLogs.findMany({
      where: and(eq(accessLogs.caseId, caseId), eq(accessLogs.action, "case.court_check")),
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actor: "system", advocateId: owner, details: { provider: "fake", result: "ok", changes: 0 } });
  });

  it("never overwrites what the advocate wrote", async () => {
    const { caseId, cnr } = await trackedCase(owner, { caseNumber: "R.C.S. 123/24", court: "Pune court" });
    courts.records.set(cnr, record(cnr));
    await checkCase(deps(), caseId);
    expect(await db.query.cases.findFirst({ where: eq(cases.id, caseId) })).toMatchObject({
      caseNumber: "R.C.S. 123/24",
      court: "Pune court",
    });
    expect((await diary(caseId))[0].court).toBe("Pune court");
  });

  it("moves an adjourned future date, keeping the advocate's notes, and reports it", async () => {
    const { caseId, cnr } = await trackedCase(owner);
    courts.records.set(cnr, record(cnr));
    await checkCase(deps(), caseId);
    const [first] = await diary(caseId);
    await db.update(hearings).set({ prepNotes: "Bring the 7/12 originals" }).where(eq(hearings.id, first.id));

    courts.records.set(cnr, record(cnr, { nextHearingDate: "2026-12-18", nextPurpose: "Arguments" }));
    await checkCase(deps(new Date(NOW.getTime() + DAY)), caseId);
    const after = await diary(caseId);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: first.id, prepNotes: "Bring the 7/12 originals", purpose: "Arguments" });
    expect(istDate(after[0].date)).toBe("2026-12-18");
    expect((await updates(caseId)).map((u) => u.detail)).toEqual([
      { kind: "NEXT_DATE", from: "2026-12-04", to: "2026-12-18", purpose: "Arguments" },
    ]);
  });

  it("adds a new date after a hearing, leaving the past one for its outcome", async () => {
    const { caseId, cnr } = await trackedCase(owner);
    courts.records.set(cnr, record(cnr, { nextHearingDate: "2026-11-30" }));
    await checkCase(deps(), caseId);
    courts.records.set(cnr, record(cnr, { nextHearingDate: "2027-01-08" }));
    // Checked after the 30 November hearing.
    await checkCase(deps(new Date("2026-12-01T14:00:00Z")), caseId);
    expect((await diary(caseId)).map((h) => istDate(h.date))).toEqual(["2026-11-30", "2027-01-08"]);
  });

  it("does not add a second hearing on a day the advocate already entered; fills in the purpose", async () => {
    const { caseId, cnr } = await trackedCase(owner);
    await db.insert(hearings).values({ caseId, date: new Date(courtDateIso("2026-12-04")), time: "11:00" });
    courts.records.set(cnr, record(cnr));
    await checkCase(deps(), caseId);
    const list = await diary(caseId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ source: "manual", time: "11:00", purpose: "Evidence" });
  });

  it("reports new orders, and disposal, which also marks the case disposed", async () => {
    const { caseId, cnr } = await trackedCase(owner);
    courts.records.set(cnr, record(cnr));
    await checkCase(deps(), caseId);
    courts.records.set(
      cnr,
      record(cnr, {
        disposed: true,
        statusText: "Disposed",
        decidedOn: "2026-12-04",
        disposalNature: "Decreed",
        nextHearingDate: null,
        orders: [{ date: "2026-12-04", title: "Judgment", url: "https://example.in/j.pdf" }, ...record(cnr).orders],
      }),
    );
    await checkCase(deps(new Date("2026-12-04T14:00:00Z")), caseId);
    expect((await updates(caseId)).map((u) => u.kind).sort()).toEqual(["DISPOSED", "NEW_ORDER"]);
    expect((await db.query.cases.findFirst({ where: eq(cases.id, caseId) }))!.status).toBe("DISPOSED");
  });

  it("records 'not found' for a CNR the courts do not know yet", async () => {
    const { caseId } = await trackedCase(owner);
    expect(await checkCase(deps(), caseId)).toBe("not_found");
    expect(await tracking(caseId)).toMatchObject({ status: "NOT_FOUND", snapshot: null });
  });

  it("keeps the last good reading when the service fails, with a plain message", async () => {
    const { caseId, cnr } = await trackedCase(owner);
    courts.records.set(cnr, record(cnr));
    await checkCase(deps(), caseId);
    courts.records.set(cnr, new CourtProviderError("ecourtsindia: busy (503)", true, 503));
    expect(await checkCase(deps(new Date(NOW.getTime() + DAY)), caseId)).toBe("error");
    const t = await tracking(caseId);
    expect(t).toMatchObject({ status: "OK", failures: 1 });
    expect(t!.snapshot).toMatchObject({ nextHearingDate: "2026-12-04" });
    expect(t!.error).toMatch(/try again this evening/);
    expect(t!.error).not.toMatch(/ecourtsindia|503/);
    expect(await diary(caseId)).toHaveLength(1);
  });

  it("does nothing for a case no longer tracked", async () => {
    expect(await checkCase(deps(), randomUUID())).toBe("gone");
  });
});

describe("the evening run", () => {
  it("reads only due cases of accounts still in use", async () => {
    const live = await advocate();
    const expired = await advocate({ readOnly: true });
    const due = await trackedCase(live);
    const fresh = await trackedCase(live);
    const closed = await trackedCase(live, { status: "CLOSED" });
    const lapsed = await trackedCase(expired);
    for (const c of [due, fresh, closed, lapsed]) courts.records.set(c.cnr, record(c.cnr, { nextHearingDate: "2026-12-20" }));
    // Read two hours ago by hand: not again tonight.
    await db
      .update(caseTracking)
      .set({ status: "OK", lastCheckedAt: new Date(NOW.getTime() - 2 * 3_600_000), snapshot: record(fresh.cnr) as never })
      .where(eq(caseTracking.caseId, fresh.caseId));

    courts.calls = [];
    await checkDueCases(deps());
    expect(courts.calls).toContain(due.cnr);
    for (const c of [fresh, closed, lapsed]) expect(courts.calls).not.toContain(c.cnr);
  });
});

describe("the evening email", () => {
  it("tells owner and juniors about tomorrow's hearings and today's court changes, in their language", async () => {
    const owner = await advocate();
    const junior = await advocate({ locale: "en" });
    const quiet = await advocate({ digest: false });
    const { caseId } = await trackedCase(owner, { caseNumber: "RCS/77/2025", court: "Pune court" });
    await db.insert(caseAccess).values([
      { caseId, advocateId: junior, role: "VIEWER" },
      { caseId, advocateId: quiet, role: "VIEWER" },
    ]);
    await db.insert(hearings).values({
      caseId,
      date: new Date(courtDateIso("2026-11-28")),
      time: "11:00",
      courtHall: "12",
      purpose: "Evidence",
      court: "Pune court",
    });
    await db.insert(courtUpdates).values({
      caseId,
      kind: "NEW_ORDER",
      detail: { kind: "NEW_ORDER", date: "2026-11-27", title: "Order", url: "https://example.in/o.pdf" },
      createdAt: new Date(NOW.getTime() - 3_600_000),
    });

    const digests = (await buildDigests(db, NOW)).filter((d) => [owner, junior, quiet].includes(d.advocate.id));
    expect(digests.map((d) => d.advocate.id).sort()).toEqual([owner, junior].sort());

    const mr = digestMail(digests.find((d) => d.advocate.id === owner)!, "https://vakilmitra.example/", NOW);
    expect(mr.subject).toBe("वकीलमित्र: उद्या १ सुनावणी, न्यायालयात १ बदल");
    expect(mr.text).toContain("Patil v. Jadhav · RCS/77/2025 (११:००, कोर्ट १२) — Evidence");
    expect(mr.text).toContain("नवीन आदेश");
    expect(mr.text).toContain("https://example.in/o.pdf");
    expect(mr.text).toContain("https://vakilmitra.example/today");

    const en = digestMail(digests.find((d) => d.advocate.id === junior)!, "https://vakilmitra.example", NOW);
    expect(en.subject).toBe("VakilMitra: 1 hearing tomorrow, 1 court change");
    expect(en.text).toContain("Tomorrow's board (Sat, 28 Nov)");
    expect(en.text).toContain("check the cause list");
  });

  it("sends nothing to an advocate with nothing to hear", async () => {
    const idle = await advocate();
    expect((await buildDigests(db, NOW)).some((d) => d.advocate.id === idle)).toBe(false);
  });
});
