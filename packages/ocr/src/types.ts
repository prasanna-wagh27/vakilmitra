export interface OcrWord {
  /** text (a word for Tesseract; a line for engines that only report lines) */
  t: string;
  /** confidence 0..1 */
  c: number;
  /** box as fractions of page width/height: [x0, y0, x1, y1] */
  b: [number, number, number, number];
}

export interface OcrResult {
  engine: string;
  text: string;
  /** Mean confidence 0..1, or null when the engine does not report one. */
  confidence: number | null;
  words: OcrWord[];
  width: number;
  height: number;
}

/** What the page is, if known: lets engines that support it pick a handwriting model. */
export interface OcrHints {
  contentType?: "printed" | "handwritten" | "mixed";
}

export interface OcrEngine {
  readonly name: string;
  /** True when the page image is sent outside our servers (needs the advocate's consent). */
  readonly external: boolean;
  recognize(image: Buffer, hints?: OcrHints): Promise<OcrResult>;
  close(): Promise<void>;
}

export const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
