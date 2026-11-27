/**
 * AI drafting: the advocate picks what to draft and writes instructions; the drafting model
 * writes a first draft, streamed to the screen as it is written and saved as it goes, which the
 * advocate then edits, copies or downloads as Word. Title search reports have their own routes.
 */
import { Readable } from "node:stream";
import { streamText } from "@vakilmitra/ai";
import { advocates, and, cases, drafts, eq, ne, sql } from "@vakilmitra/db";
import { type Draft, type DraftKind, draftFormInput, draftGenerateInput, draftUpdateInput, type Locale } from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { type CaseContext, draftMessage, draftPrompt, plainText } from "../ai/draft.js";
import { draftDocx } from "../ai/draft-docx.js";
import { draftForm } from "../ai/forms.js";
import { db } from "../db.js";
import { logAccess, requireCaseAccess } from "../lib/access.js";
import { aiHttpError, assertAiAllowed, countAiUse, noteAiModel } from "../lib/ai.js";
import { notFound } from "../lib/http.js";
import { ai } from "../services.js";

/** Title search reports live in the draft table too, but are edited and signed on the report page. */
const TSR = "TSR";

type DraftRow = typeof drafts.$inferSelect;
interface DraftValues {
  instructions?: string;
  useCaseDetails?: boolean;
  model?: string;
  /** Started from a blank form rather than written by AI. */
  form?: boolean;
}

function toDraft(d: DraftRow): Draft {
  const v = (d.values ?? {}) as DraftValues;
  return {
    id: d.id,
    caseId: d.caseId,
    kind: d.template as DraftKind,
    language: d.language,
    title: d.title,
    body: d.body,
    instructions: v.instructions ?? null,
    model: v.model ?? null,
    source: v.form ? "form" : "ai",
    version: d.version,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

/** Load a draft (never a title search report) with the access check done through its case. */
async function draftWithAccess(advocateId: string, id: string, need: "read" | "write" = "read") {
  const d = await db.query.drafts.findFirst({ where: and(eq(drafts.id, id), ne(drafts.template, TSR)) });
  if (!d) throw notFound("Draft");
  await requireCaseAccess(advocateId, d.caseId, need);
  return d;
}

const KIND_TITLE: Record<Locale, Record<DraftKind, string>> = {
  en: {
    PUBLIC_NOTICE: "Public notice",
    LEGAL_NOTICE: "Legal notice",
    NOTICE_REPLY: "Reply to notice",
    PLAINT: "Plaint",
    WRITTEN_STATEMENT: "Written statement",
    AFFIDAVIT: "Affidavit",
    APPLICATION: "Application",
    OTHER: "Draft",
  },
  mr: {
    PUBLIC_NOTICE: "जाहीर नोटीस",
    LEGAL_NOTICE: "कायदेशीर नोटीस",
    NOTICE_REPLY: "नोटिशीला उत्तर",
    PLAINT: "वादपत्र",
    WRITTEN_STATEMENT: "लेखी कैफियत",
    AFFIDAVIT: "प्रतिज्ञापत्र",
    APPLICATION: "अर्ज",
    OTHER: "मसुदा",
  },
};

/** How often a draft being written is saved, so a dropped connection loses little. */
const SAVE_EVERY_MS = 3_000;

const idParams = z.object({ id: z.string() });

/** The case with what a draft can use: client, parties, properties. */
const caseForDraft = (caseId: string) =>
  db.query.cases.findFirst({
    where: eq(cases.id, caseId),
    with: {
      client: { columns: { name: true, address: true } },
      parties: { columns: { name: true, role: true, isOurClient: true, address: true, opposingCounsel: true } },
      properties: { columns: { surveyNo: true, gatNo: true, hissaNo: true, village: true, taluka: true, district: true } },
    },
  });

/** The advocate who asks signs: a junior drafting on a senior's case signs their own. */
const signer = (advocateId: string) =>
  db.query.advocates.findFirst({
    where: eq(advocates.id, advocateId),
    columns: { name: true, barCouncilNo: true, phone: true },
  });

export const draftRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Write a new draft with the drafting model. Answers with the text as it is written
   * (text/plain, streamed); the new draft's id is in the X-Draft-Id header.
   */
  app.post(
    "/cases/:caseId/drafts/generate",
    { schema: { params: z.object({ caseId: z.string() }), body: draftGenerateInput } },
    async (req, reply) => {
      const { caseId } = req.params;
      // Until a draft exists, the entry is about the case (a refused attempt stays that way).
      logAccess(req, "draft.generate", "case", caseId);
      await requireCaseAccess(req.advocateId, caseId, "write");
      const { kind, language, instructions, useCaseDetails } = req.body;
      const c = await caseForDraft(caseId);
      if (!c) throw notFound("Case");
      const ownerId = c.advocateId;
      req.audit.details = { kind, language, useCaseDetails };
      await assertAiAllowed(req, "drafting", ownerId);

      const me = await signer(req.advocateId);
      const ctx: CaseContext | null = useCaseDetails ? c : null;
      const abort = new AbortController();
      // The response closing before it finished means the advocate left: stop the model.
      reply.raw.on("close", () => {
        if (!reply.raw.writableFinished) abort.abort();
      });

      let stream: Awaited<ReturnType<ReturnType<typeof ai>["stream"]>>;
      try {
        stream = await ai().stream("drafting", (model) =>
          streamText({
            model,
            system: draftPrompt(kind, language),
            prompt: draftMessage(instructions, me!, ctx),
            maxOutputTokens: 12_000,
            maxRetries: 1,
            abortSignal: abort.signal,
          }),
        );
      } catch (err) {
        throw aiHttpError(req, err);
      }
      noteAiModel(req, stream.model);

      const title = `${KIND_TITLE[language][kind]} · ${c.title}`.slice(0, 200);
      const values: DraftValues = { instructions, useCaseDetails, model: stream.model.id };
      const [row] = await db
        .insert(drafts)
        .values({ caseId, template: kind, language, title, body: "", values })
        .returning({ id: drafts.id });
      const draftId = row!.id;
      Object.assign(req.audit, { entityType: "draft", entityId: draftId });

      const save = (body: string) =>
        db
          .update(drafts)
          .set({ body: plainText(body) })
          .where(eq(drafts.id, draftId));
      const advocateId = req.advocateId;
      const log = req.log;
      async function* write() {
        let body = "";
        let saved = Date.now();
        try {
          for await (const chunk of stream.text) {
            body += chunk;
            yield chunk;
            if (Date.now() - saved > SAVE_EVERY_MS) {
              saved = Date.now();
              await save(body);
            }
          }
        } finally {
          // Also on a dropped connection or a model failing partway: keep what was written.
          await save(body).catch((err) => log.error({ err }, "draft save failed"));
          const usage = await Promise.resolve(stream.usage).catch(() => undefined);
          await countAiUse(advocateId, "drafting", ownerId, stream.model, usage).catch((err) => log.error({ err }, "AI usage not counted"));
        }
      }
      return reply
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Cache-Control", "no-store")
        .header("X-Accel-Buffering", "no")
        .header("X-Draft-Id", draftId)
        .send(Readable.from(write()));
    },
  );

  /**
   * Start a plaint or written statement from the blank form: every part the Code asks for, the
   * case's court, number, parties and properties filled in, and [blanks] for the facts. No AI.
   */
  app.post(
    "/cases/:caseId/drafts/form",
    { schema: { params: z.object({ caseId: z.string() }), body: draftFormInput } },
    async (req, reply) => {
      const { caseId } = req.params;
      logAccess(req, "draft.create", "case", caseId);
      await requireCaseAccess(req.advocateId, caseId, "write");
      const { kind, language } = req.body;
      req.audit.details = { kind, language, form: true };
      const c = await caseForDraft(caseId);
      if (!c) throw notFound("Case");
      const me = await signer(req.advocateId);
      const values: DraftValues = { form: true };
      const [row] = await db
        .insert(drafts)
        .values({
          caseId,
          template: kind,
          language,
          title: `${KIND_TITLE[language][kind]} · ${c.title}`.slice(0, 200),
          body: draftForm(kind, language, c, me!),
          values,
        })
        .returning();
      Object.assign(req.audit, { entityType: "draft", entityId: row!.id });
      return reply.code(201).send({ draft: toDraft(row!) });
    },
  );

  app.get("/drafts/:id", { schema: { params: idParams } }, async (req) => {
    const d = await draftWithAccess(req.advocateId, req.params.id);
    logAccess(req, "draft.view", "draft", d.id);
    return { draft: toDraft(d) };
  });

  app.patch("/drafts/:id", { schema: { params: idParams, body: draftUpdateInput } }, async (req) => {
    const d = await draftWithAccess(req.advocateId, req.params.id, "write");
    const [row] = await db
      .update(drafts)
      .set({ ...req.body, version: sql`${drafts.version} + 1` })
      .where(eq(drafts.id, d.id))
      .returning();
    return { draft: toDraft(row!) };
  });

  app.delete("/drafts/:id", { schema: { params: idParams } }, async (req, reply) => {
    const d = await draftWithAccess(req.advocateId, req.params.id, "write");
    await db.delete(drafts).where(eq(drafts.id, d.id));
    return reply.code(204).send();
  });

  /** The draft as a Word file, to finish in Word and print on letterhead. */
  app.get("/drafts/:id/docx", { schema: { params: idParams } }, async (req, reply) => {
    const d = await draftWithAccess(req.advocateId, req.params.id);
    logAccess(req, "draft.export", "draft", d.id);
    const file = await draftDocx(d.title, d.body, d.language);
    const name = `${
      d.title
        .replace(/[^\p{L}\p{M}\p{N} ._-]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim() || "draft"
    }.docx`;
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("Content-Disposition", `attachment; filename="draft.docx"; filename*=UTF-8''${encodeURIComponent(name)}`)
      .header("Cache-Control", "private, no-store")
      .send(file);
  });
};
