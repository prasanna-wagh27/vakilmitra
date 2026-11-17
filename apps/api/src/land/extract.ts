/**
 * Template extraction of land-record fields from OCR output. Pure functions, no I/O, no LLM:
 * a page is split into lines from the OCR word boxes, known Marathi labels are found, and the
 * words after each label become the value. Every value keeps the box of its label and words on
 * the page (the source crop) and the lowest OCR confidence among its words, so the advocate can
 * see where it came from and how sure the reading was. Nothing here is final: each fact is
 * reviewed by the advocate before it is used.
 */
import type { OcrWord } from "@vakilmitra/db";
import type { FactField, RecordKind } from "@vakilmitra/shared";

export type { FactField, RecordKind };

export interface ExtractedFact {
  field: FactField;
  value: string;
  /** Order among facts of the same field (owners, other rights, parties). */
  position: number;
  confidence: number;
  /** Source crop as fractions of the page: [x0, y0, x1, y1]. Null when inferred from the whole page. */
  box: [number, number, number, number] | null;
}

// ---------- text helpers ----------

const DEV_DIGITS = "०१२३४५६७८९";
/** NFC, no zero-width joiners, Devanagari digits as ASCII, single spaces. */
export function clean(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}
const key = (s: string) => clean(s).toLowerCase();

interface Tok extends OcrWord {
  k: string; // cleaned, lower-cased text
}
type Line = Tok[];

/** Group words into lines: a word joins the line whose vertical band contains its centre. */
export function toLines(words: OcrWord[]): Line[] {
  const toks = words
    .map((w) => ({ ...w, k: key(w.t) }))
    .filter((w) => w.k)
    .sort((a, b) => (a.b[1] + a.b[3]) / 2 - (b.b[1] + b.b[3]) / 2);
  const lines: { y0: number; y1: number; toks: Tok[] }[] = [];
  for (const t of toks) {
    const cy = (t.b[1] + t.b[3]) / 2;
    const line = lines.find((l) => cy >= l.y0 && cy <= l.y1);
    if (line) {
      line.toks.push(t);
      line.y0 = Math.min(line.y0, t.b[1]);
      line.y1 = Math.max(line.y1, t.b[3]);
    } else lines.push({ y0: t.b[1], y1: t.b[3], toks: [t] });
  }
  return lines.sort((a, b) => a.y0 - b.y0).map((l) => l.toks.sort((a, b) => a.b[0] - b.b[0]));
}

const unionBox = (toks: Tok[]): [number, number, number, number] => [
  Math.min(...toks.map((t) => t.b[0])),
  Math.min(...toks.map((t) => t.b[1])),
  Math.max(...toks.map((t) => t.b[2])),
  Math.max(...toks.map((t) => t.b[3])),
];
const minConf = (toks: Tok[]) => Math.round(Math.min(...toks.map((t) => t.c)) * 1000) / 1000;
const isSep = (k: string) => /^[:：\-–—=]+$/.test(k);

// ---------- labels ----------

interface Label {
  field: FactField | "owners" | "other_rights" | "from_parties" | "to_parties" | "land_class_raw";
  /** Label words, cleaned and lower-cased; a trailing ":" on the last word is tolerated. */
  words: string[];
  /** Whether a separator (":" or "-") must follow. Labels that are also common words need one. */
  needsSep: boolean;
}
const L = (field: Label["field"], phrase: string, needsSep = true): Label => ({ field, words: key(phrase).split(" "), needsSep });

/** Longest phrases first, so "गट क्रमांक" wins over "गट". */
const LABELS: Label[] = [
  L("village", "गावाचे नाव"),
  L("village", "गाव"),
  L("village", "मौजे"),
  L("taluka", "तालुका"),
  L("taluka", "ता."),
  L("district", "जिल्हा"),
  L("district", "जि."),
  L("survey_no", "भूमापन क्रमांक व उपविभाग"),
  L("survey_no", "भूमापन क्रमांक"),
  L("survey_no", "सर्वे नंबर"),
  L("survey_no", "सर्व्हे नंबर"),
  L("survey_no", "सर्वे क्रमांक"),
  L("survey_no", "स.नं."),
  L("gat_no", "गट क्रमांक"),
  L("gat_no", "गट नंबर"),
  L("gat_no", "गट नं."),
  L("gat_no", "गट क्र."),
  L("hissa_no", "हिस्सा क्रमांक"),
  L("hissa_no", "हिस्सा नंबर"),
  L("hissa_no", "हि.नं."),
  L("owners", "भोगवटादाराचे नाव"),
  L("owners", "भोगवटादारांची नावे"),
  L("owners", "खातेदाराचे नाव"),
  L("area", "एकूण क्षेत्र"),
  L("area", "क्षेत्र"),
  L("land_class_raw", "भूधारणा पद्धती"),
  L("land_class_raw", "भोगवटादार वर्ग"),
  L("other_rights", "इतर हक्क"),
  L("ferfar_no", "फेरफार नोंद क्रमांक"),
  L("ferfar_no", "फेरफार क्रमांक"),
  L("ferfar_no", "फेरफार क्र."),
  L("ferfar_no", "फेरफार नं."),
  L("ferfar_no", "ferfar no.", false),
  L("ferfar_no", "mutation no.", false),
  L("date", "नोंदणी दिनांक"),
  L("date", "दिनांक"),
  L("date", "दि."),
  L("deed_reg_no", "दस्त नोंदणी क्रमांक"),
  L("deed_reg_no", "दस्त क्रमांक"),
  L("deed_reg_no", "दस्त क्र."),
  L("from_parties", "लिहून देणार"),
  L("from_parties", "लिहून देणाऱ्याचे नाव"),
  L("from_parties", "विक्रेता"),
  L("to_parties", "लिहून घेणार"),
  L("to_parties", "लिहून घेणाऱ्याचे नाव"),
  L("to_parties", "खरेदीदार"),
].sort((a, b) => b.words.length - a.words.length);

/** Does `label` start at index i of the line? Returns the index after the label (and separator), or -1. */
function matchLabel(line: Line, i: number, label: Label): number {
  let j = i;
  for (let w = 0; w < label.words.length; w++, j++) {
    const tok = line[j]?.k;
    if (!tok) return -1;
    const want = label.words[w];
    const last = w === label.words.length - 1;
    // OCR often glues the separator to the label ("गाव:" or "गाव:-").
    if (tok !== want && !(last && tok.replace(/[:：\-–—]+$/, "") === want && /[:：\-–—]$/.test(tok))) return -1;
  }
  const glued = /[:：\-–—]$/.test(line[j - 1].k);
  if (line[j] && isSep(line[j].k)) return j + 1;
  if (glued) return j;
  return label.needsSep ? -1 : j;
}

interface Hit {
  label: Label;
  line: number;
  start: number; // label start index
  valueStart: number;
}

function findHits(lines: Line[]): Hit[] {
  const hits: Hit[] = [];
  lines.forEach((line, li) => {
    for (let i = 0; i < line.length; i++) {
      for (const label of LABELS) {
        const v = matchLabel(line, i, label);
        if (v >= 0) {
          hits.push({ label, line: li, start: i, valueStart: v });
          i = v - 1;
          break;
        }
      }
    }
  });
  return hits;
}

// ---------- value parsers ----------

/** "0.81 हेक्टर", "०.८१.०० हे.आर", "81 आर", "8100 चौ.मी." -> square metres. */
export function parseAreaSqm(raw: string): number | null {
  const s = clean(raw).toLowerCase();
  const hra = s.match(/(\d+)\.(\d{1,2})\.(\d{1,2})/); // हे.आर.चौ.मी. triple
  if (hra) return Number(hra[1]) * 10_000 + Number(hra[2]) * 100 + Number(hra[3]);
  const n = s.match(/\d+(?:\.\d+)?/);
  if (!n) return null;
  const v = Number(n[0]);
  const unit = s.slice((n.index ?? 0) + n[0].length);
  if (/चौ|sq/.test(unit)) return Math.round(v);
  if (/एकर|acre/.test(unit)) return Math.round(v * 4046.86);
  if (/गुंठ/.test(unit)) return Math.round(v * 101.17);
  if (/^\s*आर|^\s*are/.test(unit)) return Math.round(v * 100);
  return Math.round(v * 10_000); // हेक्टर / हे. / unit-less: 7/12 extracts show hectares
}

/** "०२/०४/२०१९", "2-4-2019", "02.04.2019" -> "2019-04-02". */
export function parseDate(raw: string): string | null {
  const m = clean(raw).match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "भोगवटादार वर्ग -2", "वर्ग २", "Class II" -> "Class-II". */
export function parseLandClass(raw: string): string | null {
  const s = clean(raw).toLowerCase();
  if (/(वर्ग|class)\s*[-–]?\s*(2|ii|दोन)\b/.test(s) || /\b(2|ii)\b/.test(s)) return "Class-II";
  if (/(वर्ग|class)\s*[-–]?\s*(1|i|एक)\b/.test(s) || /\b(1|i)\b/.test(s)) return "Class-I";
  return null;
}

/** Split a names value into people: on commas, semicolons and the standalone word "व" (and). */
export function splitNames(raw: string): string[] {
  return clean(raw)
    .replace(/\(\s*\d+\s*\)/g, " ") // ferfar refs printed beside owners: "सुरेश जाधव (456)"
    .split(/[,;]|\sव\s/)
    .map((n) => n.replace(/^[\s.\-–:]+|[\s.\-–:]+$/g, "").trim())
    .filter((n) => n.length > 1 && /[ऀ-ॿa-z]/i.test(n));
}

/** The first token that starts with a digit, whole ("112/1", "45अ"; an OCR slip like "1l2" stays visible, not cut short). */
const firstNumberish = (raw: string) =>
  clean(raw)
    .replace(/\s*\/\s*/g, "/")
    .match(/\d[^\s,;]*/)?.[0]
    .replace(/[.,:;]+$/, "") ?? null;

/** Mutation type from the ferfar text, by keyword. */
const MUTATION_TYPES: [RegExp, string][] = [
  [/वारस|heirship/, "HEIRSHIP"],
  [/खरेदी|विक्री|sale/, "SALE"],
  [/बक्षीस|दान|gift/, "GIFT"],
  [/वाटणी|वाटप|partition/, "PARTITION"],
  [/बोजा|गहाण|कर्ज|mortgage/, "MORTGAGE"],
  [/मृत्युपत्र|will/, "WILL"],
  [/हक्कसोड|release/, "RELEASE"],
  [/कलम\s*155|दुरुस्ती|correction/, "CORRECTION"],
];

// ---------- classification ----------

const KIND_KEYWORDS: Record<RecordKind, RegExp[]> = {
  SEVEN_TWELVE: [/गाव नमुना सात/, /7\s*\/\s*12/, /अधिकार अभिलेख/, /भोगवटादाराचे नाव/, /भूधारणा/, /इतर हक्क/],
  FERFAR: [/गाव नमुना सहा/, /फेरफार नोंद/, /फेरफार पत्रक/, /नोंदवही/, /मंडळ अधिकारी/, /कलम\s*155/, /फेरफार क्रमांक/],
  INDEX_II: [/सूची\s*(क्र\.?|क्रमांक)\s*2/, /लिहून देणार/, /लिहून घेणार/, /मोबदला/, /दुय्यम निबंधक/, /दस्त क्रमांक/],
};

/** Which record a page is, by keyword score. Null when nothing matches clearly. */
export function classifyText(text: string): { kind: RecordKind; score: number } | null {
  const t = key(text);
  const scored = (Object.keys(KIND_KEYWORDS) as RecordKind[])
    .map((kind) => ({ kind, score: KIND_KEYWORDS[kind].filter((re) => re.test(t)).length }))
    .sort((a, b) => b.score - a.score);
  if (scored[0].score === 0 || scored[0].score === scored[1].score) return null;
  return scored[0];
}

// ---------- extraction ----------

/** Fields each record kind can carry; anything else found on the page is ignored. */
const KIND_FIELDS: Record<RecordKind, Set<Label["field"]>> = {
  SEVEN_TWELVE: new Set([
    "village",
    "taluka",
    "district",
    "survey_no",
    "gat_no",
    "hissa_no",
    "owners",
    "area",
    "land_class_raw",
    "other_rights",
    "date",
    "ferfar_no",
  ]),
  FERFAR: new Set([
    "village",
    "taluka",
    "district",
    "survey_no",
    "gat_no",
    "hissa_no",
    "ferfar_no",
    "date",
    "area",
    "from_parties",
    "to_parties",
    "deed_reg_no",
  ]),
  INDEX_II: new Set([
    "village",
    "taluka",
    "district",
    "survey_no",
    "gat_no",
    "hissa_no",
    "deed_reg_no",
    "date",
    "area",
    "from_parties",
    "to_parties",
  ]),
};
const MULTI = new Set<Label["field"]>(["owners", "other_rights", "from_parties", "to_parties"]);

/**
 * Extract the facts on one page. Single-valued fields keep their first, most confident reading.
 * Multi-valued fields (owners, other rights, parties) also take the following unlabelled lines.
 */
export function extractPage(kind: RecordKind, words: OcrWord[]): ExtractedFact[] {
  const lines = toLines(words);
  const allHits = findHits(lines);
  const hits = allHits.filter((h) => KIND_FIELDS[kind].has(h.label.field));
  // Lines that start a new labelled entry, of any kind, or carry a "label : value" separator.
  const labelled = new Set([
    ...allHits.map((x) => x.line),
    ...lines.flatMap((l, li) => (l.some((t) => isSep(t.k) || /[:：]$/.test(t.k)) ? [li] : [])),
  ]);
  const facts: ExtractedFact[] = [];
  const count = new Map<FactField, number>();
  const push = (field: FactField, value: string, toks: Tok[], conf = minConf(toks)) => {
    const v = value.trim();
    if (!v) return;
    if (!MULTI_OUT.has(field) && facts.some((f) => f.field === field)) return;
    if (facts.some((f) => f.field === field && f.value === v)) return;
    const position = count.get(field) ?? 0;
    count.set(field, position + 1);
    facts.push({ field, value: v, position, confidence: conf, box: unionBox(toks) });
  };

  hits.forEach((h, n) => {
    const line = lines[h.line];
    // The value runs to the next label on the same line.
    const next = hits[n + 1];
    const end = next && next.line === h.line ? next.start : line.length;
    const onLabelLine = line.slice(h.valueStart, end).filter((t) => !isSep(t.k));
    let valueToks = onLabelLine;
    const labelToks = line.slice(h.start, h.valueStart);
    // Multi-valued fields continue on following lines that carry no label; each line is its own entry
    // (owners are often listed one per line), and each entry keeps its own line as its source crop.
    const segments: Tok[][] = onLabelLine.length ? [onLabelLine] : [];
    if (MULTI.has(h.label.field)) {
      for (let li = h.line + 1; li < lines.length && !labelled.has(li); li++) {
        if (lines[li].length > 8 || segments.length >= 12) break; // a paragraph, not a list
        segments.push(lines[li]);
      }
      valueToks = segments.flat();
    }
    if (!valueToks.length) return;
    const all = [...labelToks, ...valueToks];
    const raw = valueToks.map((t) => t.t).join(" ");
    const each = (field: FactField, split: (s: string) => string[]) =>
      segments.forEach((seg, k) => {
        const src = k === 0 && onLabelLine.length ? [...labelToks, ...seg] : seg;
        for (const v of split(seg.map((t) => t.t).join(" "))) push(field, v, src);
      });
    switch (h.label.field) {
      case "owners":
        each("owner", splitNames);
        break;
      case "from_parties":
        each("from_party", splitNames);
        break;
      case "to_parties":
        each("to_party", splitNames);
        break;
      case "other_rights":
        each("other_right", (x) => x.split(";").map(clean).filter(Boolean));
        break;
      case "land_class_raw": {
        const c = parseLandClass(raw);
        if (c) push("land_class", c, all);
        break;
      }
      case "area": {
        const sqm = parseAreaSqm(raw);
        // Confidence from the label and the digits; an unclear unit word should not make the number look doubtful.
        const digits = valueToks.filter((t) => /\d/.test(t.k));
        if (sqm !== null) push("area", String(sqm), all, minConf([...labelToks, ...(digits.length ? digits : valueToks)]));
        break;
      }
      case "date": {
        const d = parseDate(raw);
        if (d) push("date", d, all);
        break;
      }
      case "village":
      case "taluka":
      case "district":
        // A place name is the first word or two before any other text ("माळेगाव", "मौजे माळेगाव बु.").
        push(
          h.label.field,
          clean(
            valueToks
              .slice(0, valueToks[1]?.k.endsWith(".") ? 2 : 1)
              .map((t) => t.t)
              .join(" "),
          ),
          [...labelToks, ...valueToks.slice(0, 2)],
        );
        break;
      default: {
        const num = firstNumberish(raw);
        if (num) push(h.label.field as FactField, num, all);
      }
    }
  });

  // Facts read from the whole page rather than a labelled field.
  const text = key(lines.map((l) => l.map((t) => t.t).join(" ")).join("\n"));
  if (kind === "FERFAR") {
    const type = MUTATION_TYPES.find(([re]) => re.test(text));
    if (type) push("mutation_type", type[1], lines.flat(), 0.7);
    // Heirship entries are prose: "मयत सुरेश जाधव यांचे वारस अनिल जाधव, सुनील जाधव".
    const li = lines.findIndex((l) => l.some((t) => t.k === "मयत"));
    if (li >= 0 && !facts.some((f) => f.field === "from_party")) {
      const labelled = new Set(findHits(lines).map((x) => x.line));
      let toks = lines[li];
      for (let j = li + 1; j < lines.length && !labelled.has(j) && toks.length < 40; j++) toks = [...toks, ...lines[j]];
      const prose = clean(toks.map((t) => t.t).join(" "));
      const m = prose.match(/मयत\s+(.+?)\s+(?:यांचे|यांच्या|याचे|हिचे)\s+वारस(?:\s+म्हणून)?\s*[:-]?\s*(.+?)(?:\s+(?:यांची|यांच्या|यांचे)\s+नावे|$)/);
      if (m) {
        push("from_party", m[1], toks);
        for (const name of splitNames(m[2])) push("to_party", name, toks);
      }
    }
    if (/कलम\s*155/.test(text)) {
      const line = lines.find((l) => /कलम/.test(l.map((t) => t.k).join(" ")));
      push("section_155", "true", line ?? lines.flat());
    }
  }
  // Inferred page-wide facts carry no crop (the whole page is their source).
  for (const f of facts) if (f.field === "mutation_type") f.box = null;
  return facts;
}
const MULTI_OUT = new Set<FactField>(["owner", "other_right", "from_party", "to_party"]);

/** Extract from a document's pages, in page order; single-valued fields keep their first reading. */
export function extractDocument(kind: RecordKind, pages: { pageId: string; words: OcrWord[] }[]): (ExtractedFact & { pageId: string })[] {
  const out: (ExtractedFact & { pageId: string })[] = [];
  for (const p of pages) {
    for (const f of extractPage(kind, p.words)) {
      const same = out.filter((o) => o.field === f.field);
      if (!MULTI_OUT.has(f.field) && same.length) continue;
      if (same.some((o) => o.value === f.value)) continue;
      out.push({ ...f, position: same.length, pageId: p.pageId });
    }
  }
  return out;
}
