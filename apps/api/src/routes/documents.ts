import { randomUUID } from "node:crypto";
import { and, asc, cases, count, desc, documents, eq, ilike, inArray, pages, sql } from "@vakilmitra/db";
import { enqueueOcr, rollUpDocumentStatus } from "@vakilmitra/jobs";
import { documentInput, documentUpdateInput, PAGE_UPLOAD, type SearchHit, textSearchQuery } from "@vakilmitra/shared";
import { keys } from "@vakilmitra/storage";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import sharp, { type OutputInfo } from "sharp";
import { z } from "zod";
import { assertPageQuota } from "../billing/service.js";
import { db } from "../db.js";
import { logAccess, requireCaseAccess, visibleCase } from "../lib/access.js";
import { HttpError, likePattern, notFound } from "../lib/http.js";
import { getServices } from "../services.js";

/** Stored page images: upright, no EXIF (drops GPS and device data), capped size, JPEG. */
const STORED_MAX_SIDE = 3000;

const pageSummary = {
  id: true,
  pageNo: true,
  width: true,
  height: true,
  ocrStatus: true,
  ocrConfidence: true,
  ocrError: true,
} as const;
const pageReturning = {
  id: pages.id,
  pageNo: pages.pageNo,
  width: pages.width,
  height: pages.height,
  ocrStatus: pages.ocrStatus,
  ocrConfidence: pages.ocrConfidence,
  ocrError: pages.ocrError,
};

/** Load a document with the access check done through its case. */
async function documentWithAccess(advocateId: string, documentId: string, need: "read" | "write" = "read") {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
    with: { case: { columns: { id: true, advocateId: true } } },
  });
  if (!doc) throw notFound("Document");
  await requireCaseAccess(advocateId, doc.caseId, need);
  return doc;
}

async function pageCounts(documentIds: string[]) {
  if (!documentIds.length) return new Map<string, number>();
  const rows = await db
    .select({ documentId: pages.documentId, n: count() })
    .from(pages)
    .where(inArray(pages.documentId, documentIds))
    .groupBy(pages.documentId);
  return new Map(rows.map((r) => [r.documentId, r.n]));
}

/** Text around the first match, with the match position inside the snippet. */
export function makeSnippet(rawText: string, rawQ: string, radius = 70) {
  // Work on one normalised form throughout, so positions and lengths agree.
  const text = rawText.normalize("NFC");
  const q = rawQ.normalize("NFC");
  const lower = text.toLocaleLowerCase();
  const at = lower.length === text.length ? lower.indexOf(q.toLocaleLowerCase()) : -1;
  // If JS can't locate what Postgres matched (case-folding differences), show the start of the
  // page with no highlight rather than highlighting the wrong words.
  if (at < 0) {
    const end = Math.min(text.length, radius * 2);
    return { snippet: text.slice(0, end).replace(/\s/g, " ") + (end < text.length ? "…" : ""), matchStart: 0, matchEnd: 0 };
  }
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + q.length + radius);
  const prefix = start > 0 ? "…" : "";
  const snippet = prefix + text.slice(start, end).replace(/\s/g, " ") + (end < text.length ? "…" : "");
  const matchStart = prefix.length + (at - start);
  return { snippet, matchStart, matchEnd: matchStart + q.length };
}

const idParams = z.object({ id: z.string() });
const pageParams = z.object({ id: z.string(), pageId: z.string() });

export const documentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/cases/:caseId/documents",
    { schema: { params: z.object({ caseId: z.string() }), body: documentInput } },
    async (req, reply) => {
      await requireCaseAccess(req.advocateId, req.params.caseId, "write");
      if (req.body.propertyId) {
        const p = await db.query.properties.findFirst({
          where: (t, { and, eq }) => and(eq(t.id, req.body.propertyId!), eq(t.caseId, req.params.caseId)),
        });
        if (!p) throw notFound("Property");
      }
      const [document] = await db
        .insert(documents)
        .values({ ...req.body, caseId: req.params.caseId })
        .returning();
      return reply.code(201).send({ document: { ...document, pageCount: 0 } });
    },
  );

  app.get("/cases/:caseId/documents", { schema: { params: z.object({ caseId: z.string() }) } }, async (req) => {
    await requireCaseAccess(req.advocateId, req.params.caseId);
    const rows = await db.query.documents.findMany({ where: eq(documents.caseId, req.params.caseId), orderBy: desc(documents.createdAt) });
    const counts = await pageCounts(rows.map((d) => d.id));
    return { documents: rows.map((d) => ({ ...d, pageCount: counts.get(d.id) ?? 0 })) };
  });

  app.get("/documents/:id", { schema: { params: idParams } }, async (req) => {
    const doc = await documentWithAccess(req.advocateId, req.params.id);
    const pageRows = await db.query.pages.findMany({
      where: eq(pages.documentId, doc.id),
      orderBy: asc(pages.pageNo),
      columns: { ...pageSummary, ocrText: true, ocrWords: true, ocrEngine: true, ocrRoute: true },
    });
    logAccess(req, "document.view", "document", doc.id);
    const { case: _c, ...document } = doc;
    return { document: { ...document, pageCount: pageRows.length, pages: pageRows } };
  });

  app.patch("/documents/:id", { schema: { params: idParams, body: documentUpdateInput } }, async (req) => {
    const doc = await documentWithAccess(req.advocateId, req.params.id, "write");
    if (req.body.propertyId) {
      const p = await db.query.properties.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, req.body.propertyId!), eq(t.caseId, doc.caseId)),
      });
      if (!p) throw notFound("Property");
    }
    const [document] = await db.update(documents).set(req.body).where(eq(documents.id, doc.id)).returning();
    return { document };
  });

  app.delete("/documents/:id", { schema: { params: idParams } }, async (req, reply) => {
    const doc = await documentWithAccess(req.advocateId, req.params.id, "write");
    await db.delete(documents).where(eq(documents.id, doc.id));
    await getServices().storage.deletePrefix(keys.document(doc.case.advocateId, doc.caseId, doc.id));
    logAccess(req, "document.delete", "document", doc.id);
    return reply.code(204).send();
  });

  /**
   * Upload one page image (multipart field "page"). Idempotent per page number: re-sending the
   * same pageNo after a dropped connection replaces that page and queues OCR again.
   */
  app.post(
    "/documents/:id/pages",
    { schema: { params: idParams, querystring: z.object({ pageNo: z.coerce.number().int().min(1).max(PAGE_UPLOAD.maxPages) }) } },
    async (req, reply) => {
      const doc = await documentWithAccess(req.advocateId, req.params.id, "write");
      const file = await req.file({ limits: { fileSize: PAGE_UPLOAD.maxBytes, files: 1, fields: 0 } });
      if (!file) throw new HttpError(400, "invalid_input", "Attach the page image as multipart field 'page'");
      if (!(PAGE_UPLOAD.types as readonly string[]).includes(file.mimetype)) {
        throw new HttpError(415, "unsupported_type", "Pages must be JPEG, PNG or WebP images");
      }
      const raw = await file.toBuffer(); // throws 413 past the size limit

      let image: { data: Buffer; info: OutputInfo };
      try {
        image = await sharp(raw, { failOn: "error" })
          .rotate()
          .resize({ width: STORED_MAX_SIDE, height: STORED_MAX_SIDE, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
      } catch {
        throw new HttpError(422, "invalid_image", "This file is not a readable image");
      }

      const { pageNo } = req.query;
      const existing = await db.query.pages.findFirst({
        where: and(eq(pages.documentId, doc.id), eq(pages.pageNo, pageNo)),
        columns: { id: true },
      });
      // New pages count towards the plan of the case owner (juniors scan into the senior's plan).
      if (!existing) await assertPageQuota(doc.case.advocateId, image.data.length);
      const pageId = existing?.id ?? randomUUID();
      // Key uses the case owner's id, so deleting the owner's account removes every page.
      const storageKey = keys.page(doc.case.advocateId, doc.caseId, doc.id, pageId);
      const { storage, ocrQueue } = getServices();
      await storage.put(storageKey, image.data);

      const reset = {
        storageKey,
        byteSize: image.data.length,
        width: image.info.width,
        height: image.info.height,
        ocrStatus: "PENDING" as const,
        ocrEngine: null,
        ocrRoute: null,
        ocrText: null,
        ocrConfidence: null,
        ocrWords: null,
        ocrError: null,
        ocrAt: null,
      };
      const [page] = await db
        .insert(pages)
        .values({ id: pageId, documentId: doc.id, pageNo, ...reset })
        // A re-upload bumps the version, so an OCR job still reading the old image won't save.
        .onConflictDoUpdate({ target: [pages.documentId, pages.pageNo], set: { ...reset, version: sql`${pages.version} + 1` } })
        .returning(pageReturning);
      await rollUpDocumentStatus(db, doc.id);
      await enqueueOcr(ocrQueue, page.id);
      return reply.code(existing ? 200 : 201).send({ page });
    },
  );

  /** The decrypted page image. Never cached by browsers or proxies; every view is logged. */
  app.get("/documents/:id/pages/:pageId/image", { schema: { params: pageParams } }, async (req, reply) => {
    const doc = await documentWithAccess(req.advocateId, req.params.id);
    const page = await db.query.pages.findFirst({ where: and(eq(pages.id, req.params.pageId), eq(pages.documentId, doc.id)) });
    if (!page) throw notFound("Page");
    const image = await getServices().storage.get(page.storageKey);
    logAccess(req, "page.view", "page", page.id);
    return reply
      .header("Content-Type", "image/jpeg")
      .header("Cache-Control", "private, no-store")
      .header("Cross-Origin-Resource-Policy", "same-site")
      .send(image);
  });

  app.delete("/documents/:id/pages/:pageId", { schema: { params: pageParams } }, async (req, reply) => {
    const doc = await documentWithAccess(req.advocateId, req.params.id, "write");
    const [page] = await db
      .delete(pages)
      .where(and(eq(pages.id, req.params.pageId), eq(pages.documentId, doc.id)))
      .returning({ storageKey: pages.storageKey });
    if (!page) throw notFound("Page");
    await getServices().storage.delete(page.storageKey);
    await rollUpDocumentStatus(db, doc.id);
    return reply.code(204).send();
  });

  /** Re-run OCR on a page (after a failure, or once a better engine is configured). */
  app.post("/documents/:id/pages/:pageId/ocr", { schema: { params: pageParams } }, async (req) => {
    const doc = await documentWithAccess(req.advocateId, req.params.id, "write");
    const [page] = await db
      .update(pages)
      .set({ ocrStatus: "PENDING", ocrError: null, version: sql`${pages.version} + 1` })
      .where(and(eq(pages.id, req.params.pageId), eq(pages.documentId, doc.id)))
      .returning(pageReturning);
    if (!page) throw notFound("Page");
    await rollUpDocumentStatus(db, doc.id);
    await enqueueOcr(getServices().ocrQueue, page.id);
    return { page };
  });

  /** Search the OCR text of every page the advocate can see (optionally one case). */
  app.get("/search", { schema: { querystring: textSearchQuery } }, async (req) => {
    const q = req.query.q.normalize("NFC");
    const rows = await db
      .select({
        pageId: pages.id,
        pageNo: pages.pageNo,
        ocrText: pages.ocrText,
        documentId: documents.id,
        documentType: documents.type,
        documentTitle: documents.title,
        caseId: cases.id,
        caseTitle: cases.title,
      })
      .from(pages)
      .innerJoin(documents, eq(pages.documentId, documents.id))
      .innerJoin(cases, eq(documents.caseId, cases.id))
      .where(
        and(
          visibleCase(req.advocateId),
          req.query.caseId ? eq(cases.id, req.query.caseId) : undefined,
          ilike(pages.ocrText, likePattern(q)),
        ),
      )
      .orderBy(desc(documents.createdAt), asc(pages.pageNo))
      .limit(50);
    const hits: SearchHit[] = rows.map(({ ocrText, ...r }) => ({ ...r, ...makeSnippet(ocrText ?? "", q) }));
    return { hits };
  });
};
