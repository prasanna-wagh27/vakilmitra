/**
 * OCR accuracy metrics for Marathi land records.
 *
 * Text is compared after a normalisation that removes differences no advocate would care about
 * (Unicode form, Devanagari vs ASCII digits, zero-width joiners, spacing), but keeps every
 * difference that changes meaning (a wrong matra, a wrong digit, a missing word).
 */

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export function normalize(text: string): string {
  return (
    text
      .normalize("NFC")
      // ० to ९ -> 0 to 9: 7/12 extracts mix both.
      .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
      // ZWJ / ZWNJ only change how a conjunct is drawn, not what it says.
      .replace(/[‌‍]/g, "")
      // Devanagari danda and common punctuation variants.
      .replace(/[।॥]/g, ".")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Edit distance over Unicode code points (so a matra counts as one character, as it is typed). */
export function levenshtein(a: string[], b: string[]): number {
  if (a.length < b.length) [a, b] = [b, a];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Character error rate: edits needed / characters in the truth. 0 is perfect; can exceed 1. */
export function cer(truth: string, ocr: string): number {
  const t = [...normalize(truth)];
  const o = [...normalize(ocr)];
  if (t.length === 0) return o.length === 0 ? 0 : 1;
  return levenshtein(t, o) / t.length;
}

/** Word error rate on whitespace-separated words. */
export function wer(truth: string, ocr: string): number {
  const t = normalize(truth).split(" ").filter(Boolean);
  const o = normalize(ocr).split(" ").filter(Boolean);
  if (t.length === 0) return o.length === 0 ? 0 : 1;
  return levenshtein(t, o) / t.length;
}

/**
 * Field groups from the spec's quality gates, with their accuracy targets.
 * A field "matches" when its exact normalised value appears in the OCR text as a whole token.
 */
export const FIELD_GROUPS = {
  location: {
    label: "Survey/gat number, village, taluka",
    target: 0.98,
    fields: ["survey_no", "gat_no", "hissa_no", "village", "taluka", "district"],
  },
  owners: { label: "Owner names", target: 0.95, fields: ["owners"] },
  area: { label: "Area and land class", target: 0.97, fields: ["area", "land_class"] },
  ferfar: { label: "Ferfar number and date", target: 0.95, fields: ["ferfar_no", "ferfar_date"] },
} as const;

export type FieldGroup = keyof typeof FIELD_GROUPS;
/** Ground-truth fields for one page; owners and other multi-valued fields are arrays. */
export type TruthFields = Partial<Record<string, string | string[]>>;

export interface FieldResult {
  group: FieldGroup;
  field: string;
  expected: string;
  found: boolean;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * True when `value` appears in `text` as a whole token: not inside a longer number or word.
 * "112" is not found in "1120", "2" is not found in "112", "0.8" is not found in "0.81",
 * but "112" is found in "गट 112." and "सुरेश जाधव" in "सुरेश जाधव, अनिल".
 */
export function containsToken(text: string, value: string): boolean {
  if (!value) return false;
  const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{M}\\p{N}]|[.,/]\\p{N})`, "u");
  return re.test(text);
}

export function matchFields(fields: TruthFields, ocr: string): FieldResult[] {
  const text = normalize(ocr);
  const out: FieldResult[] = [];
  for (const [group, def] of Object.entries(FIELD_GROUPS) as [FieldGroup, (typeof FIELD_GROUPS)[FieldGroup]][]) {
    for (const field of def.fields) {
      const v = fields[field];
      for (const expected of Array.isArray(v) ? v : v ? [v] : []) {
        const want = normalize(expected);
        if (want) out.push({ group, field, expected, found: containsToken(text, want) });
      }
    }
  }
  return out;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN;
}
