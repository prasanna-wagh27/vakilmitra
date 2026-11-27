/**
 * Old to new criminal law sections: which section of the Bharatiya Nyaya Sanhita (BNS), the
 * Bharatiya Nagarik Suraksha Sanhita (BNSS) and the Bharatiya Sakshya Adhiniyam (BSA), in force
 * from 1 July 2024, took the place of which section of the IPC, the CrPC and the Indian Evidence Act.
 *
 * data.json is built by scripts/law-codes/build.py from the correspondence tables of the Central
 * Academy for Police Training, Bhopal. Headings are the Acts' own (English) words.
 * A separate entry point (@vakilmitra/shared/law-codes) so the table loads only where it is used.
 */
import data from "./data.json" with { type: "json" };

export const LAW_CODES = ["bns", "bnss", "bsa"] as const;
export type LawCode = (typeof LAW_CODES)[number];

export interface LawSection {
  /** The new section, e.g. "103(1)", "2(1)(a)", "Proviso to section 23". */
  section: string;
  /** Its heading, as in the Act. */
  title: string;
  /** The old section(s) as the table gives them, e.g. "29 and 29A"; null for a new provision. */
  old: string | null;
  /** Each old section number named, for searching: "230 to 232" gives 230, 231, 232. */
  oldSections: string[];
}

export const LAW_TABLES = data as Record<LawCode, LawSection[]>;

/** Short names: the new code and the code it replaced. */
export const LAW_NAMES: Record<LawCode, { short: string; oldShort: string }> = {
  bns: { short: "BNS", oldShort: "IPC" },
  bnss: { short: "BNSS", oldShort: "CrPC" },
  bsa: { short: "BSA", oldShort: "IEA" },
};

export interface LawMatch {
  code: LawCode;
  row: LawSection;
  /** What matched: the old section number, the new one, or words in the heading. */
  by: "old" | "new" | "title";
}

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Names people put before a section number, and which code and side each points to. */
const CODE_WORDS: [RegExp, LawCode, "old" | "new"][] = [
  [/\bbnss\b/i, "bnss", "new"],
  [/\bbns\b/i, "bns", "new"],
  [/\bbsa\b/i, "bsa", "new"],
  [/\bipc\b|\bi\.p\.c\.?|भा\.?\s?दं\.?\s?वि/i, "bns", "old"],
  [/\bcr\.?\s?p\.?\s?c\b|\bcrpc\b|फौ\.?\s?प्र\.?\s?सं/i, "bnss", "old"],
  [/\biea\b|\bevidence\b|पुरावा/i, "bsa", "old"],
];

/** "103(1)" → "103"; "Proviso to section 23" → "23". */
export function sectionBase(section: string): string {
  const m = /^(\d+[A-Z]*)/.exec(section) ?? /section\s+(\d+[A-Z]*)/i.exec(section);
  return m ? m[1] : section;
}

/**
 * Find sections by number or by words. "420" finds IPC 420 (and BNS 420 if there were one),
 * "IPC 420" or "भादंवि ४२०" only the old IPC section, "BNSS 173" only the new one, and a word
 * like "cheating" searches the headings. Devanagari digits are read as numbers.
 */
export function searchLawCodes(query: string, only?: LawCode): LawMatch[] {
  let q = query.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d))).trim();
  if (!q) return [];
  let codes: readonly LawCode[] = only ? [only] : LAW_CODES;
  let side: "old" | "new" | null = null;
  for (const [re, code, s] of CODE_WORDS) {
    if (re.test(q)) {
      if (!only || only === code) codes = [code];
      side = s;
      q = q.replace(re, " ");
      break;
    }
  }
  q = q.replace(/\b(u\/s|sec(tion)?s?|s\.)\b|कलम/gi, " ").trim();

  const num = /^(\d{1,3})\s*([A-Za-z]{0,2})\b/.exec(q);
  if (num) {
    const key = num[1] + num[2].toUpperCase();
    const out: LawMatch[] = [];
    for (const code of codes) {
      const rows = LAW_TABLES[code];
      if (side !== "new") for (const row of rows) if (row.oldSections.includes(key)) out.push({ code, row, by: "old" });
      if (side !== "old") for (const row of rows) if (sectionBase(row.section) === key) out.push({ code, row, by: "new" });
    }
    return out;
  }
  if (q.length < 3) return [];
  const words = q.toLowerCase().split(/\s+/);
  const out: LawMatch[] = [];
  for (const code of codes) {
    for (const row of LAW_TABLES[code]) {
      const title = row.title.toLowerCase();
      if (words.every((w) => title.includes(w))) out.push({ code, row, by: "title" });
    }
  }
  return out;
}
