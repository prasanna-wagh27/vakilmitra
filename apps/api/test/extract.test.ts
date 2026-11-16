import { describe, expect, it } from "vitest";
import { classifyText, extractDocument, extractPage, parseAreaSqm, parseDate, parseLandClass, splitNames, toLines } from "../src/land/extract.js";

/** Words for one line of text at row y (fractions), split on spaces. */
function line(text: string, y: number, c = 0.95) {
  let x = 0.05;
  return text.split(" ").map((t) => {
    const w = { t, c, b: [x, y, x + 0.01 * t.length + 0.01, y + 0.03] as [number, number, number, number] };
    x = w.b[2] + 0.01;
    return w;
  });
}
const page = (...rows: string[]) => rows.flatMap((r, i) => line(r, 0.05 + i * 0.06));

describe("value parsers", () => {
  it("reads areas in hectares, H.R.Sqm triples, ares, sq m and acres", () => {
    expect(parseAreaSqm("0.81 हेक्टर")).toBe(8100);
    expect(parseAreaSqm("०.८१.०० हे.आर.चौ.मी")).toBe(8100);
    expect(parseAreaSqm("1.20.50")).toBe(12050);
    expect(parseAreaSqm("81 आर")).toBe(8100);
    expect(parseAreaSqm("8100 चौ.मी.")).toBe(8100);
    expect(parseAreaSqm("2 एकर")).toBe(8094);
    expect(parseAreaSqm("माहीत नाही")).toBeNull();
  });

  it("reads dd/mm/yyyy dates in either digit set, and rejects impossible ones", () => {
    expect(parseDate("०२/०४/२०१९")).toBe("2019-04-02");
    expect(parseDate("2-4-2019")).toBe("2019-04-02");
    expect(parseDate("31/13/2019")).toBeNull();
  });

  it("normalises land class", () => {
    expect(parseLandClass("भोगवटादार वर्ग -2")).toBe("Class-II");
    expect(parseLandClass("भोगवटादार वर्ग -१")).toBe("Class-I");
    expect(parseLandClass("Class II")).toBe("Class-II");
    expect(parseLandClass("शासकीय")).toBeNull();
  });

  it("splits names on commas and 'व', dropping ferfar refs", () => {
    expect(splitNames("सुरेश जाधव (456), अनिल जाधव व सुनील जाधव")).toEqual(["सुरेश जाधव", "अनिल जाधव", "सुनील जाधव"]);
  });
});

describe("classification", () => {
  it("tells 7/12, Ferfar and Index-II apart, and says nothing when unsure", () => {
    expect(classifyText("गाव नमुना सात\nभोगवटादाराचे नाव : अ")?.kind).toBe("SEVEN_TWELVE");
    expect(classifyText("गाव नमुना सहा फेरफार नोंद क्रमांक : 5")?.kind).toBe("FERFAR");
    expect(classifyText("सूची क्र. २ लिहून देणार : अ")?.kind).toBe("INDEX_II");
    expect(classifyText("नोटीस")).toBeNull();
  });
});

describe("extractPage", () => {
  it("needs a separator after labels that are also ordinary words", () => {
    const facts = extractPage("SEVEN_TWELVE", page("गाव नमुना सात", "गाव : माळेगाव"));
    expect(facts.filter((f) => f.field === "village").map((f) => f.value)).toEqual(["माळेगाव"]);
  });

  it("accepts a separator glued to the label", () => {
    const facts = extractPage("SEVEN_TWELVE", page("गाव:- शिरूर तालुका: हवेली"));
    expect(facts.map((f) => [f.field, f.value])).toEqual([
      ["village", "शिरूर"],
      ["taluka", "हवेली"],
    ]);
  });

  it("gives each owner listed on its own line its own source box", () => {
    const facts = extractPage("SEVEN_TWELVE", page("भोगवटादाराचे नाव :", "सुरेश जाधव (456)", "अनिल जाधव (789)", "क्षेत्र : 0.81 हेक्टर"));
    const owners = facts.filter((f) => f.field === "owner");
    expect(owners.map((o) => [o.value, o.position])).toEqual([
      ["सुरेश जाधव", 0],
      ["अनिल जाधव", 1],
    ]);
    expect(owners[0].box?.[1]).toBeCloseTo(0.11);
    expect(owners[1].box?.[1]).toBeCloseTo(0.17);
    expect(facts.find((f) => f.field === "area")?.value).toBe("8100");
  });

  it("reports the weakest word's confidence, so a doubtful reading shows as doubtful", () => {
    const words = [...line("गट क्रमांक :", 0.1), ...line("1l2", 0.1, 0.41).map((w) => ({ ...w, b: [0.4, 0.1, 0.45, 0.13] as typeof w.b }))];
    const gat = extractPage("SEVEN_TWELVE", words).find((f) => f.field === "gat_no");
    expect(gat).toMatchObject({ value: "1l2", confidence: 0.41 });
  });

  it("reads heirship prose in a ferfar", () => {
    const facts = extractPage("FERFAR", page("फेरफार नोंद क्रमांक : 789", "मयत सुरेश जाधव यांचे वारस अनिल जाधव, सुनील जाधव", "यांची नावे दाखल केली."));
    expect(facts.filter((f) => f.field === "from_party").map((f) => f.value)).toEqual(["सुरेश जाधव"]);
    expect(facts.filter((f) => f.field === "to_party").map((f) => f.value)).toEqual(["अनिल जाधव", "सुनील जाधव"]);
    expect(facts.find((f) => f.field === "mutation_type")).toMatchObject({ value: "HEIRSHIP", box: null });
  });

  it("ignores fields that do not belong to the record kind", () => {
    const facts = extractPage("INDEX_II", page("भोगवटादाराचे नाव : अ", "दस्त क्रमांक : 1234/2001"));
    expect(facts.map((f) => f.field)).toEqual(["deed_reg_no"]);
  });
});

describe("extractDocument", () => {
  it("keeps the first reading of single fields across pages and collects owners from all pages", () => {
    const out = extractDocument("SEVEN_TWELVE", [
      { pageId: "p1", words: page("गाव : माळेगाव", "भोगवटादाराचे नाव : सुरेश जाधव") },
      { pageId: "p2", words: page("गाव : शिरूर", "भोगवटादाराचे नाव : अनिल जाधव, सुरेश जाधव") },
    ]);
    expect(out.filter((f) => f.field === "village").map((f) => [f.value, f.pageId])).toEqual([["माळेगाव", "p1"]]);
    expect(out.filter((f) => f.field === "owner").map((f) => [f.value, f.position, f.pageId])).toEqual([
      ["सुरेश जाधव", 0, "p1"],
      ["अनिल जाधव", 1, "p2"],
    ]);
  });

  it("groups words into lines by their vertical position", () => {
    expect(toLines([...line("ब", 0.5), ...line("अ", 0.1)]).map((l) => l.map((w) => w.t))).toEqual([["अ"], ["ब"]]);
  });
});
