/**
 * Gemini through the Vercel AI SDK, asked for a verbatim line-by-line transcription as
 * structured output (Zod), with a box and a legibility rating per line.
 *
 * Default provider is Vertex AI in Mumbai (asia-south1): paid terms, data stays in India.
 * The consumer Gemini API is only for evaluation, never for client files: its free tier may
 * use inputs for training.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { generateText, type LanguageModel, Output } from "ai";
import sharp from "sharp";
import { z } from "zod";
import { type OcrEngine, type OcrHints, type OcrResult, type OcrWord, round4 } from "./types.js";

export type GeminiConfig =
  | { provider: "vertex"; model?: string; project: string; location?: string }
  | { provider: "google"; model?: string; apiKey: string }
  | { provider: "custom"; model: LanguageModel; name: string };

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

/** Self-reported legibility mapped to a confidence. It is the model's judgement, not a measured probability. */
const LEGIBILITY_CONFIDENCE = { clear: 0.95, unclear: 0.6, illegible: 0.2 } as const;

export const transcriptionSchema = z.object({
  lines: z.array(
    z.object({
      text: z.string().describe("The line exactly as written, with [?] for any unreadable word"),
      box_2d: z.array(z.number()).length(4).describe("[ymin, xmin, ymax, xmax] of the line on a 0-1000 scale"),
      legibility: z.enum(["clear", "unclear", "illegible"]),
    }),
  ),
});

export const TRANSCRIBE_PROMPT = `You are transcribing one page of a Maharashtra land or court record (for example a 7/12 extract, Ferfar entry, 8A, Index-II or a deed). Advocates rely on this text, so accuracy matters more than completeness.

Rules:
- Transcribe exactly what is written, in reading order, one entry per line of the page.
- Keep Marathi in Devanagari and English in Latin script. Keep every digit exactly as written (Devanagari ० to ९ or 0 to 9). Keep names, numbers, dates, units and abbreviations exactly as they appear.
- Do not translate, correct spelling, expand abbreviations, summarise, or add anything that is not on the page.
- If a word cannot be read, write [?] in its place. If it is partly readable, write the readable part followed by [?]. Never guess a name or a number.
- For tables, transcribe row by row, separating cells with " | ".
- Include stamps, handwritten notes and margin entries as their own lines where they appear.
- For each line give its bounding box as [ymin, xmin, ymax, xmax] on a 0-1000 scale, and rate its legibility: clear, unclear or illegible.`;

export class GeminiEngine implements OcrEngine {
  readonly name: string;
  readonly external = true;
  private model: LanguageModel;

  constructor(cfg: GeminiConfig) {
    if (cfg.provider === "custom") {
      this.model = cfg.model;
      this.name = cfg.name;
      return;
    }
    const id = cfg.model ?? DEFAULT_GEMINI_MODEL;
    if (cfg.provider === "vertex") {
      this.model = createVertex({ project: cfg.project, location: cfg.location ?? "asia-south1" })(id);
      this.name = `gemini-vertex:${id}`;
    } else {
      this.model = createGoogleGenerativeAI({ apiKey: cfg.apiKey })(id);
      this.name = `gemini-api:${id}`;
    }
  }

  async recognize(image: Buffer, _hints?: OcrHints): Promise<OcrResult> {
    // Colour kept: stamps and coloured ink help the model tell entries apart.
    const { data: jpeg, info } = await sharp(image, { failOn: "error" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });

    const { output } = await generateText({
      model: this.model,
      output: Output.object({ schema: transcriptionSchema }),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TRANSCRIBE_PROMPT },
            { type: "image", image: new Uint8Array(jpeg), mediaType: "image/jpeg" },
          ],
        },
      ],
    });
    const lines = output?.lines ?? [];
    const clamp = (n: number) => Math.min(1, Math.max(0, n / 1000));
    const words: OcrWord[] = lines
      .filter((l) => l.text.trim())
      .map((l) => {
        const [y0, x0, y1, x1] = l.box_2d;
        const c = l.text.includes("[?]") ? Math.min(LEGIBILITY_CONFIDENCE[l.legibility], 0.6) : LEGIBILITY_CONFIDENCE[l.legibility];
        return { t: l.text.normalize("NFC").trim(), c, b: [round4(clamp(x0)), round4(clamp(y0)), round4(clamp(x1)), round4(clamp(y1))] };
      });
    const text = words.map((w) => w.t).join("\n");
    const confidence = words.length ? round4(words.reduce((s, w) => s + w.c, 0) / words.length) : 0;
    return { engine: this.name, text, confidence, words, width: info.width, height: info.height };
  }

  async close() {}
}
