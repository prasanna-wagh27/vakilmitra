// Generates eval/sample/: synthetic pages for testing the harness (not a measure of real accuracy).
// Needs a Devanagari font (e.g. apt install fonts-noto-core). Run: node eval/make-sample.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function render(lines, { size = 52, width = 1600 } = {}) {
  const h = 120 + lines.length * size * 2.3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"><rect width="100%" height="100%" fill="white"/>${lines
    .map(
      (l, i) =>
        `<text x="80" y="${100 + i * size * 2.3}" font-family="Noto Sans Devanagari" font-size="${size}" fill="black">${esc(l)}</text>`,
    )
    .join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const satbara = [
  "गाव नमुना सात",
  "गाव : माळेगाव   तालुका : बारामती   जिल्हा : पुणे",
  "गट क्रमांक : 112",
  "भोगवटादाराचे नाव : सुरेश जाधव",
  "क्षेत्र : 0.81 हेक्टर",
  "इतर हक्क : बँक ऑफ महाराष्ट्र बोजा",
  "Ferfar No. 456",
];
const satbaraFields = {
  village: "माळेगाव",
  taluka: "बारामती",
  district: "पुणे",
  gat_no: "112",
  owners: ["सुरेश जाधव"],
  area: "0.81",
  ferfar_no: "456",
};
const ferfar = [
  "फेरफार नोंद क्रमांक : १२९०",
  "दिनांक : ०२/०४/२०१९",
  "गाव : माळेगाव   तालुका : बारामती",
  "गट क्रमांक : ११२",
  "कलम १५५ अन्वये दुरुस्ती",
  "क्षेत्र ०.८१ हेक्टर ऐवजी ०.९३ हेक्टर असे वाचावे",
  "मंडळ अधिकारी, माळेगाव",
];
const index2 = [
  "सूची क्र. २",
  "दस्त क्रमांक : १२३४/२००१",
  "गावाचे नाव : माळेगाव",
  "लिहून देणार : रामचंद्र पाटील",
  "लिहून घेणार : सुरेश जाधव",
  "मोबदला : रु. ३,५०,०००",
];

const cases = {
  "satbara-clean": { lines: satbara, fields: satbaraFields, image: async () => render(satbara), ext: "png" },
  "satbara-phone": {
    lines: satbara,
    fields: satbaraFields,
    ext: "jpg",
    image: async () =>
      sharp(await render(satbara))
        .rotate(-3, { background: "#efe9dc" })
        .flatten({ background: "#efe9dc" })
        .jpeg({ quality: 65 })
        .toBuffer(),
  },
  "ferfar-degraded": {
    lines: ferfar,
    fields: { ferfar_no: "1290", ferfar_date: "02/04/2019", village: "माळेगाव", taluka: "बारामती", gat_no: "112", area: "0.81" },
    ext: "jpg",
    image: async () =>
      sharp(await render(ferfar))
        .blur(1.1)
        .linear(0.55, 95)
        .jpeg({ quality: 45 })
        .toBuffer(),
  },
  "index2-small": {
    lines: index2,
    fields: { village: "माळेगाव", owners: ["रामचंद्र पाटील", "सुरेश जाधव"] },
    ext: "png",
    image: async () => render(index2, { size: 30, width: 1000 }),
  },
};

for (const [id, c] of Object.entries(cases)) {
  const dir = new URL(`./sample/${id}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL(`page.${c.ext}`, dir), await c.image());
  writeFileSync(new URL("truth.txt", dir), `${c.lines.join("\n")}\n`);
  writeFileSync(new URL("fields.json", dir), `${JSON.stringify(c.fields, null, 2)}\n`);
  writeFileSync(
    new URL("meta.json", dir),
    `${JSON.stringify({ script: "printed", source: "synthetic", doc_type: id.split("-")[0] }, null, 2)}\n`,
  );
}
console.log("wrote eval/sample/");
