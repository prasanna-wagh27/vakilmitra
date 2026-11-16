/**
 * Compare OCR engines on a labelled set of pages.
 *
 *   pnpm --filter @vakilmitra/ocr eval --data ../../eval-data --engines tesseract,sarvam,gemini
 *
 * Real client pages belong in /eval-data at the repo root, which git ignores: never commit them.
 * Cloud engines read their keys from the environment (see packages/ocr/.env.example).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createEngine, ENGINE_NAMES, ocrEnv } from "../src/index.js";
import { loadCases, renderMarkdown, runEngine, summarize } from "./harness.js";

const { values } = parseArgs({
  // pnpm 10 passes a literal "--" through; tolerate it (and nothing else) as a positional.
  allowPositionals: true,
  options: {
    data: { type: "string", default: new URL("./sample", import.meta.url).pathname },
    engines: { type: "string", default: "tesseract" },
    out: { type: "string", default: new URL("./out", import.meta.url).pathname },
  },
});

const env = ocrEnv(process.env);
const names = values.engines!.split(",").map((s) => s.trim());
const unknown = names.filter((n) => !(ENGINE_NAMES as readonly string[]).includes(n));
if (unknown.length) {
  // Fail before touching any page: a typo must never route pages to an unintended provider.
  console.error(`Unknown engine(s): ${unknown.join(", ")}. Use: ${ENGINE_NAMES.join(", ")}`);
  process.exit(1);
}
const cases = await loadCases(resolve(values.data!));
if (cases.length === 0) {
  console.error(`No labelled pages in ${values.data}. Each page needs a folder with page.jpg|png and truth.txt.`);
  process.exit(1);
}
console.log(`${cases.length} pages from ${values.data}`);

const runs = [];
for (const name of names) {
  const engine = createEngine(name, env);
  if (engine.external) console.log(`  ${engine.name} sends page images to an external provider.`);
  const run = await runEngine(engine, cases, (r) =>
    console.log(`  ${engine.name} ${r.id}: CER ${(r.cer * 100).toFixed(1)}%${r.error ? ` ERROR ${r.error}` : ""}`),
  );
  await engine.close();
  runs.push(run);
}

const summaries = runs.map(summarize);
const date = new Date().toISOString().slice(0, 19).replace("T", " ");
const outDir = resolve(values.out!);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "report.md"), renderMarkdown(summaries, runs, { dataset: values.data!, date }));
await writeFile(join(outDir, "report.json"), JSON.stringify({ date, dataset: values.data, summaries, runs }, null, 2));
for (const run of runs) {
  const dir = join(outDir, run.engine.replace(/[^\w.-]+/g, "_"));
  await mkdir(dir, { recursive: true });
  for (const r of run.results) await writeFile(join(dir, `${r.id}.txt`), r.text);
}
console.log(`\nReport: ${join(outDir, "report.md")}`);
