// Generates test/fixtures/satbara.png: a synthetic 7/12-style extract in Marathi + English.
// Run once (needs a Devanagari font installed, e.g. fonts-noto-core): node test/make-fixture.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const lines = [
  "गाव नमुना सात",
  "गाव : माळेगाव   तालुका : बारामती   जिल्हा : पुणे",
  "गट क्रमांक : 112",
  "भोगवटादाराचे नाव : सुरेश जाधव",
  "क्षेत्र : 0.81 हेक्टर",
  "इतर हक्क : बँक ऑफ महाराष्ट्र बोजा",
  "Ferfar No. 456",
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
  <rect width="100%" height="100%" fill="white"/>
  ${lines.map((l, i) => `<text x="80" y="${130 + i * 120}" font-family="Noto Sans Devanagari" font-size="52" fill="black">${l}</text>`).join("")}
</svg>`;
mkdirSync(new URL("./fixtures", import.meta.url), { recursive: true });
await sharp(Buffer.from(svg))
  .png()
  .toFile(new URL("./fixtures/satbara.png", import.meta.url).pathname);
console.log("wrote test/fixtures/satbara.png");
