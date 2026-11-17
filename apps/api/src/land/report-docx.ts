/**
 * Title search report as a Word (.docx) file, laid out like the printed report: letterhead,
 * property details, owners, chain of title, encumbrances, flags, documents, opinion, signature.
 * Fonts: Calibri for Latin text and Nirmala UI for Devanagari (both ship with Windows and Office).
 */
import type { Locale, TitleReportResponse } from "@vakilmitra/shared";
import { interpolate, type MessageKey, translate } from "@vakilmitra/shared/i18n";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const FONT = { ascii: "Calibri", hAnsi: "Calibri", cs: "Nirmala UI", eastAsia: "Nirmala UI" };
const MUTED = "6B6B6B";
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

export async function reportDocx(data: TitleReportResponse, locale: Locale): Promise<Buffer> {
  const t = (k: MessageKey) => translate(locale, k);
  const tf = (k: MessageKey, vars: Record<string, string | number>) => interpolate(translate(locale, k), vars);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale === "mr" ? "mr-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  const approved = data.draft?.status === "APPROVED" && data.draft.approved ? data.draft : null;
  const report = approved?.approved ?? data.report;
  const opinion = (approved ? approved.opinion : data.draft?.opinion) ?? "";
  const p = report.property;

  const text = (s: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
    new TextRun({ text: s, font: FONT, ...o });
  const para = (runs: TextRun[] | string, o: { spacingAfter?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new Paragraph({
      children: typeof runs === "string" ? [text(runs)] : runs,
      spacing: { after: o.spacingAfter ?? 80 },
      alignment: o.align,
    });
  const heading = (k: MessageKey) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [text(t(k), { bold: true, size: 24 })],
      spacing: { before: 280, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF", space: 2 } },
    });
  const bullet = (s: string) => new Paragraph({ children: [text(s)], bullet: { level: 0 }, spacing: { after: 60 } });

  const propLine = [
    p.gatNo && `${t("land.gat")} ${p.gatNo}`,
    p.surveyNo && `${t("land.survey")} ${p.surveyNo}`,
    p.hissaNo && `${t("land.hissa")} ${p.hissaNo}`,
  ]
    .filter(Boolean)
    .join(", ");
  const rows: [string, string][] = [
    [t("land.property"), [propLine, p.village, p.taluka, p.district].filter(Boolean).join(", ")],
    ...(p.areaSqm != null ? [[t("land.area"), p.areaSqm.toLocaleString(locale === "mr" ? "mr-IN" : "en-IN")] as [string, string]] : []),
    ...(p.landClass ? [[t("land.landClass"), p.landClass] as [string, string]] : []),
    ...(data.client ? [[t("report.preparedFor"), data.client.name] as [string, string]] : []),
    [t("report.period"), `${report.period.from ? date(report.period.from) : "—"} – ${date(report.period.to)}`],
    [t("report.date"), date(report.period.to)],
  ];
  const details = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [para([text(k, { color: MUTED })], { spacingAfter: 40 })],
            }),
            new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [para(v, { spacingAfter: 40 })] }),
          ],
        }),
    ),
  });

  const body: (Paragraph | Table)[] = [
    para([text(data.advocate.name, { bold: true, size: 28 })], { spacingAfter: 20 }),
    para([text([data.advocate.barCouncilNo, data.advocate.phone, data.advocate.email].filter(Boolean).join(" · "), { color: MUTED })], {
      spacingAfter: 240,
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [text(t("report.title"), { bold: true, size: 36 })],
      spacing: { after: 160 },
    }),
    details,
  ];
  if (!report.period.complete) body.push(para([text(tf("report.incomplete", { years: report.period.years }), { color: "8A5300" })]));
  if (!approved) body.push(para([text(t("report.draftNote"), { italics: true, color: MUTED })]));

  body.push(heading("report.owners"));
  body.push(
    report.owners
      ? para([
          text(report.owners.names.join(", "), { bold: true }),
          text(` (${tf("report.asPer", { date: date(report.owners.asPerDate) })})`, { color: MUTED }),
        ])
      : para([text(t("report.noOwners"), { color: MUTED })]),
  );

  body.push(heading("report.chain"));
  report.chain.forEach((e, i) => {
    const head = [
      date(e.date),
      t(`land.kind.${e.kind}` as MessageKey) + (e.subtype ? ` (${e.subtype})` : ""),
      e.ferfarNo && `${t("land.ferfarNo")} ${e.ferfarNo}`,
      e.deedRegNo && `${t("land.deedRegNo")} ${e.deedRegNo}`,
      e.section155 && t("land.section155"),
    ]
      .filter(Boolean)
      .join(" · ");
    const who = e.kind === "RECORD_SNAPSHOT" ? e.owners.join(", ") : `${e.from.join(", ") || "—"} → ${e.to.join(", ") || "—"}`;
    body.push(para([text(`${i + 1}. `, { color: MUTED }), text(head, { bold: true })], { spacingAfter: 20 }));
    if (who) body.push(para(`    ${who}`, { spacingAfter: e.notes ? 20 : 100 }));
    if (e.notes) body.push(para([text(`    ${e.notes}`, { color: MUTED })], { spacingAfter: 100 }));
  });

  body.push(heading("report.encumbrances"));
  if (report.encumbrances.length === 0) body.push(para([text(t("report.noEncumbrances"), { color: MUTED })]));
  for (const e of report.encumbrances) body.push(bullet(e.source === "mortgage" ? `${t("report.mortgage")}: ${e.text}` : e.text));

  body.push(heading("report.openFlags"));
  if (report.flags.open.length === 0) body.push(para([text(t("report.noOpenFlags"), { color: MUTED })]));
  for (const f of report.flags.open) body.push(bullet(`[${t(`sev.${f.severity}` as MessageKey)}] ${f.message}`));
  if (report.flags.resolved.length) {
    body.push(heading("report.resolvedFlags"));
    for (const f of report.flags.resolved) body.push(bullet(f.resolution ? `${f.message} — ${f.resolution}` : f.message));
  }

  body.push(heading("report.documents"));
  for (const d of report.documents) {
    body.push(
      bullet(
        `${[d.title, t(`doctype.${d.type}` as MessageKey), d.year].filter(Boolean).join(" · ")} (${tf("report.pages", { n: d.pageCount })})`,
      ),
    );
  }

  body.push(heading("report.opinion"));
  if (opinion.trim()) for (const line of opinion.split("\n")) body.push(para(line));
  else body.push(para([text(t("report.noOpinion"), { color: MUTED })]));

  body.push(
    new Paragraph({ spacing: { before: 720 }, alignment: AlignmentType.RIGHT, children: [text(data.advocate.name, { bold: true })] }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        text(approved?.approvedAt ? tf("report.approved", { date: date(approved.approvedAt) }) : t("report.signature"), { color: MUTED }),
      ],
    }),
  );

  const doc = new Document({
    creator: "VakilMitra",
    title: t("report.title"),
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: body }],
  });
  return Packer.toBuffer(doc);
}
