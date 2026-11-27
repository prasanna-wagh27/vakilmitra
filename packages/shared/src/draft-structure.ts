/**
 * Does a court filing have the parts the Code of Civil Procedure asks for? A plain check of the
 * draft's words, in Marathi or English, run as the advocate edits: no AI, nothing leaves the
 * screen. It finds headings and the usual wording, so it can miss a part written in other words,
 * and finding a word is not the part being right: the advocate reads it as a reminder list.
 */
import type { DraftKind } from "./index.js";

export type DraftPartKey =
  | "court"
  | "suitNo"
  | "parties"
  | "causeOfAction"
  | "jurisdiction"
  | "limitation"
  | "valuation"
  | "noOtherSuit"
  | "addressForService"
  | "preliminary"
  | "paraWise"
  | "denial"
  | "ownVersion"
  | "deponent"
  | "relief"
  | "dismissal"
  | "verification"
  | "affidavit"
  | "documents"
  | "signature"
  | "identification";

export interface DraftPart {
  key: DraftPartKey;
  /** Where the requirement comes from, as advocates cite it. Null for settled practice. */
  rule: string | null;
  /** Required by the Code, or usual practice in Maharashtra courts. */
  need: "required" | "usual";
  /** Each pattern must be found (an English or a Marathi wording in each). */
  all: RegExp[];
}

// "वादी" (plaintiff) is also the end of "प्रतिवादी" (defendant).
const PLAINTIFF = /plaintiff|(?<!प्रति)वादी/i;
const DEFENDANT = /defendant|प्रतिवादी/i;
const COURT = /in the court of|before the hon|court of the|न्यायालयात|न्यायाधीश|न्यायालय,/i;
const VERIFICATION = /verification|verified|सत्यापन|पडताळणी/i;
const AFFIDAVIT = /affidavit|प्रतिज्ञापत्र|शपथपत्र/i;
const DOCUMENTS = /list of documents|documents? list|(कागदपत्र|दस्तऐवज)[^\n]{0,20}यादी/i;
const PLACE = /place|ठिकाण/i;
const DATE = /date|दिनांक|दि\./i;
const ADVOCATE = /advocate|counsel|वकील|अ‍ॅड|ॲड|अॅड/i;

const part = (key: DraftPartKey, rule: string | null, need: DraftPart["need"], ...all: RegExp[]): DraftPart => ({
  key,
  rule,
  need,
  all,
});

/** The parts of each court filing. Notices and other drafts have none to check. */
export const DRAFT_PARTS: Partial<Record<DraftKind, DraftPart[]>> = {
  PLAINT: [
    part("court", "O. VII r. 1(a)", "required", COURT),
    part("parties", "O. VII r. 1(b), (c)", "required", PLAINTIFF, DEFENDANT),
    part("causeOfAction", "O. VII r. 1(e)", "required", /cause of action|दाव्यास कारण|दाव्याचे कारण|कारण घडले/i),
    part("jurisdiction", "O. VII r. 1(f)", "required", /jurisdiction|अधिकारक्षेत्र|अधिकार क्षेत्र|कार्यक्षेत्र/i),
    part("limitation", null, "usual", /limitation|within time|मुदत/i),
    part("valuation", "O. VII r. 1(i)", "required", /valu(ed|ation)|court[- ]?fee|मूल्यांकन|कोर्ट[- ]?फी|न्यायालय शुल्क/i),
    part("relief", "O. VII r. 1(g)", "required", /pray|relief|विनंती|मागणी|दाद/i),
    part(
      "noOtherSuit",
      null,
      "usual",
      /no (other|previous|earlier) suit|not filed any (other|previous|earlier)|यापूर्वी[^\n]{0,60}दावा|दुसरा[^\n]{0,20}दावा/i,
    ),
    part("addressForService", "O. VI r. 14A", "usual", /address for service|बजावण्याचा पत्ता|नोटिशीचा पत्ता|पत्रव्यवहाराचा पत्ता/i),
    part("documents", "O. VII r. 14", "required", DOCUMENTS),
    part("signature", "O. VI r. 14", "required", PLACE, DATE, ADVOCATE),
    part("verification", "O. VI r. 15", "required", VERIFICATION),
    part("affidavit", "O. VI r. 15(4)", "required", AFFIDAVIT),
  ],
  WRITTEN_STATEMENT: [
    part("court", null, "required", COURT),
    part("suitNo", null, "required", /suit no|r\.\s?c\.\s?s\.|s\.\s?c\.\s?s\.|civil suit|दावा क्र|दावा नं/i),
    part("parties", null, "required", PLAINTIFF, DEFENDANT),
    part(
      "preliminary",
      null,
      "usual",
      /preliminary objection|not maintainable|barred by|प्राथमिक (आक्षेप|मुद्दे|हरकत)|चालण्यास पात्र नाही|चालण्याजोगा नाही|बाधित/i,
    ),
    part("paraWise", "O. VIII r. 3", "required", /para(graph)?s?\s*(no\.?\s*)?\d|para-?wise|paragraph-?wise|परिच्छेद|पॅरा/i),
    part("denial", "O. VIII r. 5", "required", /\bden(y|ies|ied)\b|not admitted|नाकबूल|अमान्य|नाकारत|कबूल नाही|मान्य नाही/i),
    part("ownVersion", null, "usual", /true facts|real facts|actual facts|खरी (वस्तुस्थिती|हकीकत)|वस्तुस्थिती/i),
    part("dismissal", null, "required", /dismiss|खारीज|फेटाळ/i),
    part("documents", "O. VIII r. 1A", "required", DOCUMENTS),
    part("signature", "O. VI r. 14", "required", PLACE, DATE, ADVOCATE),
    part("verification", "O. VI r. 15", "required", VERIFICATION),
    part("affidavit", "O. VI r. 15(4)", "required", AFFIDAVIT),
  ],
  AFFIDAVIT: [
    part("deponent", null, "required", /aged|age about|deponent|वय|अभिसाक्षी/i),
    part("verification", null, "required", /solemn|affirm|on oath|true to (my|the best)|सत्य प्रतिज्ञेवर|शपथेवर|प्रतिज्ञापूर्वक|खरे (व|आणि) बरोबर/i),
    part("signature", null, "required", PLACE, DATE),
    part("identification", null, "usual", /identif|ओळख/i),
  ],
  APPLICATION: [
    part("court", null, "required", COURT),
    part("relief", null, "required", /pray|विनंती|मागणी/i),
    part("signature", null, "required", PLACE, DATE, ADVOCATE),
    part("affidavit", null, "usual", AFFIDAVIT),
  ],
};

export interface DraftPartCheck extends Omit<DraftPart, "all"> {
  found: boolean;
}

/** Blanks left to fill: the [placeholders] a form or a draft leaves for missing facts. */
export const BLANK = /\[[^\]\n]{0,80}\]/g;

/** The parts of a court filing, each marked found or not; null for drafts with no parts to check. */
export function checkDraftParts(kind: DraftKind, body: string): { parts: DraftPartCheck[]; blanks: number } | null {
  const parts = DRAFT_PARTS[kind];
  if (!parts) return null;
  // Blanks are not the part written: "[cause of action]" alone does not count.
  const text = body.replace(BLANK, " ");
  return {
    parts: parts.map(({ all, ...p }) => ({ ...p, found: all.every((re) => re.test(text)) })),
    blanks: body.match(BLANK)?.length ?? 0,
  };
}
