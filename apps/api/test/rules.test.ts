import { describe, expect, it } from "vitest";
import {
  type ChainEvent,
  checkAreaChanges,
  checkChainCoverage,
  checkDeedsHaveMutations,
  checkLandClassChanges,
  checkMutationsHaveDeeds,
  checkOtherRights,
  checkSection155,
  classifyOtherRight,
  runRules,
} from "../src/land/rules.js";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const asOf = d("2026-11-01");
const opts = { asOf };

/** A clean 30-year chain: owner A sells to B (deed + mutation), B dies, heirs C and D. */
function cleanChain(): ChainEvent[] {
  return [
    {
      id: "s1995",
      kind: "RECORD_SNAPSHOT",
      date: d("1995-06-01"),
      owners: ["रामचंद्र पाटील"],
      areaSqm: 8100,
      landClass: "Class-I",
      factIds: ["f1"],
    },
    {
      id: "deed1",
      kind: "DEED",
      subtype: "SALE",
      date: d("2001-03-10"),
      deedRegNo: "1234/2001",
      fromParties: ["रामचंद्र पाटील"],
      toParties: ["सुरेश जाधव"],
      factIds: ["f2"],
    },
    {
      id: "m1",
      kind: "MUTATION",
      subtype: "SALE",
      date: d("2001-08-20"),
      ferfarNo: "456",
      refDeedRegNo: "1234/2001",
      fromParties: ["रामचंद्र पाटील"],
      toParties: ["सुरेश जाधव"],
      factIds: ["f3"],
    },
    {
      id: "s2005",
      kind: "RECORD_SNAPSHOT",
      date: d("2005-06-01"),
      owners: ["सुरेश जाधव"],
      areaSqm: 8100,
      landClass: "Class-I",
      factIds: ["f4"],
    },
    {
      id: "m2",
      kind: "MUTATION",
      subtype: "HEIRSHIP",
      date: d("2015-02-01"),
      ferfarNo: "789",
      fromParties: ["सुरेश जाधव"],
      toParties: ["अनिल जाधव", "सुनील जाधव"],
      factIds: ["f5"],
    },
    {
      id: "s2025",
      kind: "RECORD_SNAPSHOT",
      date: d("2025-06-01"),
      owners: ["अनिल जाधव", "सुनील जाधव"],
      areaSqm: 8100,
      landClass: "Class-I",
      factIds: ["f6"],
    },
  ];
}

describe("clean chain", () => {
  it("raises no flags", () => {
    expect(runRules(cleanChain(), opts)).toEqual([]);
  });
});

describe("deed ↔ mutation", () => {
  it("flags a registered sale deed with no mutation", () => {
    const ev = cleanChain().filter((e) => e.id !== "m1");
    const flags = checkDeedsHaveMutations(ev, opts);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ rule: "DEED_WITHOUT_MUTATION", severity: "HIGH", eventIds: ["deed1"], factIds: ["f2"] });
  });

  it("matches deed and mutation by transferee name when no reg. no. is cited", () => {
    const ev = cleanChain().map((e) => (e.id === "m1" ? { ...e, refDeedRegNo: null, toParties: ["  सुरेश  जाधव "] } : e));
    expect(checkDeedsHaveMutations(ev, opts)).toEqual([]);
    expect(checkMutationsHaveDeeds(ev, opts)).toEqual([]);
  });

  it("does not flag a deed still inside the mutation window", () => {
    const ev: ChainEvent[] = [{ id: "dx", kind: "DEED", subtype: "SALE", date: d("2026-01-01"), toParties: ["X"] }];
    expect(checkDeedsHaveMutations(ev, opts)).toEqual([]);
  });

  it("flags a sale mutation with no deed, but not an heirship mutation", () => {
    const ev = cleanChain().filter((e) => e.id !== "deed1");
    const flags = checkMutationsHaveDeeds(ev, opts);
    expect(flags.map((f) => f.eventIds[0])).toEqual(["m1"]);
  });

  it("flags when the cited deed number does not match", () => {
    const ev = cleanChain().map((e) => (e.id === "m1" ? { ...e, refDeedRegNo: "9999/2001" } : e));
    expect(checkMutationsHaveDeeds(ev, opts).map((f) => f.rule)).toEqual(["MUTATION_WITHOUT_DEED"]);
  });
});

describe("area and class", () => {
  it("flags an unexplained area change as HIGH", () => {
    const ev = cleanChain().map((e) => (e.id === "s2025" ? { ...e, areaSqm: 9300 } : e));
    const flags = checkAreaChanges(ev, opts);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ severity: "HIGH", eventIds: ["s2005", "s2025"], factIds: ["f4", "f6"] });
  });

  it("ignores rounding differences inside tolerance", () => {
    const ev = cleanChain().map((e) => (e.id === "s2025" ? { ...e, areaSqm: 8120 } : e));
    expect(checkAreaChanges(ev, opts)).toEqual([]);
  });

  it("lowers severity when a partition mutation sits between the extracts", () => {
    const ev = [
      ...cleanChain().map((e) => (e.id === "s2025" ? { ...e, areaSqm: 4050 } : e)),
      { id: "mp", kind: "MUTATION", subtype: "PARTITION", date: d("2020-01-01"), refDeedRegNo: null } as ChainEvent,
    ];
    expect(checkAreaChanges(ev, opts)[0].severity).toBe("LOW");
  });

  it("keeps HIGH when only a sale or a correction sits between the extracts", () => {
    const grown = cleanChain().map((e) => (e.id === "s2025" ? { ...e, areaSqm: 9300 } : e));
    expect(checkAreaChanges(grown, opts)[0].severity).toBe("HIGH"); // m1 (sale) is in between
    const withPartitionAndCorrection = [
      ...grown,
      { id: "mp", kind: "MUTATION", subtype: "PARTITION", date: d("2020-01-01") } as ChainEvent,
      { id: "mc", kind: "MUTATION", subtype: "CORRECTION", section155: true, date: d("2021-01-01") } as ChainEvent,
    ];
    expect(checkAreaChanges(withPartitionAndCorrection, opts)[0].severity).toBe("HIGH");
  });

  it("flags Class-II to Class-I conversion", () => {
    const ev = cleanChain().map((e) => (e.id === "s1995" ? { ...e, landClass: "Class-II" } : e));
    const flags = checkLandClassChanges(ev);
    expect(flags).toHaveLength(1);
    expect(flags[0].message.en).toContain("Class-II to Class-I");
  });

  it("treats spelling variants of the same class as equal", () => {
    const ev = cleanChain().map((e) => (e.id === "s2005" ? { ...e, landClass: "class I" } : e));
    expect(checkLandClassChanges(ev)).toEqual([]);
  });
});

describe("Section 155 and other rights", () => {
  it("flags Section 155 corrections", () => {
    const ev = [...cleanChain(), { id: "c1", kind: "MUTATION", date: d("2022-05-05"), ferfarNo: "1001", section155: true } as ChainEvent];
    expect(checkSection155(ev).map((f) => f.eventIds[0])).toEqual(["c1"]);
  });

  it("classifies other-rights entries", () => {
    expect(classifyOtherRight("बँक ऑफ महाराष्ट्र बोजा रु. 5,00,000")?.category).toBe("BANK_CHARGE");
    expect(classifyOtherRight("वारस: सौ. सुमन")?.category).toBe("HEIR");
    expect(classifyOtherRight("कुळ: गणपत")?.category).toBe("ENCUMBRANCE");
    expect(classifyOtherRight("something else")).toBeNull();
  });

  it("reports each entry once against the latest extract showing it", () => {
    const ev = cleanChain().map((e) => (e.id === "s2005" || e.id === "s2025" ? { ...e, otherRights: ["बँक ऑफ महाराष्ट्र बोजा"] } : e));
    const flags = checkOtherRights(ev);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ severity: "HIGH", eventIds: ["s2025"] });
  });
});

describe("chain coverage", () => {
  it("flags when the earliest record is inside the 30-year window", () => {
    const ev = cleanChain().filter((e) => e.id !== "s1995");
    const flags = checkChainCoverage(ev, opts).filter((f) => f.rule === "CHAIN_START_GAP");
    expect(flags).toHaveLength(1);
    expect(flags[0].eventIds).toEqual(["deed1"]);
  });

  it("flags a transfer by someone who is not the recorded owner", () => {
    const ev = cleanChain().map((e) => (e.id === "m2" ? { ...e, fromParties: ["महेश शिंदे"] } : e));
    const flags = checkChainCoverage(ev, opts).filter((f) => f.rule === "CHAIN_BREAK");
    expect(flags).toHaveLength(1);
    expect(flags[0].eventIds).toEqual(["s2005", "m2"]);
  });

  it("flags an empty file", () => {
    expect(checkChainCoverage([], opts)[0].rule).toBe("CHAIN_START_GAP");
  });
});

describe("runRules", () => {
  it("is deterministic and sorted by severity", () => {
    const ev = cleanChain().map((e) => (e.id === "s2025" ? { ...e, otherRights: ["वारस: सौ. सुमन"], areaSqm: 9000 } : e));
    const a = runRules(ev, opts);
    const b = runRules([...ev].reverse(), opts);
    expect(a).toEqual(b);
    expect(a.map((f) => f.severity)).toEqual(["HIGH", "MEDIUM"]);
  });
});

describe("review fixes", () => {
  it("chain continuity does not depend on row order for same-date records", () => {
    // The 7/12 dated the same day as the sale already shows the buyer.
    const ev: ChainEvent[] = [
      { id: "s0", kind: "RECORD_SNAPSHOT", date: d("1995-01-01"), owners: ["रामचंद्र पाटील"] },
      { id: "m1", kind: "MUTATION", subtype: "SALE", date: d("2001-08-20"), fromParties: ["रामचंद्र पाटील"], toParties: ["सुरेश जाधव"] },
      { id: "s1", kind: "RECORD_SNAPSHOT", date: d("2001-08-20"), owners: ["सुरेश जाधव"] },
    ];
    const breaks = (e: ChainEvent[]) => checkChainCoverage(e, opts).filter((f) => f.rule === "CHAIN_BREAK");
    expect(breaks(ev)).toEqual([]);
    expect(breaks([ev[0], ev[2], ev[1]])).toEqual([]);
  });

  it("gives each other-rights flag its own key", () => {
    const ev = cleanChain().map((e) => (e.id === "s2025" ? { ...e, otherRights: ["वारस: सौ. सुमन", "बँक बोजा"] } : e));
    expect(checkOtherRights(ev).map((f) => f.key)).toEqual(["वारस: सौ. सुमन", "बँक बोजा"]);
  });
});
