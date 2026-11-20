/**
 * Nightly backups and the restore check.
 *
 * Backup store layout (everything a restore needs, so it works when the database is gone):
 *   runs/<id>/db.dump.enc     pg_dump (custom format), encrypted like client files
 *   runs/<id>/files.json.enc  the client files this run's database refers to
 *   runs/<id>/done.json       written last: the run is complete; row counts per table
 *   files/<live key>          client files, copied as they are (already encrypted)
 *
 * Kept for 30 days (the privacy policy's promise), then deleted. A file stays while any kept
 * run still lists it, so every kept run can be restored in full.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupRuns, type Db, eq, lt, sql } from "@vakilmitra/db";
import { type BlobStore, decrypt, encrypt, type MasterKey } from "@vakilmitra/storage";
import pg from "pg";
import type { Logger } from "pino";

export const KEEP_DAYS = 30;
const DAY = 86_400_000;
/** Client files live under this prefix in the live store. */
const LIVE_PREFIX = "adv/";
const COPY_CONCURRENCY = 8;

export interface BackupDeps {
  db: Db;
  databaseUrl: string;
  live: BlobStore;
  backup: BlobStore;
  masterKeys: MasterKey[];
  log: Pick<Logger, "info" | "warn" | "error">;
  now?: () => Date;
}

interface Done {
  id: string;
  finishedAt: string;
  rows: Record<string, number>;
  files: number;
}

const runKey = (id: string, name: string) => `runs/${id}/${name}`;

/** 2026-11-20T21:30:00.123Z -> 20261120T213000Z: sorts by time, safe as a key. */
export function runIdFor(d: Date) {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}
export function runDate(id: string) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(id);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

// ---------- Postgres tools ----------

/** pg_dump/pg_restore take the password from the environment, never the command line. */
function pgConn(url: string) {
  const u = new URL(url);
  const password = decodeURIComponent(u.password);
  u.password = "";
  return { dbname: u.toString(), env: { ...process.env, PGPASSWORD: password } };
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => {
      err = (err + d).slice(-4000);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}: ${err.trim()}`))));
  });
}

/** Rows in every table of the app's schemas, read inside the caller's transaction. */
async function countRows(client: pg.ClientBase) {
  const { rows: tables } = await client.query<{ s: string; t: string }>(
    `select table_schema as s, table_name as t from information_schema.tables
     where table_type = 'BASE TABLE' and table_schema in ('public', 'drizzle') order by 1, 2`,
  );
  const counts: Record<string, number> = {};
  for (const { s, t } of tables) {
    const { rows } = await client.query<{ n: string }>(`select count(*) as n from "${s}"."${t}"`);
    counts[`${s}.${t}`] = Number(rows[0].n);
  }
  return counts;
}

/**
 * Dump the database and count its rows from the same snapshot, so the restore check can
 * compare exact numbers while the app keeps writing.
 */
async function dumpWithCounts(url: string, file: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows } = await client.query<{ s: string }>("select pg_export_snapshot() as s");
    const counts = await countRows(client);
    const { dbname, env } = pgConn(url);
    await run(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", "--no-comments", `--snapshot=${rows[0].s}`, `--file=${file}`, `--dbname=${dbname}`],
      env,
    );
    await client.query("COMMIT");
    return counts;
  } finally {
    await client.end();
  }
}

// ---------- Backup ----------

async function putJson(store: BlobStore, key: string, value: unknown, keys?: MasterKey[]) {
  const data = Buffer.from(JSON.stringify(value));
  await store.put(key, keys ? encrypt(data, key, keys) : data);
}
async function getJson<T>(store: BlobStore, key: string, keys?: MasterKey[]): Promise<T> {
  const data = await store.get(key);
  return JSON.parse((keys ? decrypt(data, key, keys) : data).toString("utf8")) as T;
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

const isMissing = (e: unknown) => {
  const x = e as { code?: string; name?: string };
  return x.code === "ENOENT" || x.name === "NoSuchKey" || x.name === "NotFound";
};

/** Take one backup, then delete what is past the 30 days. Returns the run id. */
export async function runBackup(deps: BackupDeps): Promise<string> {
  const { db, backup, live, masterKeys, log } = deps;
  const now = deps.now?.() ?? new Date();
  const id = runIdFor(now);
  // A run left RUNNING by a crashed worker never finishes.
  await db
    .update(backupRuns)
    .set({ status: "FAILED", error: "Did not finish", finishedAt: now })
    .where(sql`${backupRuns.status} = 'RUNNING' and ${backupRuns.startedAt} < ${new Date(now.getTime() - 6 * 3600_000)}`);
  await db.insert(backupRuns).values({ id, startedAt: now });

  const dir = await mkdtemp(join(tmpdir(), "vm-backup-"));
  try {
    const file = join(dir, "db.dump");
    const rows = await dumpWithCounts(deps.databaseUrl, file);
    const dump = await readFile(file);
    await rm(file);
    const dumpKey = runKey(id, "db.dump.enc");
    await backup.put(dumpKey, encrypt(dump, dumpKey, masterKeys));

    // Files listed after the dump, so every file the dump refers to is here.
    const liveKeys = await live.list(LIVE_PREFIX);
    const have = new Set((await backup.list("files/")).map((k) => k.slice("files/".length)));
    const gone = new Set<string>();
    let copied = 0;
    await pool(
      liveKeys.filter((k) => !have.has(k)),
      COPY_CONCURRENCY,
      async (k) => {
        try {
          await backup.put(`files/${k}`, await live.get(k));
          copied++;
        } catch (e) {
          if (!isMissing(e)) throw e;
          gone.add(k); // deleted since the listing
        }
      },
    );
    const files = liveKeys.filter((k) => !gone.has(k));
    await putJson(backup, runKey(id, "files.json.enc"), files, masterKeys);
    const done: Done = { id, finishedAt: new Date().toISOString(), rows, files: files.length };
    await putJson(backup, runKey(id, "done.json"), done);

    const total = Object.values(rows).reduce((a, b) => a + b, 0);
    await db
      .update(backupRuns)
      .set({ status: "OK", finishedAt: new Date(), dumpBytes: dump.length, rows: total, files: files.length, filesCopied: copied })
      .where(eq(backupRuns.id, id));
    log.info({ id, dumpBytes: dump.length, rows: total, files: files.length, copied }, "backup done");
  } catch (err) {
    await db
      .update(backupRuns)
      .set({ status: "FAILED", finishedAt: new Date(), error: String((err as Error).message ?? err).slice(0, 2000) })
      .where(eq(backupRuns.id, id));
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  await prune(deps);
  return id;
}

/** Runs in the backup store, oldest first, and whether each finished. */
export async function listRuns(backup: BlobStore) {
  const byId = new Map<string, boolean>();
  for (const k of await backup.list("runs/")) {
    const [, id, name] = k.split("/");
    if (!runDate(id)) continue;
    byId.set(id, (byId.get(id) ?? false) || name === "done.json");
  }
  return [...byId].map(([id, done]) => ({ id, done })).sort((a, b) => a.id.localeCompare(b.id));
}

/** Delete runs older than 30 days, unfinished runs older than a day, and files no kept run lists. */
export async function prune(deps: BackupDeps) {
  const { backup, masterKeys, log, db } = deps;
  const now = (deps.now?.() ?? new Date()).getTime();
  const kept: string[] = [];
  let removed = 0;
  for (const r of await listRuns(backup)) {
    const age = now - (runDate(r.id)?.getTime() ?? 0);
    if (age > KEEP_DAYS * DAY || (!r.done && age > DAY)) {
      await backup.deletePrefix(`runs/${r.id}/`);
      removed++;
    } else if (r.done) kept.push(r.id);
  }
  // Never empty the file copies on the strength of zero kept runs: only prune after a good run.
  if (!kept.length) return { runsRemoved: removed, filesRemoved: 0 };
  const needed = new Set<string>();
  for (const id of kept) for (const k of await getJson<string[]>(backup, runKey(id, "files.json.enc"), masterKeys)) needed.add(k);
  let filesRemoved = 0;
  for (const k of await backup.list("files/")) {
    if (!needed.has(k.slice("files/".length))) {
      await backup.delete(k);
      filesRemoved++;
    }
  }
  await db.delete(backupRuns).where(lt(backupRuns.startedAt, new Date(now - 90 * DAY)));
  if (removed || filesRemoved) log.info({ runsRemoved: removed, filesRemoved }, "old backups deleted");
  return { runsRemoved: removed, filesRemoved };
}

// ---------- Restore ----------

/** The newest finished run, or the given one if it finished. */
export async function pickRun(backup: BlobStore, id = "latest") {
  const done = (await listRuns(backup)).filter((r) => r.done);
  const run = id === "latest" ? done.at(-1) : done.find((r) => r.id === id);
  if (!run) throw new Error(id === "latest" ? "No finished backup found" : `No finished backup "${id}"`);
  return run.id;
}

/** Restore a run's database into an empty database. */
export async function restoreDatabase(backup: BlobStore, masterKeys: MasterKey[], id: string, targetUrl: string) {
  const client = new pg.Client({ connectionString: targetUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ n: string }>(
      "select count(*) as n from information_schema.tables where table_schema in ('public', 'drizzle')",
    );
    if (Number(rows[0].n) > 0) throw new Error("The target database is not empty; restore into a new, empty database");
  } finally {
    await client.end();
  }
  const dumpKey = runKey(id, "db.dump.enc");
  const dump = decrypt(await backup.get(dumpKey), dumpKey, masterKeys);
  const dir = await mkdtemp(join(tmpdir(), "vm-restore-"));
  try {
    const file = join(dir, "db.dump");
    await writeFile(file, dump, { mode: 0o600 });
    const { dbname, env } = pgConn(targetUrl);
    await run("pg_restore", ["--no-owner", "--no-acl", "--exit-on-error", "--single-transaction", `--dbname=${dbname}`, file], env);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Copy a run's client files back into the live store (files already there are left alone). */
export async function restoreFiles(backup: BlobStore, live: BlobStore, masterKeys: MasterKey[], id: string) {
  const files = await getJson<string[]>(backup, runKey(id, "files.json.enc"), masterKeys);
  const have = new Set(await live.list(LIVE_PREFIX));
  let copied = 0;
  await pool(
    files.filter((k) => !have.has(k)),
    COPY_CONCURRENCY,
    async (k) => {
      await live.put(k, await backup.get(`files/${k}`));
      copied++;
    },
  );
  return { files: files.length, copied };
}

const dbName = (url: string) => decodeURIComponent(new URL(url).pathname.slice(1));
const sameDb = (a: string, b: string) => {
  const x = new URL(a);
  const y = new URL(b);
  return x.hostname === y.hostname && (x.port || "5432") === (y.port || "5432") && dbName(a) === dbName(b);
};

/** The restore check's database is dropped and recreated each time, so it must be clearly a scratch one. */
export function assertScratchDb(checkUrl: string, liveUrl: string) {
  if (!dbName(checkUrl).endsWith("_restore_check")) throw new Error('The restore check database name must end in "_restore_check"');
  if (sameDb(checkUrl, liveUrl)) throw new Error("The restore check database must not be the live database");
}

async function recreateDb(checkUrl: string, drop = false) {
  const admin = new URL(checkUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const name = `"${dbName(checkUrl).replace(/"/g, '""')}"`;
    await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    if (!drop) await client.query(`CREATE DATABASE ${name}`);
  } finally {
    await client.end();
  }
}

/**
 * Prove a backup restores: restore it into a fresh scratch database, compare every table's
 * row count with the counts taken at backup time, and decrypt a sample of the copied files.
 * The scratch database is dropped afterwards (it holds client data).
 */
export async function checkRestore(deps: BackupDeps, checkUrl: string, id?: string) {
  const { db, backup, masterKeys, log } = deps;
  assertScratchDb(checkUrl, deps.databaseUrl);
  const runId = await pickRun(backup, id);
  try {
    await recreateDb(checkUrl);
    await restoreDatabase(backup, masterKeys, runId, checkUrl);
    const done = await getJson<Done>(backup, runKey(runId, "done.json"));
    const client = new pg.Client({ connectionString: checkUrl });
    await client.connect();
    let restored: Record<string, number>;
    try {
      restored = await countRows(client);
    } finally {
      await client.end();
    }
    const tables = new Set([...Object.keys(done.rows), ...Object.keys(restored)]);
    const wrong = [...tables].filter((t) => done.rows[t] !== restored[t]);
    if (wrong.length) {
      throw new Error(`Row counts differ: ${wrong.map((t) => `${t} ${done.rows[t] ?? "-"} vs ${restored[t] ?? "-"}`).join(", ")}`);
    }
    const files = await getJson<string[]>(backup, runKey(runId, "files.json.enc"), masterKeys);
    const sample = [...new Set([files[0], files[Math.floor(files.length / 2)], files.at(-1)])].filter(Boolean) as string[];
    for (const k of sample) decrypt(await backup.get(`files/${k}`), k, masterKeys);
    await db.update(backupRuns).set({ checkedAt: new Date(), checkOk: true, checkError: null }).where(eq(backupRuns.id, runId));
    log.info({ id: runId, tables: tables.size, filesSampled: sample.length }, "restore check passed");
    return runId;
  } catch (err) {
    const msg = String((err as Error).message ?? err).slice(0, 2000);
    await db.update(backupRuns).set({ checkedAt: new Date(), checkOk: false, checkError: msg }).where(eq(backupRuns.id, runId));
    log.error({ id: runId, err }, "restore check failed");
    throw err;
  } finally {
    await recreateDb(checkUrl, true).catch(() => {});
  }
}
