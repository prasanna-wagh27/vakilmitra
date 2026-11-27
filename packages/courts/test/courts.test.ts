import { describe, expect, it } from "vitest";
import {
  type CourtCase,
  type CourtProviderError,
  CourtsConfigError,
  courtChanges,
  courtsConfigFromEnv,
  createCourtProvider,
  DemoCourtProvider,
  EcourtsIndiaProvider,
  findCaseRecord,
  formatCnr,
  isDue,
  normalizeCnr,
  parseCourtDate,
  type TrackingState,
} from "../src/index.js";

const CNR = "MHPU010012342024";

const base: CourtCase = {
  cnr: CNR,
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
  petitioners: ["Ramesh Patil"],
  respondents: ["Suresh Jadhav"],
  history: [{ date: "2026-11-20", purpose: "Evidence", judge: null }],
  orders: [{ date: "2026-11-20", title: "Order", url: "https://example.in/o/1.pdf" }],
};

describe("CNR", () => {
  it("accepts the 16-character number as people copy it", () => {
    expect(normalizeCnr("MHPU010012342024")).toBe(CNR);
    expect(normalizeCnr(" mhpu01-001234-2024 ")).toBe(CNR);
    expect(normalizeCnr("MHPU01 001234 2024")).toBe(CNR);
    expect(normalizeCnr("HCBM010123452023")).toBe("HCBM010123452023");
  });

  it("refuses what is not a CNR", () => {
    for (const bad of ["", null, undefined, "RCS/123/2024", "MHPU0100123420", "MHPU01001234202X", "1HPU010012342024", "MHPU010012341890"]) {
      expect(normalizeCnr(bad)).toBeNull();
    }
  });

  it("prints a CNR in three readable parts", () => {
    expect(formatCnr(CNR)).toBe("MHPU01-001234-2024");
  });
});

describe("court dates", () => {
  it.each([
    ["2026-11-27", "2026-11-27"],
    ["27-11-2026", "2026-11-27"],
    ["27/11/2026", "2026-11-27"],
    ["7.1.2026", "2026-01-07"],
    ["27th November 2026", "2026-11-27"],
    ["02nd January 2024", "2024-01-02"],
    ["27 Nov 2026", "2026-11-27"],
    ["2026-11-26T20:00:00Z", "2026-11-27"], // 1:30 am IST the next day
  ])("reads %s", (input, want) => expect(parseCourtDate(input)).toBe(want));

  it.each(["", "31-02-2026", "tomorrow", "2026-13-01", 20261127, null])("refuses %s", (input) => {
    expect(parseCourtDate(input)).toBeNull();
  });
});

describe("reading eCourtsIndia answers", () => {
  const camel = {
    cnr: CNR,
    caseType: "R.C.S.",
    caseNumber: "RCS/123/2024",
    caseStatus: "Case pending",
    courtName: "Civil Court Senior Division, Pune",
    filingDate: "2024-02-10",
    nextHearingDate: "2026-12-04",
    purpose: "Evidence",
    petitioners: [{ name: "Ramesh Patil" }],
    respondents: ["Suresh Jadhav"],
    hearings: [
      { hearingDate: "2026-10-01", purpose: "Issues" },
      { hearingDate: "2026-11-20", purpose: "Evidence" },
    ],
    orders: [{ orderDate: "2026-11-20", title: "Order", pdfUrl: "https://example.in/o/1.pdf" }],
  };

  const answer =
    (body: unknown, status = 200) =>
    async () =>
      new Response(JSON.stringify(body), { status });
  const provider = (fetch: typeof globalThis.fetch) => new EcourtsIndiaProvider({ apiKey: "k", baseUrl: "https://api.example.in/", fetch });

  it("finds the case in each shape their examples show", () => {
    for (const body of [
      { data: { results: [camel] } },
      { data: camel },
      { data: { case: camel } },
      { case: camel },
      camel,
      { results: [camel] },
    ]) {
      expect(findCaseRecord(body)?.cnr).toBe(CNR);
    }
    expect(findCaseRecord({ data: { message: "ok" } })).toBeNull();
  });

  it("turns camelCase fields into a CourtCase, newest hearings and orders first", async () => {
    const c = await provider(answer({ data: { results: [camel] } })).fetchCase(CNR);
    expect(c).toMatchObject({
      cnr: CNR,
      disposed: false,
      caseNumber: "RCS/123/2024",
      court: "Civil Court Senior Division, Pune",
      filedOn: "2024-02-10",
      nextHearingDate: "2026-12-04",
      nextPurpose: "Evidence",
      lastHearingDate: "2026-11-20",
      petitioners: ["Ramesh Patil"],
      respondents: ["Suresh Jadhav"],
    });
    expect(c!.history.map((h) => h.date)).toEqual(["2026-11-20", "2026-10-01"]);
    expect(c!.orders).toEqual([{ date: "2026-11-20", title: "Order", url: "https://example.in/o/1.pdf" }]);
  });

  it("reads snake_case answers and spelled-out dates too", async () => {
    const c = await provider(
      answer({
        results: [
          {
            cnr_number: CNR,
            case_status: "Disposed",
            next_hearing_date: "",
            first_hearing_date: "02nd January 2024",
            decision_date: "15th November 2026",
            nature_of_disposal: "Decreed",
            history: [{ business_on_date: "15-11-2026", purpose_of_hearing: "Judgment" }],
          },
        ],
      }),
    ).fetchCase(CNR);
    expect(c).toMatchObject({
      disposed: true,
      decidedOn: "2026-11-15",
      disposalNature: "Decreed",
      nextHearingDate: null,
      lastHearingDate: "2026-11-15",
    });
  });

  it("sends the key and the CNR", async () => {
    let seen: Request | undefined;
    await provider(async (input, init) => {
      seen = new Request(input as string, init);
      return new Response(JSON.stringify(camel));
    }).fetchCase(CNR);
    expect(seen!.url).toBe(`https://api.example.in/api/partner/case/${CNR}`);
    expect(seen!.headers.get("authorization")).toBe("Bearer k");
  });

  it("says 'not found' for an unknown CNR", async () => {
    expect(await provider(answer({ error: "not found" }, 404)).fetchCase(CNR)).toBeNull();
    expect(await provider(answer({ data: { results: [] } })).fetchCase(CNR)).toBeNull();
  });

  it("tells failures worth retrying from those that are not", async () => {
    const fails = async (fetch: typeof globalThis.fetch) => {
      try {
        await provider(fetch).fetchCase(CNR);
      } catch (e) {
        return e as CourtProviderError;
      }
      throw new Error("expected a failure");
    };
    expect((await fails(answer({}, 401))).retryable).toBe(false);
    expect((await fails(answer({}, 402))).message).toMatch(/credits/);
    expect((await fails(answer({}, 429))).retryable).toBe(true);
    expect((await fails(answer({}, 503))).retryable).toBe(true);
    expect((await fails(answer({ data: { message: "?" } }))).retryable).toBe(false);
    expect(
      (
        await fails(async () => {
          throw new TypeError("fetch failed");
        })
      ).retryable,
    ).toBe(true);
    expect((await fails(async () => new Response("<html>", { status: 200 }))).retryable).toBe(true);
  });
});

describe("what changed", () => {
  it("reports nothing on the first reading", () => {
    expect(courtChanges(null, base)).toEqual([]);
  });

  it("reports a new next date with its purpose", () => {
    expect(courtChanges(base, { ...base, nextHearingDate: "2026-12-18", nextPurpose: "Arguments" })).toEqual([
      { kind: "NEXT_DATE", from: "2026-12-04", to: "2026-12-18", purpose: "Arguments" },
    ]);
  });

  it("does not report a blank next date (common on the day of hearing)", () => {
    expect(courtChanges(base, { ...base, nextHearingDate: null })).toEqual([]);
  });

  it("reports each new order once, oldest first", () => {
    const orders = [
      { date: "2026-12-05", title: "Judgment", url: "https://example.in/o/3.pdf" },
      { date: "2026-12-04", title: "Order", url: "https://example.in/o/2.pdf" },
      ...base.orders,
    ];
    expect(courtChanges(base, { ...base, orders }).map((c) => c.kind === "NEW_ORDER" && c.date)).toEqual(["2026-12-04", "2026-12-05"]);
    expect(courtChanges({ ...base, orders }, { ...base, orders })).toEqual([]);
  });

  it("reports disposal, and no new date for a disposed case", () => {
    const done = { ...base, disposed: true, decidedOn: "2026-12-04", disposalNature: "Dismissed", nextHearingDate: "2026-12-30" };
    expect(courtChanges(base, done)).toEqual([{ kind: "DISPOSED", on: "2026-12-04", nature: "Dismissed" }]);
  });
});

describe("when to read a case again", () => {
  // 8 pm IST on 27 November 2026.
  const now = new Date("2026-11-27T14:30:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const state = (s: Partial<TrackingState> & { next?: string | null }): TrackingState => ({
    status: "OK",
    snapshot: s.snapshot === undefined ? { ...base, nextHearingDate: s.next === undefined ? "2026-12-20" : s.next } : s.snapshot,
    lastCheckedAt: daysAgo(1),
    lastChangedAt: daysAgo(10),
    createdAt: daysAgo(100),
    ...s,
  });

  it("reads a case never read", () => {
    expect(isDue(state({ lastCheckedAt: null, status: "PENDING", snapshot: null }), now)).toBe(true);
  });

  it("never reads a disposed case again", () => {
    expect(isDue(state({ snapshot: { ...base, disposed: true }, lastCheckedAt: daysAgo(30) }), now)).toBe(false);
  });

  it("reads at most once an evening", () => {
    expect(isDue(state({ next: null, lastCheckedAt: new Date(now.getTime() - 3_600_000) }), now)).toBe(false);
  });

  it("reads every evening once the date has passed, until a new date appears", () => {
    expect(isDue(state({ next: "2026-11-20" }), now)).toBe(true);
    expect(isDue(state({ next: "2026-11-27" }), now)).toBe(true);
    expect(isDue(state({ next: null }), now)).toBe(true);
  });

  it("falls back to weekly for a case quiet for more than 45 days", () => {
    expect(isDue(state({ next: null, lastChangedAt: daysAgo(60) }), now)).toBe(false);
    expect(isDue(state({ next: null, lastChangedAt: daysAgo(60), lastCheckedAt: daysAgo(7) }), now)).toBe(true);
  });

  it("confirms tomorrow's listing the evening before", () => {
    expect(isDue(state({ next: "2026-11-28" }), now)).toBe(true);
  });

  it("checks a case listed later once a week", () => {
    expect(isDue(state({ next: "2026-12-20", lastCheckedAt: daysAgo(3) }), now)).toBe(false);
    expect(isDue(state({ next: "2026-12-20", lastCheckedAt: daysAgo(7) }), now)).toBe(true);
  });

  it("keeps trying a new case that is not on eCourts yet, then slows down", () => {
    expect(isDue(state({ status: "NOT_FOUND", snapshot: null, createdAt: daysAgo(5) }), now)).toBe(true);
    expect(isDue(state({ status: "NOT_FOUND", snapshot: null, createdAt: daysAgo(30) }), now)).toBe(false);
    expect(isDue(state({ status: "ERROR", snapshot: null, createdAt: daysAgo(30), lastCheckedAt: daysAgo(7) }), now)).toBe(true);
  });
});

describe("settings", () => {
  it("is off when no service is set", () => {
    expect(courtsConfigFromEnv({})).toEqual({ provider: null });
    expect(createCourtProvider(courtsConfigFromEnv({ COURTS_PROVIDER: "" }))).toBeNull();
  });

  it("needs a key for a paid service", () => {
    expect(() => courtsConfigFromEnv({ COURTS_PROVIDER: "ecourtsindia" })).toThrow(CourtsConfigError);
    expect(createCourtProvider(courtsConfigFromEnv({ COURTS_PROVIDER: "ecourtsindia", COURTS_API_KEY: "k" }))?.name).toBe("ecourtsindia");
  });

  it("refuses made-up dates in production and unknown services", () => {
    expect(() => courtsConfigFromEnv({ COURTS_PROVIDER: "demo", NODE_ENV: "production" })).toThrow(/production/);
    expect(() => courtsConfigFromEnv({ COURTS_PROVIDER: "scraper" })).toThrow(CourtsConfigError);
  });
});

describe("demo records", () => {
  it("gives each CNR the same case and a future court date; case 000000 is not found, ...999 disposed", async () => {
    const p = new DemoCourtProvider(() => new Date("2026-11-27T10:00:00Z"));
    const a = await p.fetchCase(CNR);
    expect(await p.fetchCase(CNR)).toEqual(a);
    expect(a!.nextHearingDate! > "2026-11-27").toBe(true);
    expect(new Date(`${a!.nextHearingDate}T00:00:00Z`).getUTCDay()).not.toBe(0);
    expect(await p.fetchCase("MHPU010000002024")).toBeNull();
    expect((await p.fetchCase("MHPU010009992024"))!.disposed).toBe(true);
  });
});
