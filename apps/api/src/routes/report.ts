/**
 * Title search report for a property: the report built from the chain as it is now, the
 * advocate's opinion, and their sign-off. Approving stores a snapshot of the report, so the
 * signed version never changes; if the chain or flags change later, the response says so.
 */
import { and, asc, cases, documents, drafts, eq, flags, inArray, or, ownershipEvents, properties } from "@vakilmitra/db";
import { LOCALES, type ReportDraft, reportDraftInput, type TitleReport, type TitleReportResponse } from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db.js";
import { buildTitleReport } from "../land/report.js";
import { reportDocx } from "../land/report-docx.js";
import type { ChainEvent } from "../land/rules.js";
import { logAccess, requireCaseAccess, requireCaseOwner } from "../lib/access.js";
import { HttpError, notFound } from "../lib/http.js";

const TEMPLATE = "TSR";
const params = z.object({ caseId: z.string(), propertyId: z.string() });

/** The report for a property as of a date, from what is in the database now. */
async function currentReport(caseId: string, propertyId: string, asOf: Date): Promise<TitleReport> {
  const property = await db.query.properties.findFirst({ where: and(eq(properties.id, propertyId), eq(properties.caseId, caseId)) });
  if (!property) throw notFound("Property");
  const events = await db.query.ownershipEvents.findMany({
    where: eq(ownershipEvents.propertyId, propertyId),
    orderBy: [asc(ownershipEvents.date), asc(ownershipEvents.id)],
  });
  const flagRows = await db.query.flags.findMany({
    where: eq(flags.propertyId, propertyId),
    orderBy: [asc(flags.resolved), asc(flags.createdAt)],
  });
  // Documents examined: those filed against the property, and those its chain events came from.
  const eventDocIds = [...new Set(events.map((e) => e.documentId).filter((id): id is string => !!id))];
  const docRows = await db.query.documents.findMany({
    where: and(
      eq(documents.caseId, caseId),
      eventDocIds.length
        ? or(eq(documents.propertyId, propertyId), inArray(documents.id, eventDocIds))
        : eq(documents.propertyId, propertyId),
    ),
    columns: { id: true, type: true, year: true, title: true },
    with: { pages: { columns: { id: true } } },
    orderBy: [asc(documents.year), asc(documents.createdAt)],
  });
  return buildTitleReport({
    property,
    events: events as unknown as ReportEvent[],
    flags: flagRows.map((f) => ({ ...f, eventIds: f.eventIds ?? [] })),
    documents: docRows.map((d) => ({ id: d.id, type: d.type, year: d.year, title: d.title, pageCount: d.pages.length })),
    asOf,
  });
}
type ReportEvent = ChainEvent & { notes?: string | null; documentId?: string | null };

/** Reports are dated by day, so a snapshot and a later rebuild for the same day compare equal. */
const day = (d: string) => new Date(`${d}T00:00:00Z`);
const today = () => day(new Date().toISOString().slice(0, 10));

/** JSON with object keys sorted: Postgres jsonb does not keep key order. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );

function toDraft(d: typeof drafts.$inferSelect): ReportDraft {
  const snapshot = (d.values as { approved?: TitleReport } | null)?.approved ?? null;
  return {
    id: d.id,
    language: d.language,
    opinion: d.body,
    status: d.status,
    approvedAt: d.approvedAt?.toISOString() ?? null,
    approvedBy: d.approvedById,
    approved: d.status === "APPROVED" ? snapshot : null,
    updatedAt: d.updatedAt.toISOString(),
  };
}

const findDraft = (propertyId: string) =>
  db.query.drafts.findFirst({ where: and(eq(drafts.propertyId, propertyId), eq(drafts.template, TEMPLATE)) });

function reportTitle(p: TitleReport["property"]) {
  const no = [p.surveyNo && `S.No. ${p.surveyNo}`, p.gatNo && `Gat ${p.gatNo}`, p.hissaNo && `Hissa ${p.hissaNo}`]
    .filter(Boolean)
    .join(" ");
  return ["Title search report", [p.village, no].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}

/** Everything the report page and the Word export show. */
async function loadReport(caseId: string, propertyId: string): Promise<TitleReportResponse> {
  const report = await currentReport(caseId, propertyId, today());
  const row = await findDraft(propertyId);
  const draft = row ? toDraft(row) : null;

  // Compare the approved snapshot with the chain as it is now, on the same report date.
  let changedSinceApproval = false;
  if (draft?.approved) {
    const now = await currentReport(caseId, propertyId, day(draft.approved.period.to));
    changedSinceApproval = canonical(now) !== canonical(draft.approved);
  }

  const c = await db.query.cases.findFirst({
    where: eq(cases.id, caseId),
    columns: { title: true },
    with: {
      advocate: { columns: { name: true, barCouncilNo: true, phone: true, email: true } },
      client: { columns: { name: true } },
    },
  });
  return {
    report,
    draft,
    changedSinceApproval,
    advocate: c!.advocate,
    client: c!.client ? { name: c!.client.name } : null,
    caseTitle: c!.title,
  };
}

export const reportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/cases/:caseId/properties/:propertyId/report", { schema: { params } }, async (req): Promise<TitleReportResponse> => {
    const { caseId, propertyId } = req.params;
    await requireCaseAccess(req.advocateId, caseId);
    const data = await loadReport(caseId, propertyId);
    logAccess(req, "report.view", "property", propertyId);
    return data;
  });

  /** The report as a Word file: the signed snapshot once approved, otherwise the report as it is now. */
  app.get(
    "/cases/:caseId/properties/:propertyId/report.docx",
    { schema: { params, querystring: z.object({ lang: z.enum(LOCALES).optional() }) } },
    async (req, reply) => {
      const { caseId, propertyId } = req.params;
      await requireCaseAccess(req.advocateId, caseId);
      const data = await loadReport(caseId, propertyId);
      const locale = req.query.lang ?? data.draft?.language ?? "mr";
      const file = await reportDocx(data, locale);
      logAccess(req, "report.export", "property", propertyId);
      const name = `title-report-${(data.report.property.gatNo ?? data.report.property.surveyNo ?? propertyId).replace(/[^\w-]+/g, "-")}.docx`;
      return reply
        .header("content-type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        .header("content-disposition", `attachment; filename="${name}"`)
        .header("cache-control", "no-store")
        .send(file);
    },
  );

  /** Save the opinion. Editing an approved report takes it back to draft: it must be signed again. */
  app.put("/cases/:caseId/properties/:propertyId/report", { schema: { params, body: reportDraftInput } }, async (req) => {
    const { caseId, propertyId } = req.params;
    await requireCaseAccess(req.advocateId, caseId, "write");
    const report = await currentReport(caseId, propertyId, today());
    const [row] = await db
      .insert(drafts)
      .values({
        caseId,
        propertyId,
        template: TEMPLATE,
        language: req.body.language,
        title: reportTitle(report.property),
        body: req.body.opinion,
      })
      .onConflictDoUpdate({
        target: [drafts.propertyId, drafts.template],
        set: {
          language: req.body.language,
          body: req.body.opinion,
          title: reportTitle(report.property),
          status: "DRAFT",
          approvedAt: null,
          approvedById: null,
          values: {},
          updatedAt: new Date(),
        },
      })
      .returning();
    return { draft: toDraft(row) };
  });

  /** Sign off: only the owning advocate, and only with an opinion written. Stores the report as it is now. */
  app.post("/cases/:caseId/properties/:propertyId/report/approve", { schema: { params } }, async (req) => {
    const { caseId, propertyId } = req.params;
    await requireCaseOwner(req.advocateId, caseId);
    const row = await findDraft(propertyId);
    if (!row?.body.trim()) throw new HttpError(400, "no_opinion", "Write the opinion before approving");
    const snapshot = await currentReport(caseId, propertyId, today());
    const [updated] = await db
      .update(drafts)
      .set({
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: req.advocateId,
        values: { approved: snapshot },
        version: row.version + 1,
      })
      .where(eq(drafts.id, row.id))
      .returning();
    logAccess(req, "report.approve", "property", propertyId);
    return { draft: toDraft(updated) };
  });
};
