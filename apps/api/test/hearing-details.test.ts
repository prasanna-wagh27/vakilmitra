/** Hearing time, court hall, preparation notes and case stage. */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db.js";

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let agent: request.Agent;
let caseId: string;
const day = "2031-03-10";

beforeAll(async () => {
  agent = request.agent(app.server).set("Origin", ORIGIN);
  const r = await agent
    .post("/api/auth/sign-up/email")
    .send({ name: "Hearing", email: `hd-${stamp}@example.com`, password: "password123" });
  expect(r.status).toBe(200);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("hearing details and case stage", () => {
  it("stores the case stage and rejects unknown stages", async () => {
    const c = await agent.post("/api/cases").send({ title: "Stage test", court: "Baramati", stage: "ISSUES" });
    expect(c.status).toBe(201);
    caseId = c.body.case.id;
    expect(c.body.case.stage).toBe("ISSUES");
    expect((await agent.patch(`/api/cases/${caseId}`).send({ stage: "LUNCH" })).status).toBe(400);
    expect((await agent.patch(`/api/cases/${caseId}`).send({ stage: "EVIDENCE" })).body.case.stage).toBe("EVIDENCE");
  });

  it("orders the board by time, untimed last, and validates the time", async () => {
    expect((await agent.post(`/api/cases/${caseId}/hearings`).send({ date: day, time: "25:00" })).status).toBe(400);
    for (const time of [null, "14:30", "11:00"]) {
      const r = await agent
        .post(`/api/cases/${caseId}/hearings`)
        .send({ date: day, time, courtHall: "4", purpose: `at ${time}`, prepNotes: "Bring original 7/12" });
      expect(r.status).toBe(201);
    }
    const board = await agent.get(`/api/diary/board?date=${day}`);
    expect(board.body.hearings.map((h: { time: string | null }) => h.time)).toEqual(["11:00", "14:30", null]);
    expect(board.body.hearings[0]).toMatchObject({ courtHall: "4", prepNotes: "Bring original 7/12" });
  });

  it("carries the time and court hall to the next date when recording an outcome", async () => {
    const detail = await agent.get(`/api/cases/${caseId}`);
    const h = detail.body.case.hearings.find((x: { time: string | null }) => x.time === "11:00");
    const r = await agent
      .patch(`/api/hearings/${h.id}`)
      .send({ outcome: "PW1 examined", next: { date: "2031-04-02", time: "12:15", purpose: "Cross" } });
    expect(r.status).toBe(200);
    expect(r.body.nextHearing).toMatchObject({ time: "12:15", courtHall: "4", purpose: "Cross" });
  });
});
