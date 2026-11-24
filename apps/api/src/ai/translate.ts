/**
 * Translating a page's OCR text between Marathi and English for court and client use.
 * The model gets the text only (no names of the advocate, case or client beyond what is on the page).
 */
import { generateText, type LanguageModel } from "@vakilmitra/ai";
import type { Locale } from "@vakilmitra/shared";

/** Longest page text sent in one call; a page of a 7/12 or a deed is far below this. */
export const MAX_TRANSLATE_CHARS = 20_000;

const NAME: Record<Locale, string> = { mr: "Marathi (मराठी, Devanagari script)", en: "English" };

export function translationPrompt(to: Locale) {
  return [
    `You translate Indian legal and land-revenue documents from Maharashtra into ${NAME[to]}.`,
    "The text was read from a scanned page by OCR, so it may contain reading errors and broken lines.",
    "Rules:",
    "- Translate faithfully and completely. Do not summarise, explain, add headings or comment.",
    "- Keep the page's structure: one output line for each input line, and keep table rows and columns in order (separate cells with ' | ').",
    "- Copy every number exactly as written: survey, gat, hissa, ferfar and khata numbers, areas, dates, amounts, registration numbers. Do not convert units or calendars.",
    to === "en"
      ? "- Write names of people and places in English letters as they sound (for example शंकर पाटील → Shankar Patil). Translate land-record terms with the Marathi term in brackets the first time, for example 'mutation (ferfar)', 'occupant class (bhogvatadar varg)'."
      : "- Keep names of people and places as they are known in Marathi. Use the standard Marathi terms of the revenue and court records (फेरफार, भोगवटादार, ७/१२ उतारा).",
    "- Where the text is unreadable or garbled, write [unclear] and continue. Never guess a number or a name.",
    "- Leave anything already in the target language as it is.",
    "Answer with the translation only.",
  ].join("\n");
}

export async function translateText(model: LanguageModel, text: string, to: Locale) {
  const r = await generateText({
    model,
    system: translationPrompt(to),
    prompt: text,
    maxOutputTokens: 16_000,
    maxRetries: 1,
  });
  return { value: r.text.trim(), usage: r.usage };
}
