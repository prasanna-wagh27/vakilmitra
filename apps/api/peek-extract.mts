import { readFile } from "node:fs/promises";
import { TesseractEngine } from "../../packages/ocr/dist/index.js";
import { classifyText, extractPage } from "./src/land/extract.ts";
const e = new TesseractEngine();
for (const f of process.argv.slice(2)) {
  const r = await e.recognize(await readFile(f));
  const c = classifyText(r.text);
  console.log("==", f, c);
  if (c) for (const x of extractPage(c.kind, r.words)) console.log(" ", x.field, "=", JSON.stringify(x.value), x.confidence, x.box?.map((n) => n.toFixed(2)).join(","));
}
await e.close();
