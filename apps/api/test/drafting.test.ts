import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ai, aiConfigFromEnv } from "@vakilmitra/ai";
import { accessLogs, aiUsage, and, drafts, eq } from "@vakilmitra/db";
import { FsBlobStore, parseMasterKeys, SecureStorage } from "@vakilmitra/storage";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import JSZip from "jszip";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { draftMessage, plainText } from "../src/ai/draft.js";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { setServices } from "../src/services.js";

const usage = {
  inputTokens: { total: 400, noCache: 400, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 300, text: 300, reasoning: undefined },
};
const DRAFT = ["जाहीर नोटीस\n", "सर्व लोकांना कळविण्यात येते की, ", "मौजे माळेगाव येथील गट नं. ११२ ", "ही मिळकत [मालकाचे नाव] यांच्या मालकीची आहे."];
const calls: { system: string; prompt: string }[] = [];
let failFirst = false;
let breakMidway = false;
const model = (modelId: string) =>
  new MockLanguageModelV4({
    modelId,
    doStream: async (opts) => {
      if (failFirst && modelId === "first") throw new Error("overloaded");
      const system = opts.prompt.find((m) => m.role === "system")?.content as string;
      const user = opts.prompt.find((m) => m.role === "user")!.content as { text: string }[];
      calls.push({ system, prompt: user.map((p) => p.text).join("") });
      const deltas = DRAFT.map((delta) => ({ type: "text-delta" as const, id: "1", delta }));
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start" as const, id: "1" },
            ...(breakMidway ? [deltas[0]!, deltas[1]!, { type: "error" as const, error: new Error("connection reset") }] : deltas),
            { type: "text-end" as const, id: "1" },
            { type: "finish" as const, finishReason: { unified: "stop" as const, raw: "stop" }, usage },
          ],
        }),
      };
    },
  });

const cfg = aiConfigFromEnv({ AI_MODEL_DRAFTING: "vertex:first, anthropic:second", GOOGLE_VERTEX_PROJECT: "p", ANTHROPIC_API_KEY: "k" });
setServices({
  storage: new SecureStorage(
    new FsBlobStore(mkdtempSync(join(tmpdir(), "vm-dr-"))),
    parseMasterKeys(`k1:${randomBytes(32).toString("base64")}`),
  ),
  ocrQueue: { add: async () => undefined } as never,
  ai: new Ai(cfg, (spec) => model(spec.model)),
});

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
async function signup(email: string, name = "Adv. Draft") {
  const agent = request.agent(app.server).set("Origin", ORIGIN);
  expect((await agent.post("/api/auth/sign-up/email").send({ name, email, password: "password123" })).status).toBe(200);
  return agent;
}

let owner: ReturnType<typeof request.agent>;
let junior: ReturnType<typeof request.agent>;
let ownerId: string;
let caseId: string;
let draftId: string;
const generate = (agent = owner, body: Record<string, unknown> = {}) =>
  agent
    .post(`/api/cases/${caseId}/drafts/generate`)
    .send({ kind: "PUBLIC_NOTICE", language: "mr", instructions: "गट नं. ११२ खरेदीपूर्वी जाहीर नोटीस, हरकतीसाठी १४ दिवस", ...body })
    .buffer(true)
    .parse((res, cb) => {
      let s = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => (s += c));
      res.on("end", () => cb(null, s));
      res.on("error", () => cb(null, s));
    });

beforeAll(async () => {
  owner = await signup(`dr-owner-${stamp}@example.com`, "Adv. Asha Kulkarni");
  junior = await signup(`dr-junior-${stamp}@example.com`, "Adv. Ravi Pawar");
  ownerId = (await owner.get("/api/me")).body.advocate.id;
  await owner.patch("/api/me").send({ barCouncilNo: "MAH/1234/2010" });
  caseId = (await owner.post("/api/cases").send({ title: "Malegaon purchase", court: "Civil Judge, Baramati" })).body.case.id;
  await owner.post(`/api/cases/${caseId}/parties`).send({ name: "Suresh Jadhav", role: "OTHER" });
  await owner.post(`/api/cases/${caseId}/properties`).send({ gatNo: "112", village: "Malegaon", taluka: "Baramati", district: "Pune" });
});

beforeEach(() => {
  calls.length = 0;
  failFirst = false;
  breakMidway = false;
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("drafting", () => {
  it("needs the case owner's AI consent", async () => {
    const r = await owner
      .post(`/api/cases/${caseId}/drafts/generate`)
      .send({ kind: "AFFIDAVIT", language: "en", instructions: "An affidavit of no objection" });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("ai_consent_required");
    expect(calls).toHaveLength(0);
    const [refused] = await db
      .select()
      .from(accessLogs)
      .where(and(eq(accessLogs.advocateId, ownerId), eq(accessLogs.status, 403)));
    expect(refused).toMatchObject({ action: "draft.generate", entityType: "case", entityId: caseId });
    await owner.patch("/api/me").send({ aiConsent: true });
  });

  it("streams a draft written from the instructions and the case, and saves it", async () => {
    const r = await generate();
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/^text\/plain/);
    expect(r.body).toBe(DRAFT.join(""));
    draftId = r.headers["x-draft-id"];
    expect(draftId).toBeTruthy();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.system).toMatch(/public notice/i);
    expect(calls[0]!.system).toContain("Marathi");
    expect(calls[0]!.system).toMatch(/Never invent names/);
    expect(calls[0]!.prompt).toContain("Adv. Asha Kulkarni");
    expect(calls[0]!.prompt).toContain("MAH/1234/2010");
    expect(calls[0]!.prompt).toContain("Court: Civil Judge, Baramati");
    expect(calls[0]!.prompt).toContain("Party: Suresh Jadhav");
    expect(calls[0]!.prompt).toContain("gat no. 112, village Malegaon, taluka Baramati, district Pune");
    expect(calls[0]!.prompt).toContain("हरकतीसाठी १४ दिवस");

    const d = await owner.get(`/api/drafts/${draftId}`);
    expect(d.body.draft).toMatchObject({
      caseId,
      kind: "PUBLIC_NOTICE",
      language: "mr",
      title: "जाहीर नोटीस · Malegaon purchase",
      body: DRAFT.join("").trim(),
      model: "vertex:first",
      instructions: expect.stringContaining("जाहीर नोटीस"),
    });

    const [row] = await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.ownerId, ownerId), eq(aiUsage.task, "drafting")));
    expect(row).toMatchObject({ model: "vertex:first", inputTokens: 400, outputTokens: 300 });
    const [log] = await db
      .select()
      .from(accessLogs)
      .where(and(eq(accessLogs.advocateId, ownerId), eq(accessLogs.action, "draft.generate"), eq(accessLogs.status, 200)));
    expect(log).toMatchObject({ entityType: "draft", entityId: draftId, caseId });
    expect(log!.details).toMatchObject({ kind: "PUBLIC_NOTICE", model: "vertex:first", dataLocation: "india" });
    expect(JSON.stringify(log!.details)).not.toContain("गट");
  });

  it("leaves the case out when asked", async () => {
    await generate(owner, { useCaseDetails: false, language: "en", kind: "LEGAL_NOTICE" });
    expect(calls[0]!.prompt).not.toContain("Suresh Jadhav");
    expect(calls[0]!.prompt).toContain("Adv. Asha Kulkarni"); // the signature block still has the advocate
    expect(calls[0]!.system).toMatch(/legal notice/i);
  });

  it("moves to the next model when the first cannot start", async () => {
    failFirst = true;
    const r = await generate();
    expect(r.status).toBe(200);
    const d = await owner.get(`/api/drafts/${r.headers["x-draft-id"]}`);
    expect(d.body.draft.model).toBe("anthropic:second");
  });

  it("keeps what was written when the model fails partway", async () => {
    breakMidway = true;
    const r = await generate();
    const id = r.headers["x-draft-id"];
    expect(r.body).toBe(DRAFT[0]! + DRAFT[1]!);
    await new Promise((ok) => setTimeout(ok, 100));
    const [row] = await db.select().from(drafts).where(eq(drafts.id, id));
    expect(row!.body).toBe((DRAFT[0]! + DRAFT[1]!).trim());
  });

  it("lists drafts on the case, but not title search reports", async () => {
    const c = await owner.get(`/api/cases/${caseId}`);
    expect(c.body.case.drafts.length).toBeGreaterThanOrEqual(3);
    expect(c.body.case.drafts.every((d: { template: string }) => d.template !== "TSR")).toBe(true);
    await db.insert(drafts).values({ caseId, template: "TSR", title: "Title search report", body: "" });
    const again = await owner.get(`/api/cases/${caseId}`);
    expect(again.body.case.drafts.some((d: { template: string }) => d.template === "TSR")).toBe(false);
    const [tsr] = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.caseId, caseId), eq(drafts.template, "TSR")));
    expect((await owner.get(`/api/drafts/${tsr!.id}`)).status).toBe(404);
  });

  it("saves the advocate's edits and exports Word", async () => {
    const r = await owner.patch(`/api/drafts/${draftId}`).send({ title: "जाहीर नोटीस — गट ११२", body: "जाहीर नोटीस\nसुधारित मजकूर" });
    expect(r.status).toBe(200);
    expect(r.body.draft).toMatchObject({ title: "जाहीर नोटीस — गट ११२", body: "जाहीर नोटीस\nसुधारित मजकूर", version: 2 });

    const doc = await owner
      .get(`/api/drafts/${draftId}/docx`)
      .buffer(true)
      .parse((res, cb) => {
        const parts: Buffer[] = [];
        res.on("data", (c: Buffer) => parts.push(c));
        res.on("end", () => cb(null, Buffer.concat(parts)));
      });
    expect(doc.status).toBe(200);
    expect(doc.headers["content-disposition"]).toContain("filename*=UTF-8''");
    const xml = await (await JSZip.loadAsync(doc.body as Buffer)).file("word/document.xml")!.async("string");
    expect(xml).toContain("सुधारित मजकूर");
    expect(xml).toContain("Nirmala UI");
  });

  it("lets juniors with access read, editors draft, and keeps everyone else out", async () => {
    expect((await junior.get(`/api/drafts/${draftId}`)).status).toBe(404);
    await owner.post(`/api/cases/${caseId}/grants`).send({ email: `dr-junior-${stamp}@example.com`, role: "VIEWER" });
    expect((await junior.get(`/api/drafts/${draftId}`)).status).toBe(200);
    expect((await junior.patch(`/api/drafts/${draftId}`).send({ body: "x" })).status).toBe(403);
    expect(
      (
        await junior
          .post(`/api/cases/${caseId}/drafts/generate`)
          .send({ kind: "OTHER", language: "en", instructions: "A short covering letter" })
      ).status,
    ).toBe(403);

    await owner.post(`/api/cases/${caseId}/grants`).send({ email: `dr-junior-${stamp}@example.com`, role: "EDITOR" });
    const r = await generate(junior);
    expect(r.status).toBe(200);
    expect(calls[0]!.prompt).toContain("Adv. Ravi Pawar"); // signed by whoever drafts it
    const juniorId = (await junior.get("/api/me")).body.advocate.id;
    const [row] = await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.advocateId, juniorId), eq(aiUsage.task, "drafting")));
    expect(row?.ownerId).toBe(ownerId);
  });

  it("deletes a draft", async () => {
    expect((await owner.delete(`/api/drafts/${draftId}`)).status).toBe(204);
    expect((await owner.get(`/api/drafts/${draftId}`)).status).toBe(404);
  });
});

describe("drafting prompt", () => {
  it("strips Markdown the model adds anyway", () => {
    expect(plainText("```\n# NOTICE\n**To,** Mr. X\n```")).toBe("NOTICE\nTo, Mr. X");
  });
  it("leaves out empty case fields", () => {
    const m = draftMessage("Draft it", { name: "Adv. A", barCouncilNo: null, phone: null }, null);
    expect(m).not.toContain("Bar Council");
    expect(m).not.toContain("Case details");
  });
});
