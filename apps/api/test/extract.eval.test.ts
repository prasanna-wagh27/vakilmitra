/**
 * Extraction eval: synthetic land records (eval/make-extract-set.mts), in label and table layouts, read by real Tesseract,
 * scored per field group against the spec's targets. Synthetic pages test the extractor against
 * OCR noise and layout variants; they do not measure accuracy on real government records.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clean, extractPage, type RecordKind } from "../src/land/extract.js";

interface Sample {
  name: string;
  kind: RecordKind;
  truth: Record<string, string | string[]>;
  words: { t: string; c: number; b: [number, number, number, number] }[];
}
const dir = join(import.meta.dirname, "fixtures", "extract");
const samples: Sample[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

/** Spec targets per group (V1 spec, land-file analyzer). */
const GROUPS: Record<string, { fields: string[]; target: number }> = {
  location: { fields: ["village", "taluka", "district", "gat_no", "survey_no"], target: 0.98 },
  owners: { fields: ["owner", "from_party", "to_party"], target: 0.95 },
  area: { fields: ["area"], target: 0.97 },
  ferfar: { fields: ["ferfar_no", "date", "mutation_type", "deed_type", "deed_reg_no", "section_155"], target: 0.95 },
  other: { fields: ["land_class", "other_right"], target: 0.9 },
};

/** Fields worked out from the page's words rather than read off it: always scored. */
const INFERRED = new Set(["mutation_type", "deed_type", "land_class", "section_155"]);

/**
 * Whether the OCR text still holds a value at all. One it lost (a digit misread) is an OCR miss,
 * measured by the OCR eval: no extractor can recover it, and a blank is the right answer.
 */
function ocrHas(field: string, value: string, text: string) {
  if (INFERRED.has(field)) return true;
  if (field === "area") {
    const sqm = Number(value);
    const [ha, are, m] = [Math.floor(sqm / 10_000), Math.floor((sqm % 10_000) / 100), sqm % 100];
    const two = (n: number) => String(n).padStart(2, "0");
    return text.includes(`${ha}.${two(are)}.${two(m)}`) || text.includes(`${ha}.${two(are)}`);
  }
  if (field === "date") return text.includes(value.split("-").reverse().join("/"));
  return text.includes(value);
}

function score() {
  const tally: Record<string, { ok: number; total: number; misses: string[]; ocr: string[] }> = {};
  for (const s of samples) {
    const facts = extractPage(s.kind, s.words);
    const text = clean(s.words.map((w) => w.t).join(" "));
    for (const [field, want] of Object.entries(s.truth)) {
      const group = Object.entries(GROUPS).find(([, g]) => g.fields.includes(field))?.[0] ?? "other";
      tally[group] ??= { ok: 0, total: 0, misses: [], ocr: [] };
      const t = tally[group];
      const got = facts.filter((f) => f.field === field).map((f) => clean(f.value));
      const wants = (Array.isArray(want) ? want : [want]).map(clean);
      // Each expected value is one point; each extra value read for the field costs one too.
      const extra = Array.isArray(want) ? got.filter((g) => !wants.includes(g)) : got.slice(1);
      for (const w of wants) {
        if (!got.includes(w) && !ocrHas(field, w, text)) {
          t.ocr.push(`${s.name}.${field}: ${w} is not in the OCR text`);
          continue;
        }
        t.total++;
        if (got.includes(w)) t.ok++;
        else t.misses.push(`${s.name}.${field}: want ${w}, got ${JSON.stringify(got)}`);
      }
      t.total += extra.length;
      for (const e of extra) t.misses.push(`${s.name}.${field}: extra ${e}`);
    }
  }
  return tally;
}

describe(`land-record extraction eval (synthetic, ${samples.length} pages)`, () => {
  const tally = score();
  it("has at least 20 examples, 10 of them table-layout 7/12s", () => {
    expect(samples.length).toBeGreaterThanOrEqual(20);
    expect(samples.filter((s) => s.name.startsWith("satbara-table")).length).toBeGreaterThanOrEqual(10);
  });
  it("loses few values to OCR (otherwise the set measures the OCR, not the extractor)", () => {
    const lost = Object.values(tally).flatMap((t) => t.ocr);
    const all = lost.length + Object.values(tally).reduce((n, t) => n + t.total, 0);
    expect(lost.length / all).toBeLessThan(0.02);
  });
  for (const [group, g] of Object.entries(GROUPS)) {
    it(`${group} meets ${g.target * 100}%`, () => {
      const t = tally[group] ?? { ok: 0, total: 0, misses: [], ocr: [] };
      const acc = t.total ? t.ok / t.total : 1;
      const notes = [...t.misses, ...t.ocr.map((m) => `(OCR) ${m}`)];
      console.log(`${group}: ${t.ok}/${t.total} = ${(acc * 100).toFixed(1)}%${notes.length ? `\n  ${notes.join("\n  ")}` : ""}`);
      expect(acc).toBeGreaterThanOrEqual(g.target);
    });
  }
});
