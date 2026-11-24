import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ai, aiConfigFromEnv } from "@vakilmitra/ai";
import { accessLogs, aiUsage, and, desc, documents, eq, pages } from "@vakilmitra/db";
import { PLANS, textLocale as sourceLocale } from "@vakilmitra/shared";
import { FsBlobStore, parseMasterKeys, SecureStorage } from "@vakilmitra/storage";
import { MockLanguageModelV4 } from "ai/test";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { translationPrompt } from "../src/ai/translate.js";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { type Services, setServices } from "../src/services.js";

const usage = {
  inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 80, text: 80, reasoning: undefined },
};
/** What the model was sent, and a switch to make it fail. */
const calls: { system: string; prompt: string; model: string }[] = [];
let failFirst = false;
let failAll = false;
const model = (modelId: string, reply: string) =>
  new MockLanguageModelV4({
    modelId,
    doGenerate: async (opts) => {
      const system = opts.prompt.find((m) => m.role === "system")?.content as string;
      const user = opts.prompt.find((m) => m.role === "user")!.content as { type: string; text: string }[];
      if (failAll || (failFirst && modelId === "first")) throw new Error("upstream 529");
      calls.push({ system, prompt: user.map((p) => p.text).join(""), model: modelId });
      return { content: [{ type: "text", text: reply }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
    },
  });

const cfg = aiConfigFromEnv({
  AI_MODEL_TRANSLATION: "vertex:first, anthropic:second",
  GOOGLE_VERTEX_PROJECT: "p",
  ANTHROPIC_API_KEY: "k",
});
const base: Services = {
  storage: new SecureStorage(
    new FsBlobStore(mkdtempSync(join(tmpdir(), "vm-tr-"))),
    parseMasterKeys(`k1:${randomBytes(32).toString("base64")}`),
  ),
  ocrQueue: { add: async () => undefined } as never,
};
const withAi = (c = cfg) =>
  setServices({
    ...base,
    ai: new Ai(c, (spec) => model(spec.model, spec.model === "first" ? "Village Form Seven\nOccupant: Suresh Jadhav" : "second says")),
  });
withAi();

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MARATHI = "गाव नमुना सात\nभोगवटादाराचे नाव : सुरेश जाधव";

async function signup(email: string) {
  const agent = request.agent(app.server).set("Origin", ORIGIN);
  expect((await agent.post("/api/auth/sign-up/email").send({ name: "Adv. Tr", email, password: "password123" })).status).toBe(200);
  return agent;
}

let owner: ReturnType<typeof request.agent>;
let junior: ReturnType<typeof request.agent>;
let ownerId: string;
let caseId: string;
let docId: string;
let pageId: string;
const url = () => `/api/documents/${docId}/pages/${pageId}/translate`;

beforeAll(async () => {
  owner = await signup(`tr-owner-${stamp}@example.com`);
  junior = await signup(`tr-junior-${stamp}@example.com`);
  ownerId = (await owner.get("/api/me")).body.advocate.id;
  caseId = (await owner.post("/api/cases").send({ title: "Translation case" })).body.case.id;
  const [d] = await db.insert(documents).values({ caseId, type: "SEVEN_TWELVE", ocrStatus: "DONE" }).returning();
  docId = d!.id;
  const [p] = await db
    .insert(pages)
    .values({ documentId: docId, pageNo: 1, storageKey: "x", ocrStatus: "DONE", ocrText: MARATHI })
    .returning();
  pageId = p!.id;
});

beforeEach(() => {
  calls.length = 0;
  failFirst = false;
  failAll = false;
  withAi();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("translation", () => {
  it("says which AI tasks are on and where their models process data", async () => {
    const r = await owner.get("/api/ai");
    expect(r.status).toBe(200);
    expect(r.body.ai.translation).toEqual({
      enabled: true,
      models: [
        { id: "vertex:first", dataLocation: "india" },
        { id: "anthropic:second", dataLocation: "abroad" },
      ],
    });
    expect(r.body.ai.drafting.enabled).toBe(false);
  });

  it("sends nothing until the case owner allows AI, and logs the consent", async () => {
    const r = await owner.post(url()).send({ lang: "en" });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ error: "ai_consent_required", details: { yours: true } });
    expect(calls).toHaveLength(0);

    const on = await owner.patch("/api/me").send({ aiConsent: true });
    expect(on.body.advocate.aiConsent).toBe(true);
    expect(Date.parse(on.body.advocate.aiConsentAt)).toBeGreaterThan(Date.now() - 60_000);
    const logs = await db
      .select()
      .from(accessLogs)
      .where(and(eq(accessLogs.advocateId, ownerId), eq(accessLogs.action, "consent.ai.on")));
    expect(logs).toHaveLength(1);
  });

  it("translates a page, saves it, and counts the call without keeping any text", async () => {
    const r = await owner.post(url()).send({ lang: "en" });
    expect(r.status).toBe(200);
    expect(r.body.translation).toMatchObject({ lang: "en", text: "Village Form Seven\nOccupant: Suresh Jadhav", model: "vertex:first" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.prompt).toBe(MARATHI);
    expect(calls[0]!.system).toContain("into English");
    expect(calls[0]!.system).toMatch(/Never guess a number or a name/);

    const used = await db.select().from(aiUsage).where(eq(aiUsage.ownerId, ownerId));
    expect(used).toHaveLength(1);
    expect(used[0]).toMatchObject({ advocateId: ownerId, task: "translation", model: "vertex:first", inputTokens: 120, outputTokens: 80 });
    expect(JSON.stringify(used)).not.toContain("Suresh");

    const [log] = await db
      .select()
      .from(accessLogs)
      .where(and(eq(accessLogs.advocateId, ownerId), eq(accessLogs.entityId, pageId)))
      .orderBy(desc(accessLogs.at))
      .limit(1);
    expect(log).toMatchObject({ action: "page.translate", caseId, status: 200 });
    expect(log!.details).toMatchObject({ lang: "en", model: "vertex:first", dataLocation: "india" });
    expect(JSON.stringify(log!.details)).not.toContain("Suresh");

    const doc = await owner.get(`/api/documents/${docId}`);
    expect(doc.body.document.pages[0].translations).toEqual([expect.objectContaining({ lang: "en", model: "vertex:first" })]);
  });

  it("gives the saved translation again without calling the model, until asked for a fresh one", async () => {
    const again = await owner.post(url()).send({ lang: "en" });
    expect(again.body.translation.model).toBe("vertex:first");
    expect(calls).toHaveLength(0);

    const fresh = await owner.post(url()).send({ lang: "en", fresh: true });
    expect(fresh.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("drops a translation once the page is read again", async () => {
    await db
      .update(pages)
      .set({ ocrText: `${MARATHI}\nक्षेत्र : १.२०` })
      .where(eq(pages.id, pageId));
    const doc = await owner.get(`/api/documents/${docId}`);
    expect(doc.body.document.pages[0].translations).toEqual([]);
    await owner.post(url()).send({ lang: "en" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.prompt).toContain("क्षेत्र");
  });

  it("moves to the next model when the first fails, and reports when all fail", async () => {
    failFirst = true;
    const r = await owner.post(url()).send({ lang: "en", fresh: true });
    expect(r.status).toBe(200);
    expect(r.body.translation.model).toBe("anthropic:second");

    failAll = true;
    const down = await owner.post(url()).send({ lang: "en", fresh: true });
    expect(down.status).toBe(502);
    expect(down.body.error).toBe("ai_failed");
    expect(down.body.message).not.toContain("upstream");
  });

  it("answers 503 when no translation model is set", async () => {
    withAi(aiConfigFromEnv({}));
    const r = await owner.post(url()).send({ lang: "mr", fresh: true });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("ai_off");
  });

  it("refuses a page with no text yet", async () => {
    const [p] = await db.insert(pages).values({ documentId: docId, pageNo: 2, storageKey: "y", ocrStatus: "PENDING" }).returning();
    const r = await owner.post(`/api/documents/${docId}/pages/${p!.id}/translate`).send({ lang: "en" });
    expect(r.status).toBe(409);
    expect(calls).toHaveLength(0);
  });

  it("lets an editor junior translate on the owner's consent and plan, and keeps others out", async () => {
    expect((await junior.post(url()).send({ lang: "en" })).status).toBe(404);
    await owner.post(`/api/cases/${caseId}/grants`).send({ email: `tr-junior-${stamp}@example.com`, role: "VIEWER" });
    expect((await junior.post(url()).send({ lang: "en" })).status).toBe(403); // viewers read saved translations only
    const doc = await junior.get(`/api/documents/${docId}`);
    expect(doc.body.document.pages[0].translations).toHaveLength(1);

    await owner.post(`/api/cases/${caseId}/grants`).send({ email: `tr-junior-${stamp}@example.com`, role: "EDITOR" });
    const r = await junior.post(url()).send({ lang: "mr" });
    expect(r.status).toBe(200);
    const juniorId = (await junior.get("/api/me")).body.advocate.id;
    const [row] = await db.select().from(aiUsage).where(eq(aiUsage.advocateId, juniorId));
    expect(row?.ownerId).toBe(ownerId); // charged to the senior's plan

    await owner.patch("/api/me").send({ aiConsent: false });
    const off = await junior.post(url()).send({ lang: "mr", fresh: true });
    expect(off.status).toBe(403);
    expect(off.body.details).toEqual({ yours: false });
    await owner.patch("/api/me").send({ aiConsent: true });
  });

  it("stops at the plan's monthly AI limit", async () => {
    const used = (await owner.get("/api/billing")).body.billing.usage.aiThisMonth as number;
    const max = PLANS.TRIAL.limits.aiPerMonth;
    expect(used).toBeGreaterThan(0);
    await db.insert(aiUsage).values(Array.from({ length: max - used }, () => ({ ownerId, task: "translation", model: "vertex:first" })));
    const r = await owner.post(url()).send({ lang: "en", fresh: true });
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({ error: "plan_limit", details: { limit: "aiPerMonth", max } });
    // A saved translation is still free.
    expect((await owner.post(url()).send({ lang: "en" })).status).toBe(200);
  });
});

describe("translation prompt", () => {
  it("tells Marathi from English text", () => {
    expect(sourceLocale(MARATHI)).toBe("mr");
    expect(sourceLocale("IN THE COURT OF CIVIL JUDGE, Baramati. Suit No. 12/2024")).toBe("en");
    expect(sourceLocale("Gat No. 123 गाव माळेगाव तालुका बारामती")).toBe("mr");
  });

  it("asks for Marathi revenue terms when translating into Marathi", () => {
    expect(translationPrompt("mr")).toContain("Marathi");
    expect(translationPrompt("mr")).toContain("फेरफार");
  });
});
