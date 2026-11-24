import { describe, expect, it } from "vitest";
import {
  classifyText,
  extractDocument,
  extractPage,
  headingRow,
  parseAreaSqm,
  parseDate,
  parseLandClass,
  splitNames,
  toLines,
} from "../src/land/extract.js";

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
    // The H.R.Sqm column header after a hectare value is hectares, not square metres.
    expect(parseAreaSqm("0.81 हे.आर.चौ.मी.")).toBe(8100);
  });

  it("leaves an area blank rather than guess when OCR garbled the number", () => {
    expect(parseAreaSqm("0.3¢.00")).toBeNull();
    expect(parseAreaSqm("0,3¢.00")).toBeNull();
    expect(parseAreaSqm("1.20.5¥")).toBeNull();
    // A comma misread for a dot is still a reading; grouped thousands stay thousands.
    expect(parseAreaSqm("०.७०,००")).toBe(7000);
    expect(parseAreaSqm("8,100 चौ.मी.")).toBe(8100);
    expect(parseAreaSqm("0.81.")).toBe(8100);
  });

  it("reads dd/mm/yyyy dates in either digit set, and rejects impossible ones", () => {
    expect(parseDate("०२/०४/२०१९")).toBe("2019-04-02");
    expect(parseDate("2-4-2019")).toBe("2019-04-02");
    expect(parseDate("31/13/2019")).toBeNull();
    expect(parseDate("31/02/2019")).toBeNull(); // no rolling over into March
    expect(parseDate("29/02/2020")).toBe("2020-02-29");
  });

  it("normalises land class", () => {
    expect(parseLandClass("भोगवटादार वर्ग -2")).toBe("Class-II");
    expect(parseLandClass("भोगवटादार वर्ग -१")).toBe("Class-I");
    expect(parseLandClass("Class II")).toBe("Class-II");
    expect(parseLandClass("शासकीय")).toBeNull();
    expect(parseLandClass("वर्ग दोन")).toBe("Class-II");
    expect(parseLandClass("-2")).toBe("Class-II");
    expect(parseLandClass("भोगवटादार वर्ग 1 खाते 2")).toBe("Class-I"); // a stray number is not the class
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

  it("reads 'भोगवटादार वर्ग -2', where the class follows the label with no separator", () => {
    const facts = extractPage("SEVEN_TWELVE", page("भोगवटादार वर्ग -2"));
    expect(facts.find((f) => f.field === "land_class")?.value).toBe("Class-II");
  });

  it("ends a value at any label, even one the record kind does not use", () => {
    const facts = extractPage("INDEX_II", page("लिहून घेणार : श्याम जोशी फेरफार क्र. : 789"));
    expect(facts.filter((f) => f.field === "to_party").map((f) => f.value)).toEqual(["श्याम जोशी"]);
  });

  it("reads an Index-II's deed type, and assumes none when it is not stated", () => {
    const typed = extractPage("INDEX_II", page("दस्ताचा प्रकार : गहाणखत", "दस्त क्रमांक : 1/2001"));
    expect(typed.find((f) => f.field === "deed_type")?.value).toBe("MORTGAGE");
    expect(extractPage("INDEX_II", page("दस्त क्रमांक : 1/2001")).find((f) => f.field === "deed_type")).toBeUndefined();
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

/** Words placed at given x positions on row y: a table row. Each cell's words are spaced like a word space. */
function cellsAt(y: number, ...cells: [number, string][]) {
  return cells.flatMap(([x0, text]) =>
    line(text, y).map((w) => ({ ...w, b: [w.b[0] - 0.05 + x0, w.b[1], w.b[2] - 0.05 + x0, w.b[3]] as typeof w.b })),
  );
}
const at = (i: number) => 0.05 + i * 0.06;
const values = (facts: { field: string; value: string }[], field: string) => facts.filter((f) => f.field === field).map((f) => f.value);

/** The owners table of a computerised 7/12: account | owner | area | assessment | ferfar. */
const OWNER_HEADINGS: [number, string][] = [
  [0.02, "खाते क्रमांक"],
  [0.25, "भोगवटादाराचे नाव"],
  [0.55, "क्षेत्र"],
  [0.7, "आकार"],
  [0.85, "फेरफार क्र."],
];
const ownerRow = (i: number, acct: string, name: string, area: string, aakar: string, ferfar: string) =>
  cellsAt(at(i), [0.04, acct], [0.2, name], [0.54, area], [0.7, aakar], [0.85, ferfar]);

describe("table-layout 7/12", () => {
  it("knows a heading row from a line of prose or a row of values", () => {
    const row = (text: string) => toLines(line(text, 0.1))[0];
    expect(headingRow(row("खाते क्रमांक भोगवटादाराचे नाव क्षेत्र आकार फेरफार क्र."))?.map((c) => c.col)).toEqual([
      "ignore",
      "owners",
      "area",
      "ignore",
      "ferfar_no",
    ]);
    expect(headingRow(row("इतर हक्क"))?.map((c) => c.col)).toEqual(["other_rights"]);
    expect(headingRow(row("क्षेत्र चुकीचे नोंदले होते ते दुरुस्त केले"))).toBeNull(); // prose that mentions a heading
    expect(headingRow(row("एकूण क्षेत्र 0.81.00"))).toBeNull(); // numbers: a row of values
    expect(headingRow(row("भोगवटादाराचे नाव :"))).toBeNull(); // a label, read as "label : value"
  });

  it("reads one owner per row, the total area and the latest mutation from the owners table", () => {
    const facts = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), ...OWNER_HEADINGS),
      ...ownerRow(1, "123", "सुरेश रामचंद्र जाधव", "0.40.50", "1.25", "(456)"),
      ...ownerRow(2, "124", "अनिल सुरेश जाधव", "0.40.50", "1.25", "(812)"),
      ...cellsAt(at(3), [0.2, "एकूण"], [0.54, "0.81.00"], [0.7, "2.50"]),
    ]);
    expect(values(facts, "owner")).toEqual(["सुरेश रामचंद्र जाधव", "अनिल सुरेश जाधव"]); // not "एकूण", not the account numbers
    expect(values(facts, "area")).toEqual(["8100"]); // the total, not an owner's share
    expect(values(facts, "ferfar_no")).toEqual(["812"]);
    const [first, second] = facts.filter((f) => f.field === "owner");
    // Each owner's source crop is their own cell.
    expect(first.box?.[0]).toBeCloseTo(0.2);
    expect(first.box?.[1]).toBeCloseTo(at(1));
    expect(second.box?.[1]).toBeCloseTo(at(2));
    expect(first.box?.[2]).toBeLessThan(0.5);
  });

  it("takes no area from owners' shares when there is no total row, but does from a single row", () => {
    const shares = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), ...OWNER_HEADINGS),
      ...ownerRow(1, "1", "सुरेश जाधव", "0.40.50", "1.25", "(456)"),
      ...ownerRow(2, "2", "अनिल जाधव", "0.20.00", "0.60", "(457)"),
    ]);
    expect(values(shares, "area")).toEqual([]);
    const one = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), ...OWNER_HEADINGS),
      ...ownerRow(1, "1", "सुरेश जाधव", "0.40.50", "1.25", "(456)"),
    ]);
    expect(values(one, "area")).toEqual(["4050"]);
  });

  it("reads values printed under their headings", () => {
    const facts = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), [0.15, "भूमापन क्रमांक व उपविभाग"], [0.6, "भूधारणा पद्धती"]),
      ...cellsAt(at(1), [0.22, "११२/१"], [0.6, "भोगवटादार वर्ग -२"]),
    ]);
    expect(values(facts, "survey_no")).toEqual(["112/1"]);
    expect(values(facts, "land_class")).toEqual(["Class-II"]);
  });

  it("reads a heading that wraps onto a second line, and an account number inside the owner's cell", () => {
    const facts = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), [0.02, "खाते क्रमांक"], [0.25, "भोगवटादाराचे"], [0.55, "क्षेत्र"]),
      ...cellsAt(at(1), [0.28, "नाव"]),
      ...cellsAt(at(2), [0.2, "272 गणपत मोरे"], [0.54, "0.11.00"]),
    ]);
    expect(values(facts, "owner")).toEqual(["गणपत मोरे"]);
  });

  it("gives a long name that runs past its heading to the name column", () => {
    const facts = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), [0.05, "खाते क्रमांक"], [0.25, "भोगवटादाराचे नाव"], [0.62, "क्षेत्र"]),
      // Ends at 0.53: past the halfway line to the next heading (0.48), still mostly under "name".
      ...cellsAt(at(1), [0.06, "12"], [0.21, "श्रीमती लक्ष्मीबाई रामचंद्र देशमुख"], [0.62, "0.50.00"]),
    ]);
    expect(values(facts, "owner")).toEqual(["श्रीमती लक्ष्मीबाई रामचंद्र देशमुख"]);
    expect(values(facts, "area")).toEqual(["5000"]);
  });

  it("splits cells at ruled lines that OCR reads as '|'", () => {
    const word = (t: string, x0: number, x1: number) => ({
      t,
      c: 0.95,
      b: [x0, at(1), x1, at(1) + 0.03] as [number, number, number, number],
    });
    const words = [
      ...cellsAt(at(0), [0.05, "भोगवटादाराचे"], [0.22, "क्षेत्र"]),
      // Cells closer than a column gap (0.02), told apart only by the table's rule between them.
      word("सुरेश", 0.05, 0.11),
      word("जाधव", 0.12, 0.17),
      word("|", 0.175, 0.185),
      word("0.81.00", 0.19, 0.27),
    ];
    const facts = extractPage("SEVEN_TWELVE", words);
    expect(values(facts, "owner")).toEqual(["सुरेश जाधव"]);
    expect(values(facts, "area")).toEqual(["8100"]);
  });

  it("records a tenant column and the other-rights box as other rights", () => {
    const facts = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), [0.05, "भोगवटादाराचे नाव"], [0.45, "कुळाचे नाव"], [0.8, "फेरफार क्र."]),
      ...cellsAt(at(1), [0.05, "सुरेश जाधव"], [0.45, "गणपत मोरे"], [0.8, "(456)"]),
      ...cellsAt(at(3), [0.05, "इतर हक्क"]),
      ...cellsAt(at(4), [0.05, "बँक ऑफ महाराष्ट्र बोजा रु. 5,00,000"]),
      ...cellsAt(at(5), [0.05, "विकास सोसायटी कर्ज बोजा"]),
    ]);
    expect(values(facts, "owner")).toEqual(["सुरेश जाधव"]);
    expect(values(facts, "other_right")).toEqual(["कुळ: गणपत मोरे", "बँक ऑफ महाराष्ट्र बोजा रु. 5,00,000", "विकास सोसायटी कर्ज बोजा"]);
  });

  it("ends a table at a 'label : value' line and at a gap in the page", () => {
    const facts = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), [0.05, "भोगवटादाराचे नाव"], [0.5, "क्षेत्र"]),
      ...cellsAt(at(1), [0.05, "सुरेश जाधव"], [0.5, "0.81.00"]),
      ...line("तलाठी : महेश कुलकर्णी", at(2)),
      ...cellsAt(at(3), [0.05, "अनिल शिंदे"]),
    ]);
    expect(values(facts, "owner")).toEqual(["सुरेश जाधव"]);
    const gap = extractPage("SEVEN_TWELVE", [
      ...cellsAt(at(0), [0.05, "भोगवटादाराचे नाव"]),
      ...cellsAt(at(1), [0.05, "सुरेश जाधव"]),
      ...cellsAt(at(12), [0.05, "तलाठी सजा माळेगाव"]), // the footer, far below
    ]);
    expect(values(gap, "owner")).toEqual(["सुरेश जाधव"]);
  });

  it("does not take a 7/12's table fields on records that do not carry them", () => {
    const facts = extractPage("INDEX_II", [
      ...cellsAt(at(0), ...OWNER_HEADINGS),
      ...ownerRow(1, "1", "सुरेश जाधव", "0.40.50", "1.25", "(456)"),
    ]);
    expect(values(facts, "owner")).toEqual([]);
    expect(values(facts, "ferfar_no")).toEqual([]);
  });

  it("reads the place line, the survey box, the area line and the owners table of one page together", () => {
    const facts = extractPage("SEVEN_TWELVE", [
      ...line("गाव नमुना सात", at(0)),
      ...line("गाव :- माळेगाव तालुका :- बारामती जिल्हा :- पुणे", at(1)),
      ...cellsAt(at(2), [0.15, "गट क्रमांक"], [0.6, "भूधारणा पद्धती"]),
      ...cellsAt(at(3), [0.18, "245"], [0.6, "भोगवटादार वर्ग -1"]),
      ...line("एकूण क्षेत्र 0.81.00 हे.आर.चौ.मी", at(4)),
      ...cellsAt(at(5), ...OWNER_HEADINGS),
      ...ownerRow(6, "123", "सुरेश जाधव", "0.40.50", "1.25", "(456)"),
      ...ownerRow(7, "124", "अनिल जाधव", "0.40.50", "1.25", "(812)"),
    ]);
    expect(
      Object.fromEntries(["village", "taluka", "district", "gat_no", "land_class", "area", "ferfar_no"].map((f) => [f, values(facts, f)])),
    ).toEqual({
      village: ["माळेगाव"],
      taluka: ["बारामती"],
      district: ["पुणे"],
      gat_no: ["245"],
      land_class: ["Class-I"],
      area: ["8100"],
      ferfar_no: ["812"],
    });
    expect(values(facts, "owner")).toEqual(["सुरेश जाधव", "अनिल जाधव"]);
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
