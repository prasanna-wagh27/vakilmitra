import { readFile } from "node:fs/promises";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  createEngine,
  GeminiEngine,
  markdownToText,
  type OcrEngine,
  type OcrResult,
  ocrEnv,
  readPage,
  SarvamEngine,
} from "../src/index.js";

const fixture = await readFile(new URL("./fixtures/satbara.png", import.meta.url));

describe("SarvamEngine (REST, mocked server)", () => {
  it("runs parse -> status polling -> results with Marathi settings", async () => {
    const calls: { url: string; method: string; key: string | null; form?: Record<string, string> }[] = [];
    let polls = 0;
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const entry: (typeof calls)[number] = { url, method: init?.method ?? "GET", key: headers.get("api-subscription-key") };
      if (init?.body instanceof FormData) {
        entry.form = Object.fromEntries(
          [...init.body.entries()].map(([k, v]) => [k, typeof v === "string" ? v : `<file ${(v as File).type}>`]),
        );
      }
      calls.push(entry);
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
      if (url.endsWith("/doc-ai/v1/job/parse")) return json({ job_id: "job1", status: "accepted", run_id: "r1" });
      if (url.endsWith("/job/job1/status")) return json({ job_id: "job1", status: ++polls < 2 ? "running" : "completed", usage: {} });
      if (url.includes("/job/job1/results")) {
        return json({
          job_id: "job1",
          status: "completed",
          documents: [
            { pages: [{ page_number: 1, content: "# गाव नमुना सात\n\n| गट क्रमांक | ११२ |\n|---|---|\n| भोगवटादार | **सुरेश जाधव** |" }] },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const engine = new SarvamEngine({ apiKey: "test-key", fetch: fakeFetch, pollMs: 1 });
    const r = await engine.recognize(fixture, { contentType: "handwritten" });
    expect(engine.external).toBe(true);
    expect(r.text).toBe("गाव नमुना सात\n\nगट क्रमांक | ११२\nभोगवटादार | सुरेश जाधव");
    expect(r.confidence).toBeNull();
    expect(calls[0]).toMatchObject({
      url: "https://api.sarvam.ai/doc-ai/v1/job/parse",
      method: "POST",
      key: "test-key",
      form: { file: "<file image/jpeg>", language: "mr-IN", content_type: "handwritten" },
    });
    expect(calls.at(-1)?.url).toBe("https://api.sarvam.ai/doc-ai/v1/job/job1/results?format=md");
    expect(calls.every((c) => c.key === "test-key")).toBe(true);
  });

  it("fails clearly on a rejected job and on HTTP errors", async () => {
    const rejected = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/parse")) return Response.json({ job_id: "j" });
      return Response.json({ status: "rejected" });
    }) as typeof fetch;
    await expect(new SarvamEngine({ apiKey: "k", fetch: rejected, pollMs: 1 }).recognize(fixture)).rejects.toThrow(/rejected/);

    const unauthorized = (async () => new Response("bad key", { status: 403 })) as unknown as typeof fetch;
    await expect(new SarvamEngine({ apiKey: "k", fetch: unauthorized }).recognize(fixture)).rejects.toThrow(/403/);
  });

  it("turns Markdown and HTML tables into plain text", () => {
    expect(markdownToText("<table><tr><td>गट</td><td>112</td></tr></table>")).toBe("गट | 112");
  });
});

describe("GeminiEngine (AI SDK, mock model)", () => {
  it("sends the image with the transcription rules and maps lines to boxes and confidence", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              lines: [
                { text: "गट क्रमांक : ११२", box_2d: [100, 50, 140, 400], legibility: "clear" },
                { text: "भोगवटादार : सुरेश [?]", box_2d: [200, 50, 240, 500], legibility: "unclear" },
              ],
            }),
          },
        ],
        finishReason: { unified: "stop", raw: "STOP" },
        usage: {
          inputTokens: { total: 1200, noCache: 1200, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 80, text: 80, reasoning: 0 },
        },
        warnings: [],
      },
    });
    const engine = new GeminiEngine({ provider: "custom", model, name: "gemini-test" });
    const r = await engine.recognize(fixture);
    expect(r.text).toBe("गट क्रमांक : ११२\nभोगवटादार : सुरेश [?]");
    expect(r.words[0]).toEqual({ t: "गट क्रमांक : ११२", c: 0.95, b: [0.05, 0.1, 0.4, 0.14] });
    expect(r.words[1].c).toBe(0.6); // unclear and has [?]
    expect(r.confidence).toBeCloseTo(0.775);

    const call = model.doGenerateCalls[0];
    type Part = { type: string; mediaType?: string };
    const parts: Part[] = call.prompt.flatMap((m) => (Array.isArray(m.content) ? (m.content as Part[]) : []));
    expect(parts.some((p) => p.type === "file" && String(p.mediaType).startsWith("image/"))).toBe(true);
    expect(JSON.stringify(call.prompt)).toContain("Never guess a name or a number");
    expect(call.responseFormat?.type).toBe("json");
    expect(call.temperature).toBe(0);
  });
});

describe("readPage policy", () => {
  const box = { t: "w", c: 0.4, b: [0, 0, 0.1, 0.1] as [number, number, number, number] };
  const fake = (name: string, external: boolean, confidence: number | null, fail = false, text = name): OcrEngine & { calls: number } => ({
    name,
    external,
    calls: 0,
    async recognize(): Promise<OcrResult> {
      this.calls++;
      if (fail) throw new Error(`${name} down`);
      return { engine: name, text, confidence, words: external ? [] : [box], width: 1, height: 1 };
    },
    async close() {},
  });
  const img = Buffer.from("x");

  it("never sends a page to the cloud without consent", async () => {
    const local = fake("local", false, 0.3);
    const cloud = fake("cloud", true, null);
    const r = await readPage({ local, cloud, mode: "always", below: 0.85 }, img, { cloudAllowed: false });
    expect(r.route).toBe("local:no-consent");
    expect(cloud.calls).toBe(0);
  });

  it("in fallback mode keeps confident local reads and escalates unsure ones", async () => {
    const cloud = fake("cloud", true, null);
    const confident = await readPage({ local: fake("local", false, 0.93), cloud, mode: "fallback", below: 0.85 }, img, {
      cloudAllowed: true,
    });
    expect(confident.route).toBe("local:confident");
    expect(cloud.calls).toBe(0);
    const unsure = await readPage({ local: fake("local", false, 0.5), cloud, mode: "fallback", below: 0.85 }, img, { cloudAllowed: true });
    expect(unsure).toMatchObject({ route: "cloud", localConfidence: 0.5, result: { engine: "cloud" } });
  });

  it("in always mode uses the cloud engine even for confident pages", async () => {
    const r = await readPage({ local: fake("local", false, 0.99), cloud: fake("cloud", true, 0.9), mode: "always", below: 0.85 }, img, {
      cloudAllowed: true,
    });
    expect(r.route).toBe("cloud");
  });

  it("keeps the local reading when the cloud engine returns no text", async () => {
    const r = await readPage(
      { local: fake("local", false, 0.5), cloud: fake("cloud", true, 0.9, false, "  \n "), mode: "fallback", below: 0.85 },
      img,
      {
        cloudAllowed: true,
      },
    );
    expect(r).toMatchObject({ route: "local:cloud-empty", result: { engine: "local", text: "local" } });
  });

  it("keeps local word boxes when the cloud engine has none", async () => {
    const r = await readPage({ local: fake("local", false, 0.5), cloud: fake("cloud", true, null), mode: "fallback", below: 0.85 }, img, {
      cloudAllowed: true,
    });
    expect(r.result).toMatchObject({ engine: "cloud", text: "cloud", words: [box] });
  });

  it("records the send before it happens, and sends nothing if recording fails", async () => {
    const order: string[] = [];
    const cloud = fake("cloud", true, null);
    const orig = cloud.recognize.bind(cloud);
    cloud.recognize = async (...a) => {
      order.push("send");
      return orig(...a);
    };
    await readPage({ local: fake("local", false, 0.5), cloud, mode: "fallback", below: 0.85 }, img, {
      cloudAllowed: true,
      beforeCloudSend: async (engine) => void order.push(`audit:${engine}`),
    });
    expect(order).toEqual(["audit:cloud", "send"]);

    const cloud2 = fake("cloud", true, null);
    const failing = readPage({ local: fake("local", false, 0.5), cloud: cloud2, mode: "always", below: 0.85 }, img, {
      cloudAllowed: true,
      beforeCloudSend: async () => {
        throw new Error("audit db down");
      },
    });
    await expect(failing).rejects.toThrow("audit db down");
    expect(cloud2.calls).toBe(0);
  });

  it("keeps the local read when the cloud engine fails", async () => {
    const r = await readPage(
      { local: fake("local", false, 0.4), cloud: fake("cloud", true, null, true), mode: "fallback", below: 0.85 },
      img,
      { cloudAllowed: true },
    );
    expect(r).toMatchObject({ route: "local:cloud-failed", cloudError: "cloud down", result: { engine: "local" } });
  });

  it("works with no cloud engine configured", async () => {
    const r = await readPage({ local: fake("local", false, 0.4), cloud: null, mode: "fallback", below: 0.85 }, img, { cloudAllowed: true });
    expect(r.route).toBe("local");
  });
});

describe("createEngine", () => {
  it("rejects unknown engine names instead of falling through to a cloud engine", () => {
    const env = ocrEnv({ GEMINI_PROVIDER: "google", GOOGLE_GENERATIVE_AI_API_KEY: "x" });
    expect(() => createEngine("sarvan", env)).toThrow(/Unknown OCR engine "sarvan"/);
    expect(createEngine("gemini", env).name).toBe("gemini-api:gemini-3.5-flash");
    expect(createEngine("tesseract", env).external).toBe(false);
  });
});
