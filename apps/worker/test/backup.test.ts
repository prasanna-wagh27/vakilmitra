import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advocates, backupRuns, createDb, eq, runMigrations } from "@vakilmitra/db";
import { encrypt, FsBlobStore, parseMasterKeys } from "@vakilmitra/storage";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  assertScratchDb,
  type BackupDeps,
  checkRestore,
  listRuns,
  pickRun,
  restoreDatabase,
  restoreFiles,
  runBackup,
  runIdFor,
} from "../src/backup.js";

const url = process.env.DATABASE_URL!;
await runMigrations(url);
const { db, pool } = createDb(url);
const withDb = (name: string) => {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
};
const checkUrl = withDb("vakilmitra_restore_check");
const masterKeys = parseMasterKeys(`k1:${randomBytes(32).toString("base64")}`);
const live = new FsBlobStore(await mkdtemp(join(tmpdir(), "vm-live-")));
const backup = new FsBlobStore(await mkdtemp(join(tmpdir(), "vm-bak-")));
const quiet = { info() {}, warn() {}, error() {} };
const deps = (now?: Date): BackupDeps => ({ db, databaseUrl: url, live, backup, masterKeys, log: quiet, now: now && (() => now) });

async function putFile(key: string, text: string) {
  await live.put(key, encrypt(Buffer.from(text), key, masterKeys));
}

async function admin(sql: string) {
  const c = new pg.Client({ connectionString: withDb("postgres") });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

afterAll(async () => {
  await admin("DROP DATABASE IF EXISTS vakilmitra_restore_target WITH (FORCE)");
  await pool.end();
});

describe("backups", () => {
  const advocateId = randomUUID();
  const fileA = `adv/${advocateId}/case/c1/doc/d1/p1.jpg.enc`;
  const fileB = `adv/${advocateId}/case/c1/doc/d1/p2.jpg.enc`;
  let firstRun = "";

  it("backs up the database and client files, and the restore check passes", async () => {
    await db.insert(advocates).values({ id: advocateId, name: "Backup Test", email: `${advocateId}@example.test` });
    await putFile(fileA, "page one");
    await putFile(fileB, "page two");

    firstRun = await runBackup(deps());
    const [row] = await db.select().from(backupRuns).where(eq(backupRuns.id, firstRun));
    expect(row.status).toBe("OK");
    expect(row.filesCopied).toBeGreaterThanOrEqual(2);
    expect(await backup.list("files/")).toEqual(expect.arrayContaining([`files/${fileA}`, `files/${fileB}`]));
    expect(await pickRun(backup)).toBe(firstRun);

    await checkRestore(deps(), checkUrl, firstRun);
    const [checked] = await db.select().from(backupRuns).where(eq(backupRuns.id, firstRun));
    expect(checked.checkOk).toBe(true);
  });

  it("restores into an empty database and copies files back; refuses a non-empty one", async () => {
    await admin("DROP DATABASE IF EXISTS vakilmitra_restore_target WITH (FORCE)");
    await admin("CREATE DATABASE vakilmitra_restore_target");
    const target = withDb("vakilmitra_restore_target");
    await restoreDatabase(backup, masterKeys, firstRun, target);
    const c = new pg.Client({ connectionString: target });
    await c.connect();
    const { rows } = await c.query("select name from advocate where id = $1", [advocateId]);
    await c.end();
    expect(rows[0].name).toBe("Backup Test");
    await expect(restoreDatabase(backup, masterKeys, firstRun, target)).rejects.toThrow(/not empty/);

    await live.delete(fileA);
    const r = await restoreFiles(backup, live, masterKeys, firstRun);
    expect(r.copied).toBe(1);
    expect((await live.get(fileA)).length).toBeGreaterThan(0);
  });

  it("copies only new files, and deletes runs and files older than 30 days", async () => {
    // A run from 40 days ago whose file has since been deleted from the live store.
    const old = runIdFor(new Date(Date.now() - 40 * 86_400_000));
    const oldFile = `adv/${advocateId}/case/c1/doc/d0/gone.jpg.enc`;
    await backup.put(`files/${oldFile}`, Buffer.from("x"));
    await backup.put(
      `runs/${old}/files.json.enc`,
      encrypt(Buffer.from(JSON.stringify([oldFile])), `runs/${old}/files.json.enc`, masterKeys),
    );
    await backup.put(`runs/${old}/done.json`, Buffer.from("{}"));

    const next = await runBackup(deps(new Date(Date.now() + 60_000)));
    const [row] = await db.select().from(backupRuns).where(eq(backupRuns.id, next));
    expect(row.filesCopied).toBe(0);
    const ids = (await listRuns(backup)).map((r) => r.id);
    expect(ids).not.toContain(old);
    expect(ids).toContain(firstRun);
    expect(await backup.list("files/")).not.toContain(`files/${oldFile}`);
    expect(await backup.list("files/")).toContain(`files/${fileB}`);
  });

  it("only checks restores into a scratch database", () => {
    expect(() => assertScratchDb(url, url)).toThrow(/_restore_check/);
    expect(() => assertScratchDb(checkUrl, checkUrl)).toThrow(/live database/);
    expect(() => assertScratchDb(checkUrl, url)).not.toThrow();
  });
});
