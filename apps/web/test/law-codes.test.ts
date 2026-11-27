import { LAW_TABLES, type LawCode, searchLawCodes, sectionBase } from "@vakilmitra/shared/law-codes";
import { describe, expect, it } from "vitest";

/** New sections found for an old number, as "103(1)". */
const newFor = (q: string, code?: LawCode) =>
  searchLawCodes(q, code)
    .filter((m) => m.by === "old")
    .map((m) => m.row.section);

describe("the correspondence tables", () => {
  it.each([
    ["bns", 358],
    ["bnss", 531],
    ["bsa", 170],
  ] as const)("cover every section of the %s (1 to %i)", (code, last) => {
    const have = new Set(LAW_TABLES[code].map((r) => Number.parseInt(sectionBase(r.section), 10)));
    const missing = Array.from({ length: last }, (_, i) => i + 1).filter((n) => !have.has(n));
    expect(missing).toEqual([]);
    expect(Math.max(...have)).toBe(last);
  });

  it("keeps clean section numbers and headings, never the tables' commentary", () => {
    for (const rows of Object.values(LAW_TABLES)) {
      for (const r of rows) {
        expect(r.section).toMatch(
          /^(\d+[A-Z]?(\(\d+\))*(\([a-z]+\))*([/,&]\(\d+\))*|(First |Second )?[Pp]roviso to section \d+|Explanation to section \d+)$/,
        );
        expect(r.title.length).toBeGreaterThan(2);
        // The longest real heading (BNSS 396, victim compensation) is 226 characters.
        expect(r.title.length).toBeLessThan(260);
        expect(r.old === null).toBe(r.oldSections.length === 0);
        for (const o of r.oldSections) expect(o).toMatch(/^\d+[A-Z]*$/);
      }
    }
  });

  it("marks provisions with no old counterpart as new", () => {
    const fake = LAW_TABLES.bns.find((r) => r.section === "197(1)(d)");
    expect(fake).toMatchObject({ old: null, oldSections: [] });
  });
});

describe("well-known sections", () => {
  it.each([
    ["302", "103(1)"],
    ["307", "109"],
    ["420", "318(4)"],
    ["406", "316(2)"],
    ["498A", "85"],
    ["304B", "80"],
    ["120B", "61(2)"],
    ["34", "3(5)"],
    ["149", "190"],
    ["354", "74"],
    ["506", "351(2)/(3)"],
  ])("IPC %s is BNS %s", (ipc, bns) => {
    expect(newFor(ipc, "bns")).toContain(bns);
  });

  it.each([
    ["154", "173"],
    ["156", "175"],
    ["161", "180"],
    ["164", "183"],
    ["125", "144"],
    ["438", "482"],
    ["439", "483"],
    ["482", "528"],
    ["313", "351"],
    ["41A", "35"],
  ])("CrPC %s is BNSS %s", (crpc, bnss) => {
    expect(newFor(crpc, "bnss")).toContain(bnss);
  });

  it.each([
    ["65B", "63"],
    ["25", "23(1)"],
    ["27", "Proviso to section 23"],
    ["32", "26"],
    ["114", "119"],
    ["45", "39(1)"],
  ])("Evidence Act %s is BSA %s", (iea, bsa) => {
    expect(newFor(iea, "bsa")).toContain(bsa);
  });

  it("spells out ranges of old sections", () => {
    // BNS 178 replaced IPC 230 to 232 (and others) in one section.
    const rows = LAW_TABLES.bns.filter((r) => r.oldSections.includes("231"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].oldSections).toEqual(expect.arrayContaining(["230", "231", "232"]));
  });
});

describe("searching", () => {
  it("finds a number in every code, old and new, unless a code is named", () => {
    const all = searchLawCodes("420");
    expect(all.some((m) => m.code === "bns" && m.by === "old" && m.row.section === "318(4)")).toBe(true);
    expect(all.some((m) => m.code === "bnss" && m.by === "new")).toBe(true); // BNSS 420 exists
    expect(searchLawCodes("IPC 420").map((m) => [m.code, m.by])).toEqual([["bns", "old"]]);
    expect(searchLawCodes("BNSS 173").every((m) => m.code === "bnss" && m.by === "new")).toBe(true);
    expect(searchLawCodes("CrPC 438").map((m) => m.row.section)).toEqual(["482"]);
    expect(searchLawCodes("u/s 302 IPC").map((m) => m.row.section)).toEqual(["103(1)"]);
  });

  it("reads Marathi digits and Marathi code names", () => {
    expect(searchLawCodes("भादंवि ४२०").map((m) => m.row.section)).toEqual(["318(4)"]);
    expect(searchLawCodes("कलम ३०२").some((m) => m.row.section === "103(1)")).toBe(true);
  });

  it("matches lettered sections regardless of case", () => {
    expect(newFor("498a", "bns")).toEqual(["85", "86"]);
  });

  it("searches headings by words, all of them", () => {
    const cheating = searchLawCodes("cheating", "bns");
    expect(cheating.length).toBeGreaterThan(1);
    expect(cheating.every((m) => m.by === "title" && /cheating/i.test(m.row.title))).toBe(true);
    expect(searchLawCodes("anticipatory bail").length + searchLawCodes("arrest bail").length).toBeGreaterThan(0);
    expect(searchLawCodes("zz")).toEqual([]);
    expect(searchLawCodes("   ")).toEqual([]);
  });

  it("keeps a chosen code even when another is named", () => {
    expect(searchLawCodes("IPC 420", "bsa").every((m) => m.code === "bsa")).toBe(true);
  });
});
