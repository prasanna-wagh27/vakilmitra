/**
 * Builds the land-record extraction eval set: synthetic 7/12, Ferfar and Index-II pages with known
 * fields, rendered in varied layouts, degraded like phone photos, then read by the real Tesseract
 * engine. The OCR output (words + boxes) is saved with the truth, so CI can score extraction
 * without running OCR. Synthetic pages measure the extractor against OCR noise; they are not a
 * measure of accuracy on real government records (see eval/README.md).
 *
 * Run from apps/api (needs a Devanagari font, e.g. fonts-noto-core): npx tsx eval/make-extract-set.mts
 * ONLY=<name prefix> rewrites just those pages.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { TesseractEngine } from "../../../packages/ocr/dist/index.js";

const OUT = join(import.meta.dirname, "..", "test", "fixtures", "extract");
mkdirSync(OUT, { recursive: true });

// Deterministic pseudo-random choices, so the set is reproducible.
let seed = 7;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const DEV = "०१२३४५६७८९";
const dev = (s: string) => s.replace(/\d/g, (d) => DEV[Number(d)]);
const maybeDev = (s: string, on: boolean) => (on ? dev(s) : s);

const VILLAGES = ["माळेगाव", "शिरूर", "वडगाव", "कोरेगाव", "निमगाव", "पिंपळगाव", "सोनगाव", "खेड"];
const TALUKAS = ["बारामती", "शिरूर", "हवेली", "मावळ", "दौंड", "इंदापूर"];
const DISTRICTS = ["पुणे", "सातारा", "अहमदनगर", "सोलापूर"];
const NAMES = ["सुरेश जाधव", "रामचंद्र पाटील", "अनिल शिंदे", "सुनीता पवार", "महेश कुलकर्णी", "गणपत मोरे", "लक्ष्मी देशमुख", "विजय गायकवाड"];
const RIGHTS = ["बँक ऑफ महाराष्ट्र बोजा रु. 5,00,000", "विकास सोसायटी कर्ज बोजा", "कुळ: गणपत मोरे", "वारस: सौ. सुमन"];

type Truth = Record<string, string | string[]>;
interface Case {
  name: string;
  kind: "SEVEN_TWELVE" | "FERFAR" | "INDEX_II";
  lines: string[];
  truth: Truth;
  /** A page drawn as a table rather than lines of text. */
  svg?: { body: string; height: number };
}

function names(n: number) {
  const out: string[] = [];
  while (out.length < n) {
    const x = pick(NAMES);
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

function satbara(i: number): Case {
  const d = i % 3 === 1;
  const sep = i % 4 === 3 ? ":-" : ":";
  const [v, t, z] = [pick(VILLAGES), pick(TALUKAS), pick(DISTRICTS)];
  const gat = String(20 + Math.floor(rnd() * 900));
  const owners = names(1 + (i % 3));
  const ferfar = String(100 + Math.floor(rnd() * 1800));
  const ha = Math.floor(rnd() * 4);
  const are = 1 + Math.floor(rnd() * 98);
  const triple = i % 2 === 0;
  const area = triple ? `${ha}.${String(are).padStart(2, "0")}.00 हे.आर.चौ.मी` : `${ha}.${String(are).padStart(2, "0")} हेक्टर`;
  const cls = i % 4 === 2 ? 2 : 1;
  const right = i % 3 === 0 ? pick(RIGHTS) : null;
  const ownerLines =
    i % 2 === 0
      ? [`भोगवटादाराचे नाव ${sep}`, ...owners.map((o) => `${o} (${maybeDev(ferfar, d)})`)]
      : [`भोगवटादाराचे नाव ${sep} ${owners.join(", ")}`];
  const lines = [
    i % 2 ? "गाव नमुना सात" : "गाव नमुना सात (अधिकार अभिलेख पत्रक)",
    `गाव ${sep} ${v}   तालुका ${sep} ${t}   जिल्हा ${sep} ${z}`,
    i % 3 === 2 ? `भूमापन क्रमांक व उपविभाग ${sep} ${maybeDev(gat, d)}` : `गट क्रमांक ${sep} ${maybeDev(gat, d)}`,
    `भूधारणा पद्धती ${sep} भोगवटादार वर्ग -${maybeDev(String(cls), d)}`,
    ...ownerLines,
    `क्षेत्र ${sep} ${maybeDev(area, d)}`,
    ...(right ? [`इतर हक्क ${sep} ${right}`] : []),
    `फेरफार क्रमांक ${sep} ${maybeDev(ferfar, d)}`,
  ];
  const truth: Truth = {
    village: v,
    taluka: t,
    district: z,
    [i % 3 === 2 ? "survey_no" : "gat_no"]: gat,
    owner: owners,
    area: String(ha * 10_000 + are * 100),
    land_class: cls === 2 ? "Class-II" : "Class-I",
    ferfar_no: ferfar,
  };
  if (right) truth.other_right = [right];
  return { name: `satbara-${String(i).padStart(2, "0")}`, kind: "SEVEN_TWELVE", lines, truth };
}

function ferfar(i: number): Case {
  const d = i % 2 === 0;
  const [v, t] = [pick(VILLAGES), pick(TALUKAS)];
  const no = String(100 + Math.floor(rnd() * 1800));
  const gat = String(20 + Math.floor(rnd() * 900));
  const date = `${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}/${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}/${1990 + Math.floor(rnd() * 35)}`;
  const iso = date.split("/").reverse().join("-");
  const kind = (["HEIRSHIP", "SALE", "CORRECTION"] as const)[i % 3];
  const head = [
    "गाव नमुना सहा - फेरफार नोंदवही",
    `फेरफार नोंद क्रमांक : ${maybeDev(no, d)}`,
    `दिनांक : ${maybeDev(date, d)}`,
    `गाव : ${v}   तालुका : ${t}`,
    `गट क्रमांक : ${maybeDev(gat, d)}`,
  ];
  const truth: Truth = { ferfar_no: no, date: iso, village: v, taluka: t, gat_no: gat, mutation_type: kind };
  let body: string[];
  if (kind === "HEIRSHIP") {
    const [dead, ...heirs] = names(3);
    body = [`मयत ${dead} यांचे वारस ${heirs.join(", ")}`, "यांची नावे दाखल केली."];
    Object.assign(truth, { from_party: [dead], to_party: heirs });
  } else if (kind === "SALE") {
    const [a, b] = names(2);
    const reg = `${100 + Math.floor(rnd() * 5000)}/${date.slice(-4)}`;
    body = [`लिहून देणार : ${a}`, `लिहून घेणार : ${b}`, `दस्त क्रमांक : ${maybeDev(reg, d)}`, "खरेदी दस्ताने नोंद."];
    Object.assign(truth, { from_party: [a], to_party: [b], deed_reg_no: reg });
  } else {
    body = [`कलम ${maybeDev("155", d)} अन्वये दुरुस्ती`, "क्षेत्र चुकीचे नोंदले होते ते दुरुस्त केले."];
    truth.section_155 = "true";
  }
  return { name: `ferfar-${String(i).padStart(2, "0")}`, kind: "FERFAR", lines: [...head, ...body, `मंडळ अधिकारी, ${v}`], truth };
}

function index2(i: number): Case {
  const d = i % 2 === 1;
  const v = pick(VILLAGES);
  const [a, ...bs] = names(1 + 1 + (i % 2));
  const date = `${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}/${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}/${1990 + Math.floor(rnd() * 35)}`;
  const reg = `${100 + Math.floor(rnd() * 5000)}/${date.slice(-4)}`;
  const [typeWord, deedType] = (
    [
      ["खरेदीखत", "SALE"],
      ["बक्षीसपत्र", "GIFT"],
      ["गहाणखत", "MORTGAGE"],
    ] as const
  )[i % 3];
  const lines = [
    "सूची क्र. २",
    `दस्ताचा प्रकार : ${typeWord}`,
    `दुय्यम निबंधक : ${pick(TALUKAS)}`,
    `दस्त क्रमांक : ${maybeDev(reg, d)}`,
    `दिनांक : ${maybeDev(date, d)}`,
    `गावाचे नाव : ${v}`,
    `लिहून देणार : ${a}`,
    `लिहून घेणार : ${bs.join(", ")}`,
    `मोबदला : रु. ${maybeDev("3,50,000", d)}`,
  ];
  return {
    name: `index2-${String(i).padStart(2, "0")}`,
    kind: "INDEX_II",
    lines,
    truth: { deed_reg_no: reg, date: date.split("/").reverse().join("-"), village: v, from_party: [a], to_party: bs, deed_type: deedType },
  };
}

/** A text item placed on the page; "middle" centres it on x, as table headings and numbers are. */
interface Item {
  x: number;
  text: string;
  mid?: boolean;
}
interface Row {
  items: Item[];
  /** Draw a ruled line under the row, as printed extracts do. */
  rule?: boolean;
}

/**
 * A 7/12 laid out as tables, like the computerised extract: the place line, a survey / tenure
 * box with the values under their headings, the owners table (one row per account), and the
 * other-rights box. Variants: survey or gat number, headings wrapped onto two lines, an account
 * number in the owner's cell, a total row, a tenant column, the total area as a line of its own.
 */
function satbaraTable(i: number): Case {
  const d = i % 3 === 1;
  const [v, t, z] = [pick(VILLAGES), pick(TALUKAS), pick(DISTRICTS)];
  const no = String(20 + Math.floor(rnd() * 900));
  const survey = i % 2 === 1;
  const owners = names(1 + (i % 3));
  const cls = i % 4 === 2 ? 2 : 1;
  const wrap = i % 4 === 3;
  const acctInName = i % 5 === 4;
  const tenant = i % 4 === 1 ? pick(NAMES.filter((n) => !owners.includes(n))) : null;
  const right = i % 3 === 0 ? pick(RIGHTS.filter((r) => !r.startsWith("कुळ"))) : null;
  const totalLine = i % 2 === 0;
  let ferfarNo = 100 + Math.floor(rnd() * 900);
  const rows = owners.map((o) => {
    ferfarNo += 1 + Math.floor(rnd() * 200);
    return { name: o, acct: String(10 + Math.floor(rnd() * 900)), are: 10 + Math.floor(rnd() * 80), ferfar: ferfarNo };
  });
  const totalAre = rows.reduce((a, r) => a + r.are, 0);
  const hra = (are: number) => `${Math.floor(are / 100)}.${String(are % 100).padStart(2, "0")}.00`;
  const n = (s: string) => maybeDev(s, d);

  // Owners table columns: account, name (wide), area, assessment, [tenant], ferfar.
  const cols = tenant
    ? { acct: 160, name: 470, area: 870, aakar: 1060, kul: 1260, ferfar: 1520 }
    : { acct: 160, name: 520, area: 960, aakar: 1170, kul: 0, ferfar: 1440 };
  const nameLeft = cols.name - 170;
  const heading: Item[] = [
    { x: cols.acct, text: "खाते क्रमांक", mid: true },
    { x: cols.name, text: wrap ? "भोगवटादाराचे" : "भोगवटादाराचे नाव", mid: true },
    { x: cols.area, text: "क्षेत्र", mid: true },
    { x: cols.aakar, text: "आकार", mid: true },
    ...(tenant ? [{ x: cols.kul, text: "कुळाचे नाव", mid: true }] : []),
    { x: cols.ferfar, text: "फेरफार क्र.", mid: true },
  ];
  const ownerRows: Row[] = rows.map((r, k) => ({
    items: [
      ...(acctInName ? [] : [{ x: cols.acct, text: n(r.acct), mid: true }]),
      { x: nameLeft, text: acctInName ? `${n(r.acct)} ${r.name}` : r.name },
      { x: cols.area, text: n(hra(r.are)), mid: true },
      { x: cols.aakar, text: n(`${1 + (r.are % 5)}.${String(r.are % 100).padStart(2, "0")}`), mid: true },
      ...(tenant && k === 0 ? [{ x: cols.kul, text: tenant, mid: true }] : []),
      { x: cols.ferfar, text: n(`(${r.ferfar})`), mid: true },
    ],
  }));
  const placeSep = i % 2 ? ":-" : ":";
  const page: Row[] = [
    { items: [{ x: 850, text: "गाव नमुना सात", mid: true }] },
    { items: [{ x: 850, text: "अधिकार अभिलेख पत्रक", mid: true }], rule: true },
    {
      items: [
        { x: 80, text: `गाव ${placeSep} ${v}` },
        { x: 650, text: `तालुका ${placeSep} ${t}` },
        { x: 1180, text: `जिल्हा ${placeSep} ${z}` },
      ],
      rule: true,
    },
    {
      items: [
        { x: 400, text: survey ? "भूमापन क्रमांक व उपविभाग" : "गट क्रमांक", mid: true },
        { x: 1200, text: "भूधारणा पद्धती", mid: true },
      ],
    },
    {
      items: [
        { x: 400, text: n(survey ? `${no}/${1 + (i % 4)}` : no), mid: true },
        { x: 1200, text: `भोगवटादार वर्ग -${n(String(cls))}`, mid: true },
      ],
      rule: true,
    },
    ...(totalLine ? [{ items: [{ x: 80, text: `एकूण क्षेत्र ${n(hra(totalAre))} हे.आर.चौ.मी` }], rule: true }] : []),
    { items: heading },
    ...(wrap ? [{ items: [{ x: cols.name, text: "नाव", mid: true }] }] : []),
    { items: [], rule: true },
    ...ownerRows,
    ...(!totalLine
      ? [
          {
            items: [
              { x: nameLeft, text: "एकूण" },
              { x: cols.area, text: n(hra(totalAre)), mid: true },
            ],
          },
        ]
      : []),
    { items: [], rule: true },
    { items: [{ x: 80, text: "इतर हक्क" }] },
    ...(right ? [{ items: [{ x: 80, text: right }] }] : []),
  ];

  const size = 40;
  const step = size * 2;
  const body: string[] = [];
  page.forEach((r, k) => {
    const y = 100 + k * step;
    for (const it of r.items)
      body.push(
        `<text x="${it.x}" y="${y}"${it.mid ? ' text-anchor="middle"' : ""} font-family="Noto Sans Devanagari" font-size="${size}" fill="black">${esc(it.text)}</text>`,
      );
    if (r.rule) body.push(`<line x1="50" x2="1650" y1="${y + size * 0.6}" y2="${y + size * 0.6}" stroke="black" stroke-width="2"/>`);
  });
  const truth: Truth = {
    village: v,
    taluka: t,
    district: z,
    [survey ? "survey_no" : "gat_no"]: survey ? `${no}/${1 + (i % 4)}` : no,
    owner: owners,
    area: String(totalAre * 100),
    land_class: cls === 2 ? "Class-II" : "Class-I",
    ferfar_no: String(rows[rows.length - 1].ferfar),
  };
  const rights = [...(tenant ? [`कुळ: ${tenant}`] : []), ...(right ? [right] : [])];
  if (rights.length) truth.other_right = rights;
  return {
    name: `satbara-table-${String(i).padStart(2, "0")}`,
    kind: "SEVEN_TWELVE",
    lines: page.map((r) => r.items.map((it) => it.text).join(" | ")),
    truth,
    svg: { body: body.join(""), height: 140 + page.length * step },
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function render(c: Case, variant: number) {
  const { lines } = c;
  const size = [46, 52, 40][variant % 3];
  const width = 1700;
  const h = c.svg?.height ?? 140 + lines.length * size * 2.2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"><rect width="100%" height="100%" fill="white"/>${
    c.svg?.body ??
    lines
      .map(
        (l, i) =>
          `<text x="80" y="${110 + i * size * 2.2}" font-family="Noto Sans Devanagari" font-size="${size}" fill="black">${esc(l)}</text>`,
      )
      .join("")
  }</svg>`;
  let img = sharp(Buffer.from(svg)).flatten({ background: "#ffffff" });
  // Degrade like a phone photo on half the set: slight tilt, softness, grey paper, JPEG.
  if (variant % 2 === 1)
    img = img
      .rotate(variant % 4 === 1 ? 0.8 : -0.6, { background: "#f2efe6" })
      .blur(0.7)
      .linear(0.9, 12);
  if (variant % 3 === 2) img = img.resize({ width: Math.round(width * 0.65) });
  return img.jpeg({ quality: variant % 2 ? 62 : 90 }).toBuffer();
}

const cases = [
  ...Array.from({ length: 10 }, (_, i) => satbara(i)),
  ...Array.from({ length: 8 }, (_, i) => ferfar(i)),
  ...Array.from({ length: 6 }, (_, i) => index2(i)),
  ...Array.from({ length: 12 }, (_, i) => satbaraTable(i)),
];
// ONLY=satbara-table writes just the pages whose names start with it (the others stay as they are).
const only = process.env.ONLY;
const engine = new TesseractEngine();
let n = 0;
for (const c of cases) {
  const variant = n++;
  if (only && !c.name.startsWith(only)) continue;
  const r = await engine.recognize(await render(c, variant));
  writeFileSync(
    join(OUT, `${c.name}.json`),
    `${JSON.stringify({ name: c.name, kind: c.kind, truth: c.truth, ocrConfidence: r.confidence, lines: c.lines, words: r.words })}\n`,
  );
  console.log(c.name, r.confidence);
}
await engine.close();
