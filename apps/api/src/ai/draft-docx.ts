/**
 * A draft as a Word file: one paragraph per line, in fonts that ship with Windows and Office
 * (Calibri for Latin text, Nirmala UI for Devanagari), on A4 with court-filing margins.
 */
import type { Locale } from "@vakilmitra/shared";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";

const FONT = { ascii: "Calibri", hAnsi: "Calibri", cs: "Nirmala UI", eastAsia: "Nirmala UI" };
const CM = 567; // twips per centimetre

/** A short line in capitals or ending in a colon reads as a heading and is centred in bold. */
const isHeading = (line: string) => {
  const t = line.trim();
  return (
    t.length > 0 &&
    t.length <= 60 &&
    !/^\d+[.)]/.test(t) &&
    ((t === t.toUpperCase() && /[A-Z]/.test(t)) || /^(जाहीर नोटीस|नोटीस|प्रतिज्ञापत्र|अर्ज|उत्तर)$/.test(t))
  );
};

export async function draftDocx(title: string, body: string, language: Locale): Promise<Buffer> {
  const paragraphs = body.split("\n").map((line) => {
    const heading = isHeading(line);
    return new Paragraph({
      children: [new TextRun({ text: line, font: FONT, size: 24, bold: heading })],
      alignment: heading ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { after: line.trim() ? 120 : 0, line: 300 },
    });
  });
  const doc = new Document({
    title,
    creator: "VakilMitra",
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 2.5 * CM, bottom: 2.5 * CM, left: 4 * CM, right: 2.5 * CM },
          },
        },
        children: paragraphs,
      },
    ],
  });
  void language;
  return Packer.toBuffer(doc);
}
