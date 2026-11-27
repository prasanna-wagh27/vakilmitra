/** Plaints and written statements: the blank forms, the parts check, and the model's guidance. */
import { accessLogs, and, eq } from "@vakilmitra/db";
import { checkDraftParts, DRAFT_PARTS, type DraftKind, FORM_KINDS, LOCALES } from "@vakilmitra/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CaseContext, draftPrompt } from "../src/ai/draft.js";
import { draftForm } from "../src/ai/forms.js";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";

const ADVOCATE = { name: "Adv. Asha Kulkarni", barCouncilNo: "MAH/1234/2010", phone: null };
const CASE: CaseContext = {
  title: "Patil v. Jadhav",
  kind: "CIVIL",
  court: "Civil Judge, Junior Division, Baramati",
  caseNumber: "112/2026",
  filedOn: null,
  client: null,
  parties: [
    { name: "Ramesh Patil", role: "PLAINTIFF", isOurClient: true, address: "Malegaon, Baramati", opposingCounsel: null },
    { name: "Suresh Jadhav", role: "DEFENDANT", isOurClient: false, address: null, opposingCounsel: null },
    { name: "Mahesh Jadhav", role: "DEFENDANT", isOurClient: false, address: "Pune", opposingCounsel: null },
  ],
  properties: [{ surveyNo: null, gatNo: "112", hissaNo: "2", village: "Malegaon", taluka: "Baramati", district: "Pune" }],
};

const missing = (kind: DraftKind, body: string) =>
  checkDraftParts(kind, body)!
    .parts.filter((p) => !p.found)
    .map((p) => p.key);

describe("the blank forms", () => {
  for (const kind of FORM_KINDS) {
    for (const language of LOCALES) {
      it(`${kind} in ${language} has every part the check looks for`, () => {
        const body = draftForm(kind, language, CASE, ADVOCATE);
        expect(missing(kind, body)).toEqual([]);
        expect(checkDraftParts(kind, body)!.blanks).toBeGreaterThan(5);
        // The case's own details are filled in, not left blank.
        for (const s of ["Ramesh Patil", "Suresh Jadhav", "Mahesh Jadhav", "112/2026", "Baramati", "Adv. Asha Kulkarni"]) {
          expect(body).toContain(s);
        }
        expect(body).toMatch(/2\. Suresh|2\. Mahesh/); // parties numbered on each side
        // The plaint describes the suit property; the written statement answers the plaint's.
        if (kind === "PLAINT") expect(body).toContain(language === "mr" ? "गट नं. 112" : "Gat No. 112");
      });

      it(`${kind} in ${language} leaves blanks where the case has nothing`, () => {
        const body = draftForm(kind, language, null, ADVOCATE);
        expect(missing(kind, body)).toEqual([]);
        expect(body).toContain(language === "mr" ? "[नाव]" : "[Name]");
        expect(body).toContain(language === "mr" ? "[दिवाणी न्यायाधीश, कनिष्ठ स्तर]" : "[CIVIL JUDGE, JUNIOR DIVISION]");
        // No property schedule without properties.
        expect(body).not.toContain(language === "mr" ? "दाव्याच्या मिळकतीचे वर्णन" : "SCHEDULE OF THE SUIT PROPERTY");
      });
    }
  }

  it("signs the plaint for the plaintiff and the written statement for the defendant", () => {
    expect(draftForm("PLAINT", "mr", CASE, ADVOCATE)).toContain("वादीतर्फे वकील\nAdv. Asha Kulkarni (MAH/1234/2010)");
    expect(draftForm("WRITTEN_STATEMENT", "en", CASE, ADVOCATE)).toContain("Advocate for the defendant\nAdv. Asha Kulkarni");
  });
});

describe("the parts check", () => {
  it("finds what a plaint is missing", () => {
    const full = draftForm("PLAINT", "en", CASE, ADVOCATE);
    const noVerification = full.slice(0, full.indexOf("VERIFICATION"));
    expect(missing("PLAINT", noVerification)).toEqual(expect.arrayContaining(["verification", "affidavit", "documents"]));
    expect(missing("PLAINT", noVerification)).not.toContain("causeOfAction");
  });

  it("does not take a blank for the part written", () => {
    const r = checkDraftParts("PLAINT", "[cause of action]\n[jurisdiction]")!;
    expect(r.parts.find((p) => p.key === "causeOfAction")!.found).toBe(false);
    expect(r.blanks).toBe(2);
  });

  it("tells the plaintiff (वादी) from the defendant (प्रतिवादी) in Marathi", () => {
    const parties = (body: string) => checkDraftParts("PLAINT", body)!.parts.find((p) => p.key === "parties")!.found;
    expect(parties("रमेश पाटील ... प्रतिवादी")).toBe(false);
    expect(parties("रमेश पाटील ... वादी\nविरुद्ध\nसुरेश जाधव ... प्रतिवादी")).toBe(true);
  });

  it("reads a written statement written in other usual words", () => {
    const ws = [
      "IN THE COURT OF THE CIVIL JUDGE SENIOR DIVISION, PUNE",
      "Special Civil Suit No. 45 of 2026",
      "A ... Plaintiff  V/s  B ... Defendant",
      "Para 1: Not admitted. Para 2: The defendant denies that he took the loan.",
      "The suit be dismissed with costs. Place: Pune Date: 1-12-2026 Advocate for defendant",
      "Verification ... Affidavit in support ... List of documents: 1. Receipt",
    ].join("\n");
    expect(missing("WRITTEN_STATEMENT", ws)).toEqual(["preliminary", "ownVersion"]);
    expect(
      checkDraftParts("WRITTEN_STATEMENT", ws)!
        .parts.filter((p) => !p.found)
        .every((p) => p.need === "usual"),
    ).toBe(true);
  });

  it("checks affidavits and applications, and leaves notices alone", () => {
    expect(missing("AFFIDAVIT", "मी, रमेश, वय 45 वर्षे, सत्य प्रतिज्ञेवर लिहून देतो ... ठिकाण : बारामती दिनांक : 1/12/2026")).toEqual([
      "identification",
    ]);
    expect(checkDraftParts("LEGAL_NOTICE", "anything")).toBeNull();
    expect(checkDraftParts("PUBLIC_NOTICE", "anything")).toBeNull();
  });

  it("cites the rule for each part the Code requires", () => {
    for (const parts of Object.values(DRAFT_PARTS)) {
      for (const p of parts) if (p.rule) expect(p.rule).toMatch(/^O\. (VI|VII|VIII) r\. \d+[A-Z]?(\(\w+\))?(, \(\w\))?$/);
    }
  });
});

describe("the model's guidance", () => {
  it("asks for every part of a plaint and of a written statement", () => {
    const plaint = draftPrompt("PLAINT", "mr");
    for (const s of [
      "cause of action",
      "jurisdiction",
      "limitation",
      "valuation",
      "verification",
      "affidavit",
      "list of documents",
      "दाव्यास कारण",
    ]) {
      expect(plaint).toContain(s);
    }
    const ws = draftPrompt("WRITTEN_STATEMENT", "en");
    for (const s of ["paragraph of the plaint", "specifically", "dismissed with costs", "counter-claim", "लेखी कैफियत"]) {
      expect(ws).toContain(s);
    }
    // The rule against made-up law still applies.
    expect(plaint).toContain("Never invent");
  });
});

const app = await buildApp();
await app.ready();

describe("starting a draft from the blank form", () => {
  const ORIGIN = "http://localhost:5173";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const signUp = async (tag: string) => {
    const agent = request.agent(app.server).set("Origin", ORIGIN);
    const r = await agent
      .post("/api/auth/sign-up/email")
      .send({ name: tag, email: `${tag}-${stamp}@example.com`, password: "password123" });
    expect(r.status).toBe(200);
    return { agent, id: r.body.user.id as string };
  };
  let owner: Awaited<ReturnType<typeof signUp>>;
  let viewer: Awaited<ReturnType<typeof signUp>>;
  let caseId: string;

  beforeAll(async () => {
    owner = await signUp("form-owner");
    viewer = await signUp("form-viewer");
    caseId = (await owner.agent.post("/api/cases").send({ title: "Patil v. Jadhav", court: "Civil Judge, Junior Division, Baramati" })).body
      .case.id;
    await owner.agent.post(`/api/cases/${caseId}/parties`).send({ name: "Ramesh Patil", role: "PLAINTIFF", isOurClient: true });
    await owner.agent.post(`/api/cases/${caseId}/parties`).send({ name: "Suresh Jadhav", role: "DEFENDANT" });
    await owner.agent.post(`/api/cases/${caseId}/grants`).send({ email: `form-viewer-${stamp}@example.com`, role: "VIEWER" });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("needs no AI consent, fills in the case, and is marked as from the form", async () => {
    const r = await owner.agent.post(`/api/cases/${caseId}/drafts/form`).send({ kind: "PLAINT", language: "mr" });
    expect(r.status).toBe(201);
    expect(r.body.draft).toMatchObject({ kind: "PLAINT", language: "mr", source: "form", model: null, title: "वादपत्र · Patil v. Jadhav" });
    expect(r.body.draft.body).toContain("Ramesh Patil");
    expect(r.body.draft.body).toContain("मा. Civil Judge, Junior Division, Baramati यांचे न्यायालयात");
    const got = await owner.agent.get(`/api/drafts/${r.body.draft.id}`);
    expect(got.body.draft.source).toBe("form");
    const [log] = await db
      .select()
      .from(accessLogs)
      .where(and(eq(accessLogs.advocateId, owner.id), eq(accessLogs.action, "draft.create")));
    expect(log).toMatchObject({ entityType: "draft", entityId: r.body.draft.id, status: 201 });
    expect((await owner.agent.get(`/api/cases/${caseId}`)).body.case.drafts.map((d: { id: string }) => d.id)).toContain(r.body.draft.id);
  });

  it("offers forms only for pleadings, and only to those who may edit the case", async () => {
    expect((await owner.agent.post(`/api/cases/${caseId}/drafts/form`).send({ kind: "LEGAL_NOTICE", language: "en" })).status).toBe(400);
    expect((await viewer.agent.post(`/api/cases/${caseId}/drafts/form`).send({ kind: "PLAINT", language: "en" })).status).toBe(403);
    const stranger = await signUp("form-stranger");
    expect((await stranger.agent.post(`/api/cases/${caseId}/drafts/form`).send({ kind: "PLAINT", language: "en" })).status).toBe(404);
  });
});
