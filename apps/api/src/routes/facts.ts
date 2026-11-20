/**
 * Land-file analyzer, step 2: facts. The extractor reads fields from a document's OCR text;
 * every fact keeps its page and source crop, and nothing is used until the advocate has
 * reviewed it. Reviewed facts then become an ownership event on a property, and the
 * deterministic red-flag rules run over the updated chain.
 */
import { and, asc, documents, eq, facts, ownershipEvents, pages, properties } from "@vakilmitra/db";
import {
  checkQuery,
  type Extraction,
  eventFromDocumentInput,
  type Fact,
  type FactField,
  factCreateInput,
  factUpdateInput,
  factValueProblem,
  RECORD_KINDS,
  type RecordKind,
} from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db.js";
import { classifyText, extractDocument } from "../land/extract.js";
import { logAccess, requireCaseAccess } from "../lib/access.js";
import { HttpError, notFound } from "../lib/http.js";
import { propertyInCase, runPropertyCheck } from "./land.js";

const idParams = z.object({ id: z.string() });
const MULTI = new Set<FactField>(["owner", "other_right", "from_party", "to_party"]);
const isRecordKind = (t: string): t is RecordKind => (RECORD_KINDS as readonly string[]).includes(t);

type FactRow = typeof facts.$inferSelect;
function toFact(f: FactRow): Fact {
  return {
    id: f.id,
    documentId: f.documentId,
    pageId: f.pageId,
    field: f.field as FactField,
    value: f.value,
    originalValue: f.originalValue,
    position: f.position,
    confidence: f.confidence,
    crop:
      f.cropX === null || f.cropY === null || f.cropW === null || f.cropH === null
        ? null
        : { x: f.cropX, y: f.cropY, w: f.cropW, h: f.cropH },
    reviewed: f.reviewed,
    reviewedAt: f.reviewedAt?.toISOString() ?? null,
  };
}

async function loadDocument(advocateId: string, documentId: string, need: "read" | "write") {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
  if (!doc) throw notFound("Document");
  await requireCaseAccess(advocateId, doc.caseId, need);
  return doc;
}

async function extraction(doc: { id: string; type: string }, kind?: RecordKind | null): Promise<Extraction> {
  const rows = await db.query.facts.findMany({
    where: eq(facts.documentId, doc.id),
    orderBy: [asc(facts.field), asc(facts.position), asc(facts.createdAt)],
  });
  const events = await db
    .select({ id: ownershipEvents.id, propertyId: ownershipEvents.propertyId })
    .from(ownershipEvents)
    .where(eq(ownershipEvents.documentId, doc.id));
  return { kind: kind ?? (isRecordKind(doc.type) ? doc.type : null), facts: rows.map(toFact), events };
}

/**
 * Once a document is in a property's timeline, its facts are what the event and its flags were
 * built from, so they are frozen. To change them, remove the record from the timeline first.
 */
async function ensureNotInChain(documentId: string | null) {
  if (!documentId) return;
  const ev = await db.query.ownershipEvents.findFirst({ where: eq(ownershipEvents.documentId, documentId), columns: { id: true } });
  if (ev)
    throw new HttpError(409, "in_chain", "This document is in a property's timeline; remove it from the timeline to change its details", {
      eventId: ev.id,
    });
}

async function loadFact(advocateId: string, factId: string) {
  const fact = await db.query.facts.findFirst({ where: eq(facts.id, factId) });
  if (!fact) throw notFound("Fact");
  await requireCaseAccess(advocateId, fact.caseId, "write");
  await ensureNotInChain(fact.documentId);
  return fact;
}

const badValue = (field: FactField, value: string) => {
  const problem = factValueProblem(field, value);
  if (problem) throw new HttpError(400, "bad_value", `The value for ${field} is not in the expected format`, { field, problem });
};

export const factRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/documents/:id/facts", { schema: { params: idParams } }, async (req) => {
    const doc = await loadDocument(req.advocateId, req.params.id, "read");
    return { extraction: await extraction(doc) };
  });

  /**
   * Read the document's fields from its OCR text. Facts the advocate already reviewed are kept;
   * unreviewed ones are replaced by the fresh reading.
   */
  app.post("/documents/:id/extract", { schema: { params: idParams } }, async (req) => {
    const doc = await loadDocument(req.advocateId, req.params.id, "write");
    // Only land records are read, or a document not typed yet (its text says which record it is).
    if (!isRecordKind(doc.type) && doc.type !== "OTHER") {
      throw new HttpError(409, "not_a_record", "Details are read from a 7/12, Ferfar or Index-II only");
    }
    await ensureNotInChain(doc.id);
    const docPages = await db.query.pages.findMany({
      where: eq(pages.documentId, doc.id),
      orderBy: asc(pages.pageNo),
      columns: { id: true, ocrStatus: true, ocrText: true, ocrWords: true },
    });
    if (!docPages.length) throw new HttpError(409, "no_pages", "Add pages to this document first");
    if (docPages.some((p) => p.ocrStatus === "PENDING" || p.ocrStatus === "PROCESSING")) {
      throw new HttpError(409, "ocr_pending", "Pages are still being read");
    }
    const read = docPages.filter((p) => p.ocrStatus === "DONE" && p.ocrWords?.length);

    let kind: RecordKind | null = isRecordKind(doc.type) ? doc.type : null;
    if (!kind) {
      kind = classifyText(read.map((p) => p.ocrText ?? "").join("\n"))?.kind ?? null;
      // Only a document filed as "Other" is re-typed; a type the advocate chose is never overridden.
      if (kind && doc.type === "OTHER") await db.update(documents).set({ type: kind }).where(eq(documents.id, doc.id));
    }
    if (!kind) return { extraction: await extraction(doc, null) };

    const found = extractDocument(
      kind,
      read.map((p) => ({ pageId: p.id, words: p.ocrWords ?? [] })),
    );
    await db.transaction(async (tx) => {
      await tx.delete(facts).where(and(eq(facts.documentId, doc.id), eq(facts.reviewed, false)));
      const kept = await tx.query.facts.findMany({ where: eq(facts.documentId, doc.id) });
      // A reviewed fact wins: skip fresh readings it already covers.
      const fresh = found.filter((f) =>
        MULTI.has(f.field)
          ? !kept.some((k) => k.field === f.field && (k.value === f.value || k.originalValue === f.value))
          : !kept.some((k) => k.field === f.field),
      );
      if (fresh.length) {
        await tx.insert(facts).values(
          fresh.map((f) => ({
            caseId: doc.caseId,
            documentId: doc.id,
            pageId: f.pageId,
            field: f.field,
            value: f.value,
            position: f.position + (MULTI.has(f.field) ? kept.filter((k) => k.field === f.field).length : 0),
            confidence: f.confidence,
            cropX: f.box?.[0] ?? null,
            cropY: f.box?.[1] ?? null,
            cropW: f.box ? f.box[2] - f.box[0] : null,
            cropH: f.box ? f.box[3] - f.box[1] : null,
          })),
        );
      }
    });
    logAccess(req, "document.extract", "document", doc.id);
    return { extraction: await extraction({ ...doc, type: kind }, kind) };
  });

  /** A fact the extractor missed, typed in by the advocate (reviewed by definition). */
  app.post("/documents/:id/facts", { schema: { params: idParams, body: factCreateInput } }, async (req, reply) => {
    const doc = await loadDocument(req.advocateId, req.params.id, "write");
    await ensureNotInChain(doc.id);
    badValue(req.body.field, req.body.value);
    const same = await db.query.facts.findMany({ where: and(eq(facts.documentId, doc.id), eq(facts.field, req.body.field)) });
    if (same.length && !MULTI.has(req.body.field))
      throw new HttpError(409, "fact_exists", "This field already has a value; edit it instead");
    const [fact] = await db
      .insert(facts)
      .values({
        caseId: doc.caseId,
        documentId: doc.id,
        field: req.body.field,
        value: req.body.value,
        position: same.length,
        confidence: 1,
        reviewed: true,
        reviewedById: req.advocateId,
        reviewedAt: new Date(),
      })
      .returning();
    return reply.code(201).send({ fact: toFact(fact) });
  });

  /** Correct and/or confirm a fact. A corrected value counts as reviewed; the extractor's reading is kept. */
  app.patch("/facts/:id", { schema: { params: idParams, body: factUpdateInput } }, async (req) => {
    const fact = await loadFact(req.advocateId, req.params.id);
    const { value, reviewed } = req.body;
    const changed = value !== undefined && value !== fact.value;
    if (changed) badValue(fact.field as FactField, value);
    const nowReviewed = reviewed ?? (changed ? true : fact.reviewed);
    const [row] = await db
      .update(facts)
      .set({
        ...(changed ? { value, originalValue: fact.originalValue ?? (fact.pageId || fact.cropX !== null ? fact.value : null) } : {}),
        reviewed: nowReviewed,
        reviewedById: nowReviewed ? req.advocateId : null,
        reviewedAt: nowReviewed ? new Date() : null,
      })
      .where(eq(facts.id, fact.id))
      .returning();
    return { fact: toFact(row) };
  });

  app.delete("/facts/:id", { schema: { params: idParams } }, async (req, reply) => {
    const fact = await loadFact(req.advocateId, req.params.id);
    await db.delete(facts).where(eq(facts.id, fact.id));
    return reply.code(204).send();
  });

  /**
   * Turn a reviewed document into an ownership event on a property: a 7/12 becomes a record
   * snapshot, a Ferfar a mutation, an Index-II a deed. Empty property details (village, gat no …)
   * are filled from the document; details that disagree are reported, never overwritten.
   * Then the red-flag rules run over the updated chain. propertyId "new" creates the property from
   * the document's details, in the same transaction (so a refused request leaves nothing behind).
   */
  app.post(
    "/cases/:caseId/properties/:propertyId/events/from-document",
    { schema: { params: z.object({ caseId: z.string(), propertyId: z.string() }), querystring: checkQuery, body: eventFromDocumentInput } },
    async (req, reply) => {
      const { caseId } = req.params;
      await requireCaseAccess(req.advocateId, caseId, "write");
      const isNew = req.params.propertyId === "new";
      const property = isNew ? null : await propertyInCase(caseId, req.params.propertyId);
      const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, req.body.documentId), eq(documents.caseId, caseId)) });
      if (!doc) throw notFound("Document");
      if (!isRecordKind(doc.type)) throw new HttpError(409, "not_a_record", "Only a 7/12, Ferfar or Index-II can be added to the chain");
      const existing = property
        ? await db.query.ownershipEvents.findFirst({
            where: and(eq(ownershipEvents.documentId, doc.id), eq(ownershipEvents.propertyId, property.id)),
          })
        : undefined;
      if (existing) throw new HttpError(409, "already_added", "This document is already in the property's chain", { eventId: existing.id });

      const rows = await db.query.facts.findMany({ where: eq(facts.documentId, doc.id), orderBy: [asc(facts.field), asc(facts.position)] });
      if (!rows.length) throw new HttpError(409, "no_facts", "Read the document's details first");
      const unreviewed = rows.filter((f) => !f.reviewed).length;
      if (unreviewed) throw new HttpError(409, "unreviewed", "Review every detail before adding it to the chain", { unreviewed });
      for (const f of rows) badValue(f.field as FactField, f.value);

      const one = (field: FactField) => rows.find((f) => f.field === field)?.value ?? null;
      const all = (field: FactField) => rows.filter((f) => f.field === field).map((f) => f.value);
      // The body's date is already parsed (isoDate); a date fact is "YYYY-MM-DD", stored as UTC midnight like typed dates.
      const factDate = one("date");
      const date = req.body.date ?? (factDate ? new Date(`${factDate}T00:00:00Z`) : null);
      if (!date) throw new HttpError(400, "need_date", "Give the record's date");

      const base = { documentId: doc.id, date, factIds: rows.map((f) => f.id) };
      const values =
        doc.type === "SEVEN_TWELVE"
          ? {
              ...base,
              kind: "RECORD_SNAPSHOT" as const,
              owners: all("owner"),
              areaSqm: one("area") === null ? null : Number(one("area")),
              landClass: one("land_class"),
              otherRights: all("other_right"),
            }
          : doc.type === "FERFAR"
            ? {
                ...base,
                kind: "MUTATION" as const,
                subtype: one("mutation_type"),
                ferfarNo: one("ferfar_no"),
                refDeedRegNo: one("deed_reg_no"),
                fromParties: all("from_party"),
                toParties: all("to_party"),
                section155: one("section_155") === "true" || one("mutation_type") === "CORRECTION",
              }
            : {
                ...base,
                kind: "DEED" as const,
                subtype: one("deed_type"), // null when the deed type was not read: never assume a sale
                deedRegNo: one("deed_reg_no"),
                fromParties: all("from_party"),
                toParties: all("to_party"),
              };

      // Property details: fill the blanks, report disagreements.
      const PLACE: [FactField, "village" | "taluka" | "district" | "gatNo" | "surveyNo" | "hissaNo"][] = [
        ["village", "village"],
        ["taluka", "taluka"],
        ["district", "district"],
        ["gat_no", "gatNo"],
        ["survey_no", "surveyNo"],
        ["hissa_no", "hissaNo"],
      ];
      const fill: Partial<Record<(typeof PLACE)[number][1], string>> = {};
      const mismatches: { field: FactField; property: string; document: string }[] = [];
      for (const [field, col] of PLACE) {
        const v = one(field);
        if (!v) continue;
        const have = property?.[col];
        if (!have) fill[col] = v;
        else if (have.normalize("NFC").trim() !== v.normalize("NFC").trim()) mismatches.push({ field, property: have, document: v });
      }

      const { event, propertyId } = await db.transaction(async (tx) => {
        let pid = property?.id;
        if (!pid)
          [{ id: pid }] = await tx
            .insert(properties)
            .values({ caseId, ...fill })
            .returning({ id: properties.id });
        else if (Object.keys(fill).length) await tx.update(properties).set(fill).where(eq(properties.id, pid));
        const [ev] = await tx
          .insert(ownershipEvents)
          .values({ ...values, propertyId: pid })
          .returning();
        if (!doc.propertyId) await tx.update(documents).set({ propertyId: pid }).where(eq(documents.id, doc.id));
        return { event: ev, propertyId: pid };
      });
      const check = await runPropertyCheck(caseId, propertyId, req.query.lang ?? "mr");
      return reply.code(201).send({ event, propertyId, filled: fill, mismatches, flags: check.flags });
    },
  );
};
