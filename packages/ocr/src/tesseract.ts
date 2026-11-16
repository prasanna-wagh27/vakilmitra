/**
 * Tesseract (Marathi + English) running on our own servers. Free, and no page image leaves our
 * infrastructure. Strong on clean print, weak on handwriting: see eval/ for the comparison.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createScheduler, createWorker, OEM, type Scheduler } from "tesseract.js";
import { type OcrEngine, type OcrResult, type OcrWord, round4 } from "./types.js";

/** Longest side after preprocessing. Enough for small Devanagari matras, small enough to be fast. */
const MAX_SIDE = 2400;

/** EXIF-rotate, cap size, grayscale and stretch contrast. Returns PNG for the engine. */
export async function preprocess(image: Buffer) {
  const { data, info } = await sharp(image, { failOn: "error" })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

/** Put both language files in one folder, since Tesseract takes a single language path. */
async function stageLanguageData(langs: string[]): Promise<string> {
  const require = createRequire(import.meta.url);
  const dir = join(tmpdir(), "vakilmitra-tessdata");
  await mkdir(dir, { recursive: true });
  for (const lang of langs) {
    const pkgDir = join(require.resolve(`@tesseract.js-data/${lang}/package.json`), "..");
    const src = join(pkgDir, "4.0.0_best_int", `${lang}.traineddata.gz`);
    const dest = join(dir, `${lang}.traineddata.gz`);
    const exists = await stat(dest).then(
      (s) => s.size > 0,
      () => false,
    );
    if (!exists) await copyFile(src, dest);
  }
  return dir;
}

export class TesseractEngine implements OcrEngine {
  readonly name: string;
  readonly external = false;
  private pool: Promise<Scheduler> | null = null;

  /** `workers` recognisers run in parallel (one per CPU core is a sensible ceiling). */
  constructor(
    private langs: string[] = ["mar", "eng"],
    private workers = 1,
  ) {
    this.name = `tesseract-${langs.join("+")}`;
  }

  private getPool() {
    if (!this.pool) {
      const starting = (async () => {
        const langPath = await stageLanguageData(this.langs);
        const scheduler = createScheduler();
        for (let i = 0; i < Math.max(1, this.workers); i++) {
          const w = await createWorker(this.langs, OEM.LSTM_ONLY, { langPath, gzip: true, cacheMethod: "none" });
          await w.setParameters({ preserve_interword_spaces: "1" });
          scheduler.addWorker(w);
        }
        return scheduler;
      })();
      // A failed start must not stick: the next page tries again instead of failing forever.
      starting.catch(() => {
        if (this.pool === starting) this.pool = null;
      });
      this.pool = starting;
    }
    return this.pool;
  }

  async recognize(image: Buffer): Promise<OcrResult> {
    const { png, width, height } = await preprocess(image);
    const pool = await this.getPool();
    // rotateAuto straightens slightly skewed phone photos before reading.
    const { data } = await pool.addJob("recognize", png, { rotateAuto: true }, { text: true, blocks: true });
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          for (const w of line.words) {
            const t = w.text.normalize("NFC").trim();
            if (!t) continue;
            words.push({
              t,
              c: round4(w.confidence / 100),
              b: [round4(w.bbox.x0 / width), round4(w.bbox.y0 / height), round4(w.bbox.x1 / width), round4(w.bbox.y1 / height)],
            });
          }
        }
      }
    }
    return {
      engine: this.name,
      text: data.text
        .normalize("NFC")
        .replace(/[ \t]+\n/g, "\n")
        .trim(),
      confidence: round4((data.confidence ?? 0) / 100),
      words,
      width,
      height,
    };
  }

  async close() {
    const pool = this.pool;
    this.pool = null;
    if (pool) await (await pool).terminate();
  }
}
