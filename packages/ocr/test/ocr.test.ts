import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { preprocess, TesseractEngine } from "../src/index.js";

const fixture = await readFile(new URL("./fixtures/satbara.png", import.meta.url));
const engine = new TesseractEngine();
afterAll(() => engine.close());

/** Key tokens a 7/12 reader must get; checked as substrings to tolerate spacing. */
const KEY_TOKENS = ["माळेगाव", "बारामती", "पुणे", "112", "जाधव", "456"];

/** Simulate a phone photo: slight skew, off-white paper, JPEG. */
async function phonePhoto(png: Buffer) {
  return sharp(png).rotate(2.5, { background: "#f2efe6" }).flatten({ background: "#f2efe6" }).jpeg({ quality: 70 }).toBuffer();
}

describe("preprocess", () => {
  it("caps size and keeps orientation", async () => {
    const big = await sharp(fixture).resize(4800).toBuffer();
    const { width, height } = await preprocess(big);
    expect(Math.max(width, height)).toBeLessThanOrEqual(2400);
    expect(width).toBeGreaterThan(height);
  });

  it("rejects something that is not an image", async () => {
    await expect(preprocess(Buffer.from("not an image"))).rejects.toThrow();
  });
});

describe("TesseractEngine (Marathi + English)", () => {
  it("reads a clean extract with word boxes inside the page", async () => {
    const r = await engine.recognize(fixture);
    for (const token of KEY_TOKENS) expect(r.text).toContain(token);
    expect(r.engine).toBe("tesseract-mar+eng");
    expect(r.confidence).toBeGreaterThan(0.7);
    expect(r.words.length).toBeGreaterThan(20);
    for (const w of r.words) {
      expect(w.b[0]).toBeGreaterThanOrEqual(0);
      expect(w.b[2]).toBeLessThanOrEqual(1);
      expect(w.b[0]).toBeLessThan(w.b[2]);
      expect(w.b[1]).toBeLessThan(w.b[3]);
    }
    const jadhav = r.words.find((w) => w.t.includes("जाधव"));
    expect(jadhav).toBeDefined();
    // "सुरेश जाधव" is on the 4th of 7 lines, so its box sits in the middle of the page.
    expect(jadhav!.b[1]).toBeGreaterThan(0.35);
    expect(jadhav!.b[3]).toBeLessThan(0.6);
  }, 60_000);

  it("still reads a skewed, JPEG-compressed phone photo", async () => {
    const r = await engine.recognize(await phonePhoto(fixture));
    const found = KEY_TOKENS.filter((t) => r.text.includes(t));
    expect(found.length).toBeGreaterThanOrEqual(KEY_TOKENS.length - 1);
  }, 60_000);
});
