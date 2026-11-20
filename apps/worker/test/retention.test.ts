import { randomUUID } from "node:crypto";
import { accessLogs, createDb, inArray, runMigrations } from "@vakilmitra/db";
import { afterAll, expect, it } from "vitest";
import { pruneActivity } from "../src/retention.js";

const url = process.env.DATABASE_URL!;
await runMigrations(url);
const { db, pool } = createDb(url);
afterAll(() => pool.end());

it("deletes activity records older than a year, but keeps the record that an account was deleted", async () => {
  const now = new Date("2030-06-01T00:00:00Z");
  const day = 86_400_000;
  const row = (action: string, ageDays: number) => ({
    id: randomUUID(),
    actor: "system",
    action,
    caseId: `retention-${randomUUID()}`,
    at: new Date(now.getTime() - ageDays * day),
  });
  const rows = [row("case.view", 366), row("auth.sign_in", 400), row("case.view", 364), row("account.delete", 800)];
  await db.insert(accessLogs).values(rows);

  const { deleted } = await pruneActivity(db, now);
  expect(deleted).toBeGreaterThanOrEqual(2);
  const left = await db
    .select({ action: accessLogs.action })
    .from(accessLogs)
    .where(
      inArray(
        accessLogs.id,
        rows.map((r) => r.id),
      ),
    );
  expect(left.map((r) => r.action).sort()).toEqual(["account.delete", "case.view"]);
  await db.delete(accessLogs).where(
    inArray(
      accessLogs.id,
      rows.map((r) => r.id),
    ),
  );
});
