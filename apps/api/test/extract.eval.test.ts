/**
 * Extraction eval: 24 synthetic land records (eval/make-extract-set.mts) read by real Tesseract,
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
  ferfar: { fields: ["ferfar_no", "date", "mutation_type", "deed_reg_no", "section_155"], target: 0.95 },
  other: { fields: ["land_class", "other_right"], target: 0.9 },
};

function score() {
  const tally: Record<string, { ok: number; total: number; misses: string[] }> = {};
  for (const s of samples) {
    const facts = extractPage(s.kind, s.words);
    for (const [field, want] of Object.entries(s.truth)) {
      const group = Object.entries(GROUPS).find(([, g]) => g.fields.includes(field))?.[0] ?? "other";
      const t = (tally[group] ??= { ok: 0, total: 0, misses: [] });
      const got = facts.filter((f) => f.field === field).map((f) => clean(f.value));
      const wants = (Array.isArray(want) ? want : [want]).map(clean);
      // Each expected value is one point; each extra value read for the field costs one too.
      const extra = Array.isArray(want) ? got.filter((g) => !wants.includes(g)) : got.slice(1);
      for (const w of wants) {
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

describe("land-record extraction eval (synthetic, 24 pages)", () => {
  const tally = score();
  it("has at least 20 examples", () => expect(samples.length).toBeGreaterThanOrEqual(20));
  for (const [group, g] of Object.entries(GROUPS)) {
    it(`${group} meets ${g.target * 100}%`, () => {
      const t = tally[group] ?? { ok: 0, total: 0, misses: [] };
      const acc = t.total ? t.ok / t.total : 1;
      console.log(`${group}: ${t.ok}/${t.total} = ${(acc * 100).toFixed(1)}%${t.misses.length ? `\n  ${t.misses.join("\n  ")}` : ""}`);
      expect(acc).toBeGreaterThanOrEqual(g.target);
    });
  }
});
