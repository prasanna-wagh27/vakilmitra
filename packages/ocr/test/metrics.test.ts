import { describe, expect, it } from "vitest";
import { cer, matchFields, median, normalize, wer } from "../src/metrics.js";

describe("normalize", () => {
  it("treats Devanagari and ASCII digits, ZWJ and spacing as equal", () => {
    expect(normalize("गट नं. ११२")).toBe("गट नं. 112");
    expect(normalize("हेक्‍टर")).toBe("हेक्टर");
    expect(normalize("  सुरेश \n\t जाधव ")).toBe("सुरेश जाधव");
  });

  it("keeps differences that change meaning", () => {
    expect(normalize("जाधव")).not.toBe(normalize("जाधक"));
    expect(normalize("०.८१")).not.toBe(normalize("0.18"));
  });
});

describe("error rates", () => {
  it("is zero for a perfect read, digits in either script", () => {
    expect(cer("गट क्रमांक : ११२", "गट क्रमांक : 112")).toBe(0);
    expect(wer("सुरेश जाधव", "सुरेश  जाधव")).toBe(0);
  });

  it("counts a wrong matra as one character error", () => {
    // "जाधव" (4 code points) vs "जधव": one deletion.
    expect(cer("जाधव", "जधव")).toBeCloseTo(1 / 4);
  });

  it("counts word errors", () => {
    expect(wer("गाव माळेगाव तालुका बारामती", "गाव माळेगांव तालुका बारामती")).toBeCloseTo(1 / 4);
  });

  it("handles empty text", () => {
    expect(cer("", "")).toBe(0);
    expect(cer("abc", "")).toBe(1);
  });
});

describe("matchFields", () => {
  const ocr = "गाव : माळेगाव तालुका : बारामती\nगट क्रमांक : ११२\nभोगवटादाराचे नाव : सुरेश जाधव, अनिल जाधव\nक्षेत्र : 0.81 हेक्टर\nफेरफार क्र. 456";
  it("checks each expected field value, per spec field group", () => {
    const r = matchFields({ gat_no: "112", village: "माळेगाव", owners: ["सुरेश जाधव", "सुनील जाधव"], area: "0.81", ferfar_no: "४५६" }, ocr);
    const byField = Object.fromEntries(r.map((x) => [`${x.field}:${x.expected}`, x.found]));
    expect(byField).toEqual({
      "gat_no:112": true,
      "village:माळेगाव": true,
      "owners:सुरेश जाधव": true,
      "owners:सुनील जाधव": false,
      "area:0.81": true,
      "ferfar_no:४५६": true,
    });
    expect(r.find((x) => x.field === "area")?.group).toBe("area");
  });
});

it("median", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 2, 3])).toBe(2.5);
});
