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

/** Upright, size-capped JPEG for sending to an engine (EXIF orientation applied, metadata dropped). */
export async function toJpeg(image: Buffer, maxSide: number, quality = 90) {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(image, { failOn: "error" })
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}
